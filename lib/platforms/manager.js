const ClaudeAdapter = require('./claude');
const CodexAdapter = require('./codex');

/**
 * 平台管理器
 * 统一管理所有支持的平台适配器
 */
class PlatformManager {
  constructor() {
    // 初始化所有支持的平台
    this.platforms = {
      'claude': new ClaudeAdapter(),
      'codex': new CodexAdapter()
    };
  }

  /**
   * 获取支持的平台列表
   * @returns {Array} 平台名称数组
   */
  getSupportedPlatforms() {
    return Object.keys(this.platforms);
  }

  /**
   * 获取平台适配器
   * @param {string} platformName 平台名称
   * @returns {PlatformAdapter|null} 平台适配器实例
   */
  getPlatform(platformName) {
    if (!platformName) {
      // 默认返回Claude平台
      return this.platforms['claude'];
    }
    
    const normalizedName = platformName.toLowerCase();
    return this.platforms[normalizedName] || null;
  }

  /**
   * 检查平台是否支持
   * @param {string} platformName 平台名称
   * @returns {boolean} 是否支持
   */
  isSupported(platformName) {
    if (!platformName) return true; // 默认Claude平台
    const normalizedName = platformName.toLowerCase();
    return this.platforms.hasOwnProperty(normalizedName);
  }

  /**
   * 获取平台显示信息
   * @returns {Array} 平台信息数组
   */
  getPlatformInfo() {
    return Object.entries(this.platforms).map(([key, adapter]) => ({
      name: key,
      displayName: adapter.getDisplayName(),
      configDir: adapter.getConfigDir()
    }));
  }

  /**
   * 验证平台名称并返回规范化的名称
   * @param {string} platformName 平台名称
   * @returns {string|null} 规范化的平台名称或null（如果不支持）
   */
  validatePlatform(platformName) {
    if (!platformName) {
      return 'claude'; // 默认平台
    }
    
    const normalizedName = platformName.toLowerCase();
    return this.isSupported(normalizedName) ? normalizedName : null;
  }
}

// 导出单例实例
module.exports = new PlatformManager();