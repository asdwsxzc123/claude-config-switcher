const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const PlatformAdapter = require('./base');
const {
  ensureConfigDir,
  getConfigsByPlatform,
  addConfigToUnified,
  readSettings,
  writeSettings,
  CONFIG_DIR
} = require('../unifiedConfig');

/**
 * Claude平台适配器
 * 处理Claude配置的读写和切换
 */
class ClaudeAdapter extends PlatformAdapter {
  constructor() {
    super('claude');
    this.configDir = CONFIG_DIR;
  }

  /**
   * 获取配置目录路径
   */
  getConfigDir() {
    return this.configDir;
  }

  /**
   * 确保配置目录存在
   */
  ensureConfigDir() {
    ensureConfigDir();
  }

  /**
   * 确保 ~/.claude/config.json 文件存在
   * 如果不存在，创建一个包含默认值的文件
   */
  ensureClaudeConfigFile() {
    const configPath = path.join(CONFIG_DIR, 'config.json');

    // 如果文件已存在，不做任何操作
    if (fs.existsSync(configPath)) {
      return;
    }

    // 创建默认配置内容
    const defaultConfig = {
      primaryApiKey: "happy"
    };

    try {
      // 确保配置目录存在
      ensureConfigDir();

      // 写入配置文件
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log(chalk.green(`已创建 Claude 配置文件: ${configPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`创建 config.json 失败: ${error.message}`));
    }
  }

  /**
   * 读取配置列表
   */
  readConfigs() {
    return getConfigsByPlatform('claude');
  }

  /**
   * 保存配置列表（该方法不再需要，配置通过统一管理器处理）
   */
  writeConfigs(configs) {
    // 该方法已废弃，配置通过addConfigToUnified统一管理
    console.warn(chalk.yellow('writeConfigs方法已废弃，请使用addConfigToUnified'));
  }

  /**
   * 读取settings.json文件
   */
  readSettings() {
    return readSettings();
  }

  /**
   * 写入settings.json文件
   */
  writeSettings(settings) {
    writeSettings(settings);
  }

  /**
   * 添加新配置
   * 只保存必要的认证字段，不包含其他环境变量
   */
  addConfig(alias, key, url) {
    if (!this.validateConfig(key, url)) {
      throw new Error('无效的配置参数');
    }

    // 创建新配置 - 只包含认证相关字段
    const newConfig = {
      name: alias,
      platform: 'claude',
      config: {
        env: {
          ANTHROPIC_AUTH_TOKEN: key,
          ANTHROPIC_BASE_URL: url
        },
        permissions: {
          allow: [],
          deny: []
        }
      }
    };

    addConfigToUnified(newConfig);
    return newConfig;
  }

  /**
   * 激活配置
   * 只更新认证相关字段（ANTHROPIC_AUTH_TOKEN 和 ANTHROPIC_BASE_URL）
   * 保留用户的所有其他自定义环境变量
   */
  activateConfig(config) {
    try {
      // 确保 ~/.claude/config.json 文件存在
      this.ensureClaudeConfigFile();

      // 读取现有的settings配置
      const existingSettings = this.readSettings();
      const existingEnv = (existingSettings && existingSettings.env) ? existingSettings.env : {};

      // 获取配置中的认证字段
      const configEnv = config.config.env || {};

      // 只更新认证相关的字段，保留所有其他字段
      const mergedEnv = {
        ...existingEnv,                                              // 保留所有现有配置
        ANTHROPIC_AUTH_TOKEN: configEnv.ANTHROPIC_AUTH_TOKEN,       // 只更新认证Token
        ANTHROPIC_BASE_URL: configEnv.ANTHROPIC_BASE_URL,           // 只更新Base URL
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: existingEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS || "32000"  // 如果不存在则设置默认值
      };

      // 只覆盖 env 属性，保留其他属性（如 permissions, hooks 等）
      const settings = {
        ...existingSettings,
        env: mergedEnv
      };

      this.writeSettings(settings);
      return true;
    } catch (error) {
      console.error(chalk.red(`激活Claude配置失败: ${error.message}`));
      return false;
    }
  }

  /**
   * 深度比较两个对象
   */
  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (let key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  }

  /**
   * 获取当前激活的配置
   * 只比较关键认证字段 ANTHROPIC_AUTH_TOKEN 和 ANTHROPIC_BASE_URL
   * 不再比较整个 env 对象，避免用户自定义环境变量导致匹配失败
   */
  getCurrentConfig() {
    const settings = this.readSettings();

    if (!settings || !settings.env) {
      return null;
    }

    // 获取当前激活的认证字段
    const currentToken = settings.env.ANTHROPIC_AUTH_TOKEN;
    const currentUrl = settings.env.ANTHROPIC_BASE_URL;

    // 如果关键字段不存在，返回 null
    if (!currentToken || !currentUrl) {
      return null;
    }

    const configs = this.readConfigs();

    // 只比较关键认证字段，而不是整个 env 对象
    return configs.find(config =>
      config.config?.env?.ANTHROPIC_AUTH_TOKEN === currentToken &&
      config.config?.env?.ANTHROPIC_BASE_URL === currentUrl
    ) || null;
  }

  /**
   * 获取平台显示名称
   */
  getDisplayName() {
    return 'Claude';
  }

  /**
   * 获取配置的摘要信息
   * @param {Object} config 配置对象
   * @returns {Object} 包含 key, url, maskedKey 的对象
   */
  getConfigSummary(config) {
    if (!config || !config.config || !config.config.env) {
      return {
        key: 'N/A',
        url: 'N/A',
        maskedKey: 'N/A'
      };
    }

    const key = config.config.env.ANTHROPIC_AUTH_TOKEN || 'N/A';
    const url = config.config.env.ANTHROPIC_BASE_URL || 'N/A';

    return {
      key,
      url,
      maskedKey: this.maskKey(key)
    };
  }
}

module.exports = ClaudeAdapter;