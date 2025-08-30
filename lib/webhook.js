const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { CONFIG_DIR, readSettings } = require('./config');

// webhook 配置文件路径
const WEBHOOK_CONFIG_FILE = path.join(CONFIG_DIR, 'webhook.json');

// 可用的 webhook 触发节点
const WEBHOOK_EVENTS = {
  CONFIG_SWITCH: {
    name: 'config_switch',
    displayName: '配置切换',
    description: '当切换 Claude API 配置时触发'
  },
  CONFIG_ADD: {
    name: 'config_add',
    displayName: '配置添加',
    description: '当添加新的 API 配置时触发'
  },
  CONFIG_DELETE: {
    name: 'config_delete',
    displayName: '配置删除',
    description: '当删除 API 配置时触发'
  },
  WEBDAV_SYNC: {
    name: 'webdav_sync',
    displayName: 'WebDAV 同步',
    description: '当配置同步到 WebDAV 时触发'
  },
  MODEL_CHANGE: {
    name: 'model_change',
    displayName: '模型切换',
    description: '当切换 AI 模型时触发'
  },
  ERROR_OCCURRED: {
    name: 'error_occurred',
    displayName: '错误发生',
    description: '当操作出现错误时触发'
  }
};

/**
 * 读取 webhook 配置
 * @returns {Object|null} webhook 配置对象或 null
 */
function readWebhookConfig() {
  try {
    if (!fs.existsSync(WEBHOOK_CONFIG_FILE)) {
      return null;
    }

    const data = fs.readFileSync(WEBHOOK_CONFIG_FILE, 'utf8');
    const config = JSON.parse(data);
    
    // 验证新的配置格式
    if (!config.webhooks || !Array.isArray(config.webhooks)) {
      // 兼容旧配置格式
      if (config.webhook_url && typeof config.webhook_url === 'string') {
        return {
          webhooks: [{
            name: '默认 Webhook',
            url: config.webhook_url,
            enabled: true,
            events: ['config_switch'], // 默认只监听配置切换
            conditions: {},
            format: 'feishu'
          }]
        };
      }
      console.warn(chalk.yellow('警告: webhook 配置格式无效'));
      return null;
    }

    return config;
  } catch (error) {
    console.warn(chalk.yellow(`警告: 读取 webhook 配置失败: ${error.message}`));
    return null;
  }
}

/**
 * 验证 webhook URL 格式
 * @param {string} url webhook URL
 * @returns {boolean} 是否为有效的 URL
 */
function isValidWebhookUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 执行 webhook 事件
 * @param {string} eventName 事件名称
 * @param {Object} eventData 事件数据
 * @returns {Promise<boolean>} 执行是否成功
 */
async function executeWebhookEvent(eventName, eventData = {}) {
  const webhookConfig = readWebhookConfig();
  
  if (!webhookConfig || !webhookConfig.webhooks) {
    // 没有配置 webhook，静默跳过
    return true;
  }

  let hasSuccess = false;
  const results = [];

  // 并行执行所有匹配的 webhook
  const promises = webhookConfig.webhooks
    .filter(webhook => {
      // 检查是否启用
      if (!webhook.enabled) return false;
      
      // 检查事件匹配
      if (!webhook.events.includes(eventName)) return false;
      
      // 检查条件匹配
      if (webhook.conditions && !checkWebhookConditions(webhook.conditions, eventData)) {
        return false;
      }
      
      return true;
    })
    .map(async webhook => {
      try {
        const success = await executeWebhook(webhook, eventName, eventData);
        if (success) hasSuccess = true;
        return { webhook: webhook.name, success, error: null };
      } catch (error) {
        return { webhook: webhook.name, success: false, error: error.message };
      }
    });

  const webhookResults = await Promise.all(promises);
  
  // 显示执行结果
  webhookResults.forEach(result => {
    if (result.success) {
      console.log(chalk.green(`✓ Webhook "${result.webhook}" 执行成功`));
    } else if (result.error) {
      console.warn(chalk.yellow(`⚠ Webhook "${result.webhook}" 执行失败: ${result.error}`));
    }
  });

  return hasSuccess || webhookResults.length === 0;
}

/**
 * 执行单个 webhook
 * @param {Object} webhook webhook 配置
 * @param {string} eventName 事件名称
 * @param {Object} eventData 事件数据
 * @returns {Promise<boolean>} 执行是否成功
 */
async function executeWebhook(webhook, eventName, eventData) {
  if (!isValidWebhookUrl(webhook.url)) {
    throw new Error('Webhook URL 格式无效');
  }

  // 构造消息内容
  const message = buildEventMessage(eventName, eventData, webhook);
  
  // 根据格式构造 payload
  const payload = buildWebhookPayload(message, webhook.format || 'feishu');

  const maxRetries = webhook.retries || 3;
  const retryDelay = webhook.retryDelay || 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const success = await sendHttpRequest(webhook.url, payload, webhook.timeout || 5000);
      if (success) {
        return true;
      }
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // 等待重试延迟
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }

  return false;
}

/**
 * 发送 HTTP POST 请求
 * @param {string} url 目标 URL
 * @param {Object} data 要发送的数据
 * @returns {Promise<boolean>} 请求是否成功
 */
function sendHttpRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000 // 5秒超时
    };

    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 构造配置切换消息
 * @param {Object} previousConfig 之前的配置
 * @param {Object} currentConfig 当前的配置
 * @returns {string} 格式化的消息
 */
function buildConfigSwitchMessage(previousConfig, currentConfig) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  let message = `[Claude Config Switcher] 配置切换通知\n`;
  message += `时间: ${timestamp}\n`;
  
  if (previousConfig) {
    message += `从: ${previousConfig.name}\n`;
  }
  
  message += `切换到: ${currentConfig.name}\n`;
  
  // 添加模型信息（如果存在）
  if (currentConfig.config && currentConfig.config.model) {
    message += `模型: ${currentConfig.config.model}\n`;
  }
  
  // 添加基础 URL 信息（如果存在）
  if (currentConfig.config && currentConfig.config.env && currentConfig.config.env.ANTHROPIC_BASE_URL) {
    message += `API地址: ${currentConfig.config.env.ANTHROPIC_BASE_URL}`;
  }

  return message;
}

/**
 * 发送配置切换通知
 * @param {Object} previousConfig 之前的配置
 * @param {Object} currentConfig 当前的配置
 * @returns {Promise<boolean>} 发送是否成功
 */
async function notifyConfigSwitch(previousConfig, currentConfig) {
  const message = buildConfigSwitchMessage(previousConfig, currentConfig);
  return await sendWebhookMessage(message, previousConfig, currentConfig);
}

/**
 * 添加或更新 webhook URL
 * @param {string} url webhook URL 地址
 */
function addWebhookUrl(url) {
  if (!url) {
    console.error(chalk.red('错误: 请提供 webhook URL'));
    return;
  }

  if (!isValidWebhookUrl(url)) {
    console.error(chalk.red('错误: webhook URL 格式无效，请确保使用 http:// 或 https:// 开头'));
    return;
  }

  const config = {
    webhook_url: url
  };

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    fs.writeFileSync(WEBHOOK_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    
    console.log(chalk.green('✓ webhook URL 配置成功'));
    console.log(chalk.cyan(`URL: ${url}`));
    console.log(chalk.gray('现在每次配置切换时都会发送通知消息'));
  } catch (error) {
    console.error(chalk.red(`配置 webhook 失败: ${error.message}`));
  }
}

/**
 * 显示当前 webhook 配置
 */
function showWebhookConfig() {
  const config = readWebhookConfig();
  
  if (!config) {
    console.log(chalk.yellow('当前未配置 webhook'));
    console.log(chalk.gray('使用 "ccs webhook add <url>" 来配置 webhook'));
    return;
  }
  
  console.log(chalk.green('当前 webhook 配置:'));
  console.log(chalk.cyan(`URL: ${config.webhook_url}`));
  
  // 验证 URL 状态
  if (!isValidWebhookUrl(config.webhook_url)) {
    console.log(chalk.red('⚠️  警告: URL 格式无效'));
  } else {
    console.log(chalk.green('✓ URL 格式正确'));
  }
}

/**
 * 删除 webhook 配置
 */
function removeWebhookConfig() {
  try {
    if (!fs.existsSync(WEBHOOK_CONFIG_FILE)) {
      console.log(chalk.yellow('当前未配置 webhook'));
      return;
    }
    
    fs.unlinkSync(WEBHOOK_CONFIG_FILE);
    console.log(chalk.green('✓ webhook 配置已删除'));
  } catch (error) {
    console.error(chalk.red(`删除 webhook 配置失败: ${error.message}`));
  }
}

module.exports = {
  readWebhookConfig,
  isValidWebhookUrl,
  sendWebhookMessage,
  notifyConfigSwitch,
  buildConfigSwitchMessage,
  addWebhookUrl,
  showWebhookConfig,
  removeWebhookConfig
};