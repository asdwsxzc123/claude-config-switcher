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
model = "gpt-5.1-codex"
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
   * 只保存必要的 key 和 url，不保存生成的内容
   * 配置内容在激活时动态生成，确保始终使用最新的模板
   */
  addConfig(alias, key, url) {
    if (!this.validateConfig(key, url)) {
      throw new Error('无效的配置参数');
    }

    // 创建新配置对象，只保存原始数据
    const newConfig = {
      name: alias,
      platform: 'codex',
      config: {
        key: key,
        url: url
      }
    };

    addConfigToUnified(newConfig);
    return newConfig;
  }

  /**
   * 激活配置（写入到config.toml和auth.json）
   * 动态生成配置内容，确保使用最新的模板
   * 同时清理可能存在的 env_key 字段
   */
  activateConfig(config) {
    try {
      this.ensureConfigDir();

      // 从配置中获取原始数据
      const { key, url } = config.config;
      const alias = config.name;

      // 动态生成配置内容（使用最新的模板）
      let tomlContent = this.generateConfigToml(alias, url);
      const authContent = this.generateAuthJson(key);

      // 清理 env_key 字段（删除包含 env_key 的行）
      tomlContent = this.cleanEnvKey(tomlContent);

      // 写入config.toml
      fs.writeFileSync(this.configFile, tomlContent, 'utf8');

      // 写入auth.json
      fs.writeFileSync(this.authFile, JSON.stringify(authContent, null, 2), 'utf8');

      // 检查并清理现有的 config.toml 中的 env_key
      this.cleanExistingConfigFile();

      return true;
    } catch (error) {
      console.error(chalk.red(`激活Codex配置失败: ${error.message}`));
      return false;
    }
  }

  /**
   * 清理配置内容中的 env_key 字段
   * @param {string} content - TOML 配置内容
   * @returns {string} 清理后的配置内容
   */
  cleanEnvKey(content) {
    if (!content) return content;

    // 删除包含 env_key 的行（支持多种格式）
    const lines = content.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmedLine = line.trim();
      // 过滤掉以 env_key 开头的行
      return !trimmedLine.startsWith('env_key');
    });

    return cleanedLines.join('\n');
  }

  /**
   * 清理现有配置文件中的 env_key 字段
   * 确保即使配置文件已存在，也能清理掉 env_key
   */
  cleanExistingConfigFile() {
    try {
      // 如果配置文件存在，读取并清理
      if (fs.existsSync(this.configFile)) {
        const existingContent = fs.readFileSync(this.configFile, 'utf8');
        const cleanedContent = this.cleanEnvKey(existingContent);

        // 只有内容发生变化时才重新写入
        if (existingContent !== cleanedContent) {
          fs.writeFileSync(this.configFile, cleanedContent, 'utf8');
          console.log(chalk.green('已清理 config.toml 中的 env_key 字段'));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`清理配置文件时出现警告: ${error.message}`));
    }
  }

  /**
   * 获取当前激活的配置
   * 通过比对当前的 auth.json 中的 API 密钥来匹配配置
   */
  getCurrentConfig() {
    const currentAuth = this.readAuthJson();
    const currentToml = this.readConfigToml();

    if (!currentAuth || !currentToml) {
      return null;
    }

    const configs = this.readConfigs();

    // 通过API密钥匹配当前配置
    // 新的配置结构中，key 直接存储在 config.key 中
    return configs.find(config =>
      config.config &&
      config.config.key === currentAuth.OPENAI_API_KEY
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

    // 新配置结构直接存储在 config.key 和 config.url 中
    // 保留对旧配置结构的兼容（authContent）
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