const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const PlatformAdapter = require('./base');
const { 
  ensureConfigDir, 
  getConfigsByPlatform, 
  addConfigToUnified
} = require('../unifiedConfig');

/**
 * Codex平台适配器
 * 处理Codex配置的读写和切换，配置格式为TOML+JSON
 */
class CodexAdapter extends PlatformAdapter {
  constructor() {
    super('codex');
    this.configDir = path.join(os.homedir(), '.codex');
    this.configFile = path.join(this.configDir, 'config.toml');
    this.authFile = path.join(this.configDir, 'auth.json');
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
    // 确保统一配置目录存在
    ensureConfigDir();
    
    // 确保Codex专用目录存在（用于存放实际的config.toml和auth.json）
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
      console.log(chalk.green(`创建Codex配置目录: ${this.configDir}`));
    }
  }

  /**
   * 读取配置列表
   */
  readConfigs() {
    return getConfigsByPlatform('codex');
  }

  /**
   * 保存配置列表（该方法不再需要，配置通过统一管理器处理）
   */
  writeConfigs(configs) {
    // 该方法已废弃，配置通过addConfigToUnified统一管理
    console.warn(chalk.yellow('writeConfigs方法已废弃，请使用addConfigToUnified'));
  }

  /**
   * 读取当前的config.toml文件
   */
  readConfigToml() {
    try {
      if (!fs.existsSync(this.configFile)) {
        return null;
      }
      return fs.readFileSync(this.configFile, 'utf8');
    } catch (error) {
      console.error(chalk.red(`读取config.toml失败: ${error.message}`));
      return null;
    }
  }

  /**
   * 读取当前的auth.json文件
   */
  readAuthJson() {
    try {
      if (!fs.existsSync(this.authFile)) {
        return null;
      }
      const data = fs.readFileSync(this.authFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(chalk.red(`读取auth.json失败: ${error.message}`));
      return null;
    }
  }

  /**
   * 生成config.toml内容
   */
  generateConfigToml(alias, url) {
    return `model_provider = "ccs"
model = "gpt-5-codex"
preferred_auth_method = "apikey"
disable_response_storage = true
network_access = "enabled"

[model_providers.ccs]
name = "${alias}"
base_url = "${url}"
wire_api = "responses"
requires_openai_auth = true
`;
  }

  /**
   * 生成auth.json内容
   */
  generateAuthJson(key) {
    return {
      "OPENAI_API_KEY": key
    };
  }

  /**
   * 添加新配置
   */
  addConfig(alias, key, url) {
    if (!this.validateConfig(key, url)) {
      throw new Error('无效的配置参数');
    }
    
    // 创建新配置对象
    const newConfig = {
      name: alias,
      platform: 'codex',
      config: {
        key: key,
        url: url,
        tomlContent: this.generateConfigToml(alias, url),
        authContent: this.generateAuthJson(key)
      }
    };

    addConfigToUnified(newConfig);
    return newConfig;
  }

  /**
   * 激活配置（写入到config.toml和auth.json）
   */
  activateConfig(config) {
    try {
      this.ensureConfigDir();
      
      // 写入config.toml
      fs.writeFileSync(this.configFile, config.config.tomlContent, 'utf8');
      
      // 写入auth.json
      fs.writeFileSync(this.authFile, JSON.stringify(config.config.authContent, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error(chalk.red(`激活Codex配置失败: ${error.message}`));
      return false;
    }
  }

  /**
   * 获取当前激活的配置
   */
  getCurrentConfig() {
    const currentAuth = this.readAuthJson();
    const currentToml = this.readConfigToml();
    
    if (!currentAuth || !currentToml) {
      return null;
    }

    const configs = this.readConfigs();
    
    // 通过API密钥匹配当前配置
    return configs.find(config => 
      config.config && 
      config.config.authContent && 
      config.config.authContent.OPENAI_API_KEY === currentAuth.OPENAI_API_KEY
    ) || null;
  }

  /**
   * 验证配置参数
   */
  validateConfig(key, url) {
    if (!super.validateConfig(key, url)) {
      return false;
    }
    
    // Codex特定的验证
    if (!key.startsWith('sk-')) {
      console.log(chalk.yellow('警告: API密钥通常以"sk-"开头'));
    }
    
    return true;
  }

  /**
   * 获取平台显示名称
   */
  getDisplayName() {
    return 'Codex';
  }

  /**
   * 获取配置的摘要信息
   * @param {Object} config 配置对象
   * @returns {Object} 包含 key, url, maskedKey 的对象
   */
  getConfigSummary(config) {
    if (!config || !config.config) {
      return {
        key: 'N/A',
        url: 'N/A',
        maskedKey: 'N/A'
      };
    }

    // Codex 配置可能在 config.key 或 config.authContent.OPENAI_API_KEY
    const key = config.config.key ||
                (config.config.authContent && config.config.authContent.OPENAI_API_KEY) ||
                'N/A';
    const url = config.config.url || 'N/A';

    return {
      key,
      url,
      maskedKey: this.maskKey(key)
    };
  }
}

module.exports = CodexAdapter;