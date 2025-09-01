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
 * 构造事件消息
 * @param {string} eventName 事件名称
 * @param {Object} eventData 事件数据
 * @param {Object} webhook webhook 配置
 * @returns {string} 格式化的消息
 */
function buildEventMessage(eventName, eventData, webhook) {
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  // 如果是手动推送消息
  if (eventName === 'manual_push' && eventData.message) {
    return eventData.message;
  }
  
  // 构造标准事件消息
  let message = `[Claude Code Switcher] ${eventName} 事件通知\n`;
  message += `时间: ${timestamp}\n`;
  
  // 添加事件特定信息
  if (eventData.message) {
    message += `消息: ${eventData.message}\n`;
  }
  
  if (eventData.data) {
    message += `数据: ${JSON.stringify(eventData.data, null, 2)}`;
  }
  
  return message;
}

/**
 * 构造 webhook payload
 * @param {string} message 消息内容
 * @param {string} format 消息格式（feishu, slack, general）
 * @returns {Object} webhook payload
 */
function buildWebhookPayload(message, format = 'feishu') {
  switch (format.toLowerCase()) {
    case 'feishu':
    case 'lark':
      return {
        msg_type: 'text',
        content: {
          text: message
        }
      };
    
    case 'slack':
      return {
        text: message,
        username: 'Claude Code Switcher'
      };
    
    case 'discord':
      return {
        content: message,
        username: 'Claude Code Switcher'
      };
    
    default:
    case 'general':
      return {
        message: message,
        timestamp: new Date().toISOString(),
        source: 'claude-code-switcher'
      };
  }
}

/**
 * 检查 webhook 条件
 * @param {Object} conditions 条件配置
 * @param {Object} eventData 事件数据
 * @returns {boolean} 是否满足条件
 */
function checkWebhookConditions(conditions, eventData) {
  // 如果没有条件，默认通过
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }
  
  // 简单的条件检查逻辑
  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = eventData[key];
    
    if (Array.isArray(expectedValue)) {
      if (!expectedValue.includes(actualValue)) {
        return false;
      }
    } else if (actualValue !== expectedValue) {
      return false;
    }
  }
  
  return true;
}

/**
 * 发送 webhook 消息（通用函数）
 * @param {string} message 消息内容
 * @param {Object} data 额外数据
 * @returns {Promise<boolean>} 发送是否成功
 */
async function sendWebhookMessage(message, data = {}) {
  return await executeWebhookEvent('custom_message', { 
    message, 
    data, 
    timestamp: new Date().toISOString() 
  });
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
 * 添加 webhook URL 到配置中
 * @param {string} url webhook URL 地址
 * @param {string} name webhook 名称（可选）
 */
function addWebhookUrl(url, name = null) {
  if (!url) {
    console.error(chalk.red('错误: 请提供 webhook URL'));
    return;
  }

  if (!isValidWebhookUrl(url)) {
    console.error(chalk.red('错误: webhook URL 格式无效，请确保使用 http:// 或 https:// 开头'));
    return;
  }

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // 读取现有配置
    let config = readWebhookConfig() || { webhooks: [] };
    
    // 确保 webhooks 数组存在
    if (!config.webhooks || !Array.isArray(config.webhooks)) {
      config.webhooks = [];
    }

    // 生成 webhook 名称
    const webhookName = name || `Webhook ${config.webhooks.length + 1}`;
    
    // 检查是否已存在相同URL
    const existingIndex = config.webhooks.findIndex(webhook => webhook.url === url);
    
    if (existingIndex >= 0) {
      console.log(chalk.yellow(`⚠ URL 已存在: ${config.webhooks[existingIndex].name}`));
      console.log(chalk.gray('如需修改配置，请先删除现有配置'));
      return;
    }

    // 添加新的 webhook
    const newWebhook = {
      name: webhookName,
      url: url,
      enabled: true,
      events: ['claude_hooks'], // 默认监听 claude_hooks 事件
      conditions: {},
      format: 'feishu',
      retries: 3,
      timeout: 5000,
      retryDelay: 1000
    };

    config.webhooks.push(newWebhook);
    
    // 保存配置
    fs.writeFileSync(WEBHOOK_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    
    console.log(chalk.green('✓ webhook URL 添加成功'));
    console.log(chalk.cyan(`名称: ${webhookName}`));
    console.log(chalk.cyan(`URL: ${url}`));
    console.log(chalk.gray('使用 "ccs webhook hooks" 配置触发条件'));
  } catch (error) {
    console.error(chalk.red(`配置 webhook 失败: ${error.message}`));
  }
}

/**
 * 显示当前 webhook 配置
 */
function showWebhookConfig() {
  const config = readWebhookConfig();
  
  if (!config || !config.webhooks || config.webhooks.length === 0) {
    console.log(chalk.yellow('当前未配置 webhook'));
    console.log(chalk.gray('使用 "ccs webhook add <url>" 来配置 webhook'));
    return;
  }
  
  console.log(chalk.green(`当前 webhook 配置 (共${config.webhooks.length}个):`));
  console.log('');
  
  config.webhooks.forEach((webhook, index) => {
    console.log(chalk.cyan(`${index + 1}. ${webhook.name}`));
    console.log(chalk.gray(`   URL: ${webhook.url}`));
    console.log(chalk.gray(`   状态: ${webhook.enabled ? '启用' : '禁用'}`));
    console.log(chalk.gray(`   事件: ${webhook.events.join(', ')}`));
    console.log(chalk.gray(`   格式: ${webhook.format}`));
    
    // 验证 URL 状态
    if (!isValidWebhookUrl(webhook.url)) {
      console.log(chalk.red('   ⚠️  警告: URL 格式无效'));
    } else {
      console.log(chalk.green('   ✓ URL 格式正确'));
    }
    console.log('');
  });
  
  console.log(chalk.gray('使用 "ccs webhook hooks" 配置监听事件'));
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

/**
 * 推送自定义消息到所有启用的 webhook
 * @param {string} message 要推送的消息
 * @returns {Promise<boolean>} 推送是否成功
 */
async function pushWebhookMessage(message) {
  if (!message || message.trim() === '') {
    console.error(chalk.red('错误: 请提供要推送的消息内容'));
    return false;
  }

  const config = readWebhookConfig();
  
  if (!config || !config.webhooks || config.webhooks.length === 0) {
    console.log(chalk.yellow('未配置任何 webhook，请先使用 "ccs webhook add <url>" 添加 webhook'));
    return false;
  }

  const enabledWebhooks = config.webhooks.filter(webhook => webhook.enabled);
  
  if (enabledWebhooks.length === 0) {
    console.log(chalk.yellow('没有启用的 webhook'));
    return false;
  }

  console.log(chalk.blue(`正在推送消息到 ${enabledWebhooks.length} 个 webhook...`));

  let successCount = 0;
  const results = [];

  // 并行推送到所有启用的 webhook
  const promises = enabledWebhooks.map(async webhook => {
    try {
      const success = await executeWebhook(webhook, 'manual_push', { message });
      if (success) successCount++;
      return { webhook: webhook.name, success, error: null };
    } catch (error) {
      return { webhook: webhook.name, success: false, error: error.message };
    }
  });

  const webhookResults = await Promise.all(promises);
  
  // 显示推送结果
  webhookResults.forEach(result => {
    if (result.success) {
      console.log(chalk.green(`✓ ${result.webhook}: 推送成功`));
    } else {
      console.log(chalk.red(`✗ ${result.webhook}: 推送失败 - ${result.error}`));
    }
  });

  console.log(chalk.cyan(`推送完成: ${successCount}/${enabledWebhooks.length} 成功`));
  return successCount > 0;
}

/**
 * 配置 Claude Code Hooks 监听器
 * @returns {Promise<boolean>} 配置是否成功
 */
async function configureClaudeHooks() {
  const config = readWebhookConfig();
  
  if (!config || !config.webhooks || config.webhooks.length === 0) {
    console.log(chalk.yellow('请先使用 "ccs webhook add <url>" 添加 webhook'));
    return false;
  }

  console.log(chalk.blue('配置 Claude Code Hooks 监听器...'));

  // 可监听的 Hook 事件类型
  const CLAUDE_HOOKS = {
    'ExitPlanMode': {
      name: 'ExitPlanMode',
      displayName: '退出规划模式',
      description: '当用户退出任务规划模式时触发',
      category: 'user_interaction'
    },
    'TodoWrite': {
      name: 'TodoWrite',
      displayName: '任务列表更新',
      description: '当任务列表被更新时触发',
      category: 'task_completion'
    },
    'Bash': {
      name: 'Bash',
      displayName: 'Bash 命令执行',
      description: '当执行 bash 命令时触发',
      category: 'user_interaction'
    },
    'Edit': {
      name: 'Edit',
      displayName: '文件编辑',
      description: '当编辑文件时触发',
      category: 'user_interaction'
    },
    'Write': {
      name: 'Write',
      displayName: '文件写入',
      description: '当写入新文件时触发',
      category: 'user_interaction'
    },
    'MultiEdit': {
      name: 'MultiEdit',
      displayName: '批量编辑',
      description: '当批量编辑文件时触发',
      category: 'user_interaction'
    }
  };

  // 选择要监听的事件
  const choices = Object.entries(CLAUDE_HOOKS).map(([key, hook]) => ({
    name: `${hook.displayName} (${hook.description})`,
    value: key,
    checked: ['ExitPlanMode', 'TodoWrite'].includes(key) // 默认选中用户交互和任务完成类
  }));

  const { selectedHooks } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selectedHooks',
    message: '选择要监听的 Claude Code Hooks 事件:',
    choices: choices,
    validate: (input) => {
      return input.length > 0 ? true : '请至少选择一个事件类型';
    }
  }]);

  if (selectedHooks.length === 0) {
    console.log(chalk.yellow('未选择任何事件，配置取消'));
    return false;
  }

  // 询问消息过滤条件
  const { messageFilter } = await inquirer.prompt([{
    type: 'list',
    name: 'messageFilter',
    message: '选择消息过滤级别:',
    choices: [
      { name: '全部事件', value: 'all' },
      { name: '仅用户确认类事件', value: 'user_interaction' },
      { name: '仅任务完成类事件', value: 'task_completion' },
      { name: '智能过滤（重要事件优先）', value: 'smart' }
    ],
    default: 'smart'
  }]);

  // 根据过滤条件生成不同的命令
  const generateHookCommand = (hook, messageFilter) => {
    const baseMessage = `🔔 ${hook.displayName}: 事件触发`;
    
    switch (messageFilter) {
      case 'user_interaction':
        if (hook.category !== 'user_interaction') return null;
        return `npx claude-code-switcher webhook push "${baseMessage}\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n类型: 用户交互\\n事件: $TOOL_NAME\\n详情: $TOOL_INPUT"`;
      
      case 'task_completion':
        if (hook.category !== 'task_completion') return null;
        return `npx claude-code-switcher webhook push "${baseMessage}\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n类型: 任务完成\\n事件: $TOOL_NAME\\n详情: $TOOL_INPUT"`;
      
      case 'smart':
        // 智能过滤：TodoWrite 和 ExitPlanMode 使用不同的消息格式
        if (hook.name === 'TodoWrite') {
          return `if echo "$TOOL_INPUT" | grep -q '"status":"completed"'; then npx claude-code-switcher webhook push "${baseMessage}\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n类型: ✅ 任务完成\\n详情: 有任务被标记为完成"; fi`;
        } else if (hook.name === 'ExitPlanMode') {
          return `npx claude-code-switcher webhook push "${baseMessage}\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n类型: 📋 规划完成\\n详情: 用户确认执行计划"`;
        } else {
          return `npx claude-code-switcher webhook push "${baseMessage}\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n事件: $TOOL_NAME"`;
        }
      
      case 'all':
      default:
        return `npx claude-code-switcher webhook push "${baseMessage}\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n事件: $TOOL_NAME\\n详情: $TOOL_INPUT"`;
    }
  };

  // 生成 hooks 配置
  const hookConfigs = [];
  selectedHooks.forEach(hookName => {
    const hook = CLAUDE_HOOKS[hookName];
    const command = generateHookCommand(hook, messageFilter);
    
    if (command) {
      hookConfigs.push({
        matcher: hookName,
        hooks: [{
          type: 'command',
          command: command
        }]
      });
    }
  });

  const hooksConfig = {
    hooks: {
      PreToolUse: hookConfigs
    }
  };

  // 读取现有的 settings.json
  const settingsFile = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'settings.json');
  let settings = {};

  try {
    if (fs.existsSync(settingsFile)) {
      const settingsData = fs.readFileSync(settingsFile, 'utf8');
      settings = JSON.parse(settingsData);
    }
  } catch (error) {
    console.warn(chalk.yellow(`警告: 读取 settings.json 失败: ${error.message}`));
  }

  // 合并 hooks 配置
  settings.hooks = hooksConfig.hooks;

  try {
    // 确保目录存在
    const settingsDir = path.dirname(settingsFile);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    // 保存配置
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
    
    console.log(chalk.green('✓ Claude Code Hooks 配置成功'));
    console.log(chalk.cyan(`配置文件: ${settingsFile}`));
    console.log(chalk.gray(`监听事件: ${selectedHooks.map(hook => CLAUDE_HOOKS[hook].displayName).join(', ')}`));
    console.log(chalk.gray('现在 Claude Code 执行相关操作时会自动推送通知'));
    
    return true;
  } catch (error) {
    console.error(chalk.red(`保存配置失败: ${error.message}`));
    return false;
  }
}

module.exports = {
  readWebhookConfig,
  isValidWebhookUrl,
  executeWebhookEvent,
  sendWebhookMessage,
  notifyConfigSwitch,
  buildConfigSwitchMessage,
  addWebhookUrl,
  showWebhookConfig,
  removeWebhookConfig,
  pushWebhookMessage,
  configureClaudeHooks
};