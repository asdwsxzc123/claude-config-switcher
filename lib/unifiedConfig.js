const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

/**
 * 统一配置管理器
 * 所有平台的配置都存储在单一的apiConfigs.json文件中
 */

// 配置文件路径 - 沿用Claude的配置目录
const CONFIG_DIR = path.join(os.homedir(), '.claude');
const API_CONFIGS_FILE = path.join(CONFIG_DIR, 'apiConfigs.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');

/**
 * 确保配置目录存在
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(chalk.green(`创建配置目录: ${CONFIG_DIR}`));
  }
}

/**
 * 读取统一的配置列表
 * @returns {Array} 所有平台的配置数组
 */
function readAllConfigs() {
  try {
    if (!fs.existsSync(API_CONFIGS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(API_CONFIGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red(`读取配置文件失败: ${error.message}`));
    return [];
  }
}

/**
 * 写入统一的配置列表
 * @param {Array} configs 所有平台的配置数组
 */
function writeAllConfigs(configs) {
  try {
    ensureConfigDir();
    fs.writeFileSync(API_CONFIGS_FILE, JSON.stringify(configs, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red(`写入配置文件失败: ${error.message}`));
    throw error;
  }
}

/**
 * 获取指定平台的配置列表
 * @param {string} platform 平台名称
 * @returns {Array} 该平台的配置数组
 */
function getConfigsByPlatform(platform) {
  const allConfigs = readAllConfigs();
  return allConfigs.filter(config => config.platform === platform);
}

/**
 * 添加配置到统一配置文件
 * @param {Object} config 配置对象（必须包含platform字段）
 */
function addConfigToUnified(config) {
  const allConfigs = readAllConfigs();
  
  // 检查同名配置是否已存在
  const existingIndex = allConfigs.findIndex(
    c => c.name === config.name && c.platform === config.platform
  );
  
  if (existingIndex >= 0) {
    console.log(chalk.yellow(`警告: 配置 "${config.name}" [${config.platform}] 已存在，将被覆盖`));
    allConfigs[existingIndex] = config;
  } else {
    allConfigs.push(config);
  }
  
  writeAllConfigs(allConfigs);
}

/**
 * 删除指定配置
 * @param {string} name 配置名称
 * @param {string} platform 平台名称
 * @returns {boolean} 是否删除成功
 */
function removeConfig(name, platform) {
  const allConfigs = readAllConfigs();
  const initialLength = allConfigs.length;
  
  const filteredConfigs = allConfigs.filter(
    config => !(config.name === name && config.platform === platform)
  );
  
  if (filteredConfigs.length < initialLength) {
    writeAllConfigs(filteredConfigs);
    return true;
  }
  
  return false;
}

/**
 * 根据名称和平台查找配置
 * @param {string} name 配置名称
 * @param {string} platform 平台名称
 * @returns {Object|null} 配置对象或null
 */
function findConfig(name, platform) {
  const allConfigs = readAllConfigs();
  return allConfigs.find(
    config => config.name === name && config.platform === platform
  ) || null;
}

/**
 * 读取设置文件
 * @returns {Object} 设置对象
 */
function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { env: {} };
    }
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red(`读取设置文件失败: ${error.message}`));
    return { env: {} };
  }
}

/**
 * 写入设置文件
 * @param {Object} settings 设置对象
 */
function writeSettings(settings) {
  try {
    ensureConfigDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red(`写入设置文件失败: ${error.message}`));
    throw error;
  }
}

/**
 * 迁移旧的配置文件到统一格式
 * 从分散的配置文件迁移到统一的apiConfigs.json
 */
function migrateOldConfigs() {
  const allConfigs = readAllConfigs();
  let hasChanges = false;
  
  // 迁移Codex配置
  const codexConfigsFile = path.join(os.homedir(), '.codex', 'configs.json');
  if (fs.existsSync(codexConfigsFile)) {
    try {
      const codexConfigs = JSON.parse(fs.readFileSync(codexConfigsFile, 'utf8'));
      
      for (const config of codexConfigs) {
        // 检查是否已经在统一配置中
        const exists = allConfigs.some(
          c => c.name === config.name && c.platform === 'codex'
        );
        
        if (!exists) {
          allConfigs.push(config);
          hasChanges = true;
          console.log(chalk.blue(`迁移Codex配置: ${config.name}`));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`迁移Codex配置失败: ${error.message}`));
    }
  }
  
  // 确保现有Claude配置都有platform字段
  for (const config of allConfigs) {
    if (!config.platform) {
      config.platform = 'claude';
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    writeAllConfigs(allConfigs);
    console.log(chalk.green('配置迁移完成'));
  }
}

/**
 * 获取配置的显示信息
 * @param {Object} config 配置对象
 * @returns {Object} 包含显示信息的对象
 */
function getConfigDisplayInfo(config) {
  const platformMap = {
    'claude': 'Claude',
    'codex': 'Codex'
  };
  
  return {
    name: config.name,
    platform: config.platform,
    displayName: platformMap[config.platform] || config.platform,
    platformTag: `[${platformMap[config.platform] || config.platform}]`
  };
}

module.exports = {
  CONFIG_DIR,
  API_CONFIGS_FILE,
  SETTINGS_FILE,
  ensureConfigDir,
  readAllConfigs,
  writeAllConfigs,
  getConfigsByPlatform,
  addConfigToUnified,
  removeConfig,
  findConfig,
  readSettings,
  writeSettings,
  migrateOldConfigs,
  getConfigDisplayInfo
};