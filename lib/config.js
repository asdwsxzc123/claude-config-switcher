const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.claude');
const API_CONFIGS_FILE = path.join(CONFIG_DIR, 'apiConfigs.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const CLAUDE_MD_FILE = path.join(CONFIG_DIR, 'CLAUDE.md');

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
 * 读取API配置文件
 * @returns {Array} API配置数组
 */
function readApiConfigs() {
  try {
    if (!fs.existsSync(API_CONFIGS_FILE)) {
      console.log(chalk.yellow(`警告: API配置文件不存在 (${API_CONFIGS_FILE})`));
      return [];
    }

    const data = fs.readFileSync(API_CONFIGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red(`读取API配置文件失败: ${error.message}`));
    return [];
  }
}

/**
 * 读取settings.json文件
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
 * 写入API配置文件
 * @param {Array} apiConfigs API配置数组
 */
function writeApiConfigs(apiConfigs) {
  try {
    ensureConfigDir();
    fs.writeFileSync(API_CONFIGS_FILE, JSON.stringify(apiConfigs, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red(`写入API配置文件失败: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 写入settings.json文件
 * @param {Object} settings 设置对象
 */
function writeSettings(settings) {
  try {
    ensureConfigDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red(`写入设置文件失败: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 保存settings.json文件
 * @param {Object} settings 设置对象
 */
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error(chalk.red(`保存设置文件失败: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 深度比较两个对象是否相等
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns {boolean}
 */
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (let key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * 获取当前激活的API配置
 * @returns {Object|null} 当前激活的配置对象或null（如果没有找到）
 */
function getCurrentConfig() {
  const settings = readSettings();

  // 如果settings为空，返回null
  if (!settings || Object.keys(settings).length === 0) {
    return null;
  }

  // 查找匹配的配置
  const apiConfigs = readApiConfigs();
  return apiConfigs.find(config =>
    config.config && deepEqual(settings, config.config)
  ) || null;
}

/**
 * 显示当前激活的配置
 */
function showCurrentConfig() {
  const currentConfig = getCurrentConfig();

  if (currentConfig) {
    console.log(chalk.green('当前激活的配置: ') + chalk.white(currentConfig.name));
    console.log();
    console.log(chalk.cyan('配置详情:'));
    console.log(JSON.stringify(currentConfig, null, 2));
  } else {
    console.log(chalk.yellow('当前没有激活的配置'));
  }
}

/**
 * 添加新的API配置
 * @param {string} alias 配置别名
 * @param {string} key API密钥
 * @param {string} url 基础URL
 */
function addApiConfig(alias, key, url) {
  try {
    const apiConfigs = readApiConfigs();

    // 检查别名是否已存在
    const existingConfig = apiConfigs.find(config => config.name === alias);
    if (existingConfig) {
      console.log(chalk.yellow(`警告: 别名 "${alias}" 已存在，将被覆盖`));
    }

    // 创建新配置
    const newConfig = {
      name: alias,
      config: {
        env: {
          ANTHROPIC_AUTH_TOKEN: key,
          ANTHROPIC_BASE_URL: url,
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
        },
        permissions: {
          allow: [],
          deny: []
        }
      }
    };

    // 如果别名已存在，替换；否则添加
    if (existingConfig) {
      const index = apiConfigs.findIndex(config => config.name === alias);
      apiConfigs[index] = newConfig;
    } else {
      apiConfigs.push(newConfig);
    }

    // 保存配置文件
    writeApiConfigs(apiConfigs);

    console.log(chalk.green(`成功添加配置: ${alias}`));
    console.log(chalk.cyan('配置详情:'));
    console.log(JSON.stringify(newConfig, null, 2));
  } catch (error) {
    console.error(chalk.red(`添加配置失败: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 读取CLAUDE.md文件
 * @returns {string|null} 文件内容或null
 */
function readClaudeMd() {
  try {
    if (!fs.existsSync(CLAUDE_MD_FILE)) {
      return null;
    }
    return fs.readFileSync(CLAUDE_MD_FILE, 'utf8');
  } catch (error) {
    console.error(chalk.red(`读取CLAUDE.md文件失败: ${error.message}`));
    return null;
  }
}

/**
 * 写入CLAUDE.md文件
 * @param {string} content 文件内容
 */
function writeClaudeMd(content) {
  try {
    ensureConfigDir();
    fs.writeFileSync(CLAUDE_MD_FILE, content, 'utf8');
  } catch (error) {
    console.error(chalk.red(`写入CLAU DE.md文件失败: ${error.message}`));
    throw error;
  }
}

module.exports = {
  CONFIG_DIR,
  API_CONFIGS_FILE,
  SETTINGS_FILE,
  CLAUDE_MD_FILE,
  ensureConfigDir,
  readApiConfigs,
  writeApiConfigs,
  readSettings,
  writeSettings,
  saveSettings,
  deepEqual,
  getCurrentConfig,
  showCurrentConfig,
  addApiConfig,
  readClaudeMd,
  writeClaudeMd
};