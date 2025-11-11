const path = require('path');
const os = require('os');

/**
 * 平台适配器基类
 * 定义所有平台必须实现的接口
 */
class PlatformAdapter {
  constructor(name) {
    if (this.constructor === PlatformAdapter) {
      throw new Error('PlatformAdapter是抽象类，不能直接实例化');
    }
    this.name = name;
  }

  /**
   * 获取平台配置目录
   * @returns {string} 配置目录路径
   */
  getConfigDir() {
    throw new Error('子类必须实现getConfigDir方法');
  }

  /**
   * 确保配置目录存在
   */
  ensureConfigDir() {
    throw new Error('子类必须实现ensureConfigDir方法');
  }

  /**
   * 读取配置列表
   * @returns {Array} 配置数组
   */
  readConfigs() {
    throw new Error('子类必须实现readConfigs方法');
  }

  /**
   * 保存配置列表
   * @param {Array} configs 配置数组
   */
  writeConfigs(configs) {
    throw new Error('子类必须实现writeConfigs方法');
  }

  /**
   * 添加新配置
   * @param {string} alias 配置别名
   * @param {string} key API密钥
   * @param {string} url 基础URL
   */
  addConfig(alias, key, url) {
    throw new Error('子类必须实现addConfig方法');
  }

  /**
   * 激活配置
   * @param {Object} config 配置对象
   */
  activateConfig(config) {
    throw new Error('子类必须实现activateConfig方法');
  }

  /**
   * 获取当前激活的配置
   * @returns {Object|null} 当前配置或null
   */
  getCurrentConfig() {
    throw new Error('子类必须实现getCurrentConfig方法');
  }

  /**
   * 验证配置格式是否正确
   * @param {string} key API密钥
   * @param {string} url 基础URL
   * @returns {boolean} 是否有效
   */
  validateConfig(key, url) {
    return key && url && key.trim() !== '' && url.trim() !== '';
  }

  /**
   * 获取平台显示名称
   * @returns {string} 显示名称
   */
  getDisplayName() {
    return this.name;
  }

  /**
   * 获取配置的摘要信息（用于列表显示）
   * @param {Object} config 配置对象
   * @returns {Object} 包含 key, url, maskedKey 的对象
   */
  getConfigSummary(config) {
    throw new Error('子类必须实现getConfigSummary方法');
  }

  /**
   * 对 API Key 进行脱敏处理
   * 显示前10个字符和后4个字符，中间用...代替
   * @param {string} key API密钥
   * @returns {string} 脱敏后的密钥
   */
  maskKey(key) {
    if (!key || typeof key !== 'string') {
      return 'N/A';
    }

    if (key.length <= 14) {
      // 如果key太短，只显示前几位
      return key.substring(0, Math.min(6, key.length)) + '...';
    }

    // 显示前10位和后4位
    return key.substring(0, 10) + '...' + key.substring(key.length - 4);
  }
}

module.exports = PlatformAdapter;