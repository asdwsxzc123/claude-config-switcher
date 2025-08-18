const chalk = require('chalk');
const inquirer = require('inquirer');
const readline = require('readline');
const { readApiConfigs, getCurrentConfig } = require('./config');

/**
 * 创建readline接口
 * @returns {readline.Interface} readline接口
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * 格式化API token显示
 * @param {string} token API token
 * @returns {string} 格式化的token
 */
function formatToken(token) {
  if (!token) {
    // 返回和正常token格式长度一致的N/A，格式为 xx-xxxx...xxxx (15位)
    return 'N/A'.padEnd(15, ' '); // 13个字符，与 sk-xxxx...xxxx 长度一致
  }
  // 显示前8位和后4位，中间用...代替
  if (token.length <= 12) return token.padEnd(13, ' '); // 确保短token也有相同长度
  return token.slice(0, 8) + '...' + token.slice(-4);
}

/**
 * 格式化配置选项列表
 * @param {Array} apiConfigs API配置数组
 * @param {Object} currentConfig 当前配置
 * @returns {Array} 格式化的选项列表
 */
function formatConfigChoices(apiConfigs, currentConfig) {
  // 计算最长的名称长度，用于对齐
  const maxNameLength = Math.max(
    8, // 最小长度
    apiConfigs.reduce((max, config) => Math.max(max, config.name.length), 0)
  );
  
  // 计算最长的URL长度，用于对齐
  const maxUrlLength = Math.max(
    20, // 最小长度
    apiConfigs.reduce((max, config) => {
      const url = config.config?.env?.ANTHROPIC_BASE_URL || '';
      return Math.max(max, url.length);
    }, 0)
  );
  
  // 计算最长的COST长度，用于对齐
  const maxCostLength = Math.max(
    4, // 最小长度 "COST"
    apiConfigs.reduce((max, config) => {
      const cost = config.config?.env?.COST || 'N/A';
      return Math.max(max, cost.length);
    }, 0)
  );
  
  // 准备选项列表
  const choices = apiConfigs.map((config, index) => {
    // 如果是当前激活的配置，添加标记
    const isActive = currentConfig && config.name === currentConfig.name;
    
    // 格式化各个字段
    const paddedName = config.name.padEnd(maxNameLength, ' ');
    const token = formatToken(config.config?.env?.ANTHROPIC_AUTH_TOKEN || '');
    const url = (config.config?.env?.ANTHROPIC_BASE_URL || '').padEnd(maxUrlLength, ' ');
    const cost = (config.config?.env?.COST || 'N/A').padEnd(maxCostLength, ' ');
    
    // 组合配置信息，使用更美观的格式
    const configInfo = `[${chalk.cyan(paddedName)}] ${chalk.yellow(token)} ${chalk.blue(url)} ${chalk.magenta(cost)}`;
    
    return {
      name: `${index + 1}. ${configInfo}${isActive ? chalk.green(' (当前)') : ''}`,
      value: index
    };
  });
  
  // 添加一个分隔符和输入选项
  choices.push(new inquirer.Separator('──────────────'));
  choices.push({
    name: chalk.gray('输入序号...'),
    value: 'input',
    disabled: ' '
  });

  return { choices, maxNameLength };
}

/**
 * 显示配置列表供手动输入参考
 * @param {Array} apiConfigs API配置数组
 * @param {Object} currentConfig 当前配置
 * @param {number} maxNameLength 最大名称长度
 */
function displayConfigList(apiConfigs, currentConfig, maxNameLength) {
  // 计算最长的URL长度，用于对齐
  const maxUrlLength = Math.max(
    20, // 最小长度
    apiConfigs.reduce((max, config) => {
      const url = config.config?.env?.ANTHROPIC_BASE_URL || '';
      return Math.max(max, url.length);
    }, 0)
  );
  
  // 计算最长的COST长度，用于对齐
  const maxCostLength = Math.max(
    4, // 最小长度 "COST"
    apiConfigs.reduce((max, config) => {
      const cost = config.config?.env?.COST || 'N/A';
      return Math.max(max, cost.length);
    }, 0)
  );

  console.log(chalk.cyan('\n可用的API配置:'));
  apiConfigs.forEach((config, index) => {
    const isActive = currentConfig && config.name === currentConfig.name;
    const activeMarker = isActive ? chalk.green(' (当前)') : '';
    
    // 格式化各个字段，与选择界面保持一致
    const paddedName = config.name.padEnd(maxNameLength, ' ');
    const token = formatToken(config.config?.env?.ANTHROPIC_AUTH_TOKEN || '');
    const url = (config.config?.env?.ANTHROPIC_BASE_URL || '').padEnd(maxUrlLength, ' ');
    const cost = (config.config?.env?.COST || 'N/A').padEnd(maxCostLength, ' ');
    
    // 组合配置信息
    const configInfo = `[${chalk.cyan(paddedName)}] ${chalk.yellow(token)} ${chalk.blue(url)} ${chalk.magenta(cost)}`;
    console.log(` ${index + 1}. ${configInfo}${activeMarker}`);
  });
}

/**
 * 处理手动输入序号选择
 * @param {Array} apiConfigs API配置数组
 * @param {Object} currentConfig 当前配置
 * @param {number} maxNameLength 最大名称长度
 * @param {Function} callback 处理选择的回调函数
 */
function handleManualInput(apiConfigs, currentConfig, maxNameLength, callback) {
  displayConfigList(apiConfigs, currentConfig, maxNameLength);
  
  const rl = createReadlineInterface();
  
  rl.question(chalk.cyan('\n请输入配置序号 (1-' + apiConfigs.length + '): '), async (indexAnswer) => {
    const index = parseInt(indexAnswer, 10);
    
    if (isNaN(index) || index < 1 || index > apiConfigs.length) {
      console.error(chalk.red(`无效的序号: ${indexAnswer}，有效范围: 1-${apiConfigs.length}`));
      rl.close();
      return;
    }
    
    const selectedConfig = apiConfigs[index - 1];
    
    // 如果选择的配置就是当前激活的配置，提示用户
    if (currentConfig && selectedConfig.name === currentConfig.name) {
      console.log(chalk.yellow(`\n配置 "${selectedConfig.name}" 已经是当前激活的配置`));
      rl.close();
      return;
    }
    
    await callback(selectedConfig);
    rl.close();
  });
}

/**
 * 检查是否选择了当前激活的配置
 * @param {Object} selectedConfig 选择的配置
 * @param {Object} currentConfig 当前配置
 * @returns {boolean} 是否是当前配置
 */
function isCurrentConfig(selectedConfig, currentConfig) {
  return currentConfig && selectedConfig.name === currentConfig.name;
}

module.exports = {
  createReadlineInterface,
  formatToken,
  formatConfigChoices,
  displayConfigList,
  handleManualInput,
  isCurrentConfig
};