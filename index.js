#!/usr/bin/env node

/**
 * Claude配置切换工具
 * 用于在不同的Claude API配置之间进行切换
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const os = require('os');
const readline = require('readline');
const inquirer = require('inquirer');

// 版本号
const VERSION = '1.1.0';

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.claude');
const API_CONFIGS_FILE = path.join(CONFIG_DIR, 'apiConfigs.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');

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
 * 列出所有可用的API配置并提示用户选择（同时支持交互式菜单和序号输入）
 */
function listAndSelectConfig() {
  const apiConfigs = readApiConfigs();
  
  if (apiConfigs.length === 0) {
    console.log(chalk.yellow('没有找到可用的API配置'));
    process.exit(0);
  }
  
  // 获取当前激活的配置
  const currentConfig = getCurrentConfig();
  
  // 如果有当前激活的配置，显示它
  if (currentConfig) {
    console.log(chalk.green('当前激活的配置: ') + chalk.white(currentConfig.name));
    console.log();
  }
  
  // 找出最长的名称长度，用于对齐
  const maxNameLength = apiConfigs.reduce((max, config) => 
    Math.max(max, config.name.length), 0);
  
  // 准备选项列表
  const choices = apiConfigs.map((config, index) => {
    // 如果是当前激活的配置，添加标记
    const isActive = currentConfig && config.name === currentConfig.name;
    
    // 格式化配置信息：[name] key url，name对齐，密钥不格式化
    const paddedName = config.name.padEnd(maxNameLength, ' ');
    const configInfo = `[${paddedName}]  ${config.config.env.ANTHROPIC_AUTH_TOKEN}  ${config.config.env.ANTHROPIC_BASE_URL}`;
    
    return {
      name: `${index + 1}. ${configInfo}${isActive ? chalk.green(' (当前)') : ''}`,
      value: index
    };
  });
  
  // 添加一个输入选项
  choices.push(new inquirer.Separator());
  choices.push({
    name: '输入序号...',
    value: 'input',
    disabled: ' ' // 让输入序号选项不可选中
  });
  
  // 使用inquirer创建交互式菜单
  inquirer
    .prompt([
      {
        type: 'list',
        name: 'configIndex',
        message: '请选择要切换的配置:',
        choices: choices,
        pageSize: choices.length, // 显示所有选项，确保"输入序号..."始终在底部
        // 设置更宽的显示宽度以支持长配置信息
        prefix: '',
        suffix: '',
      }
    ])
    .then(answers => {
      // 如果用户选择了"输入序号"选项
      if (answers.configIndex === 'input') {
        // 显示配置列表以供参考
        console.log(chalk.cyan('\n可用的API配置:'));
        apiConfigs.forEach((config, index) => {
          const isActive = currentConfig && config.name === currentConfig.name;
          const activeMarker = isActive ? chalk.green(' (当前)') : '';
          const paddedName = config.name.padEnd(maxNameLength, ' ');
          const configInfo = `[${paddedName}]  ${config.config.env.ANTHROPIC_AUTH_TOKEN}  ${config.config.env.ANTHROPIC_BASE_URL}`;
          console.log(chalk.white(` ${index + 1}. ${configInfo}${activeMarker}`));
        });
        
        const rl = createReadlineInterface();
        
        rl.question(chalk.cyan('\n请输入配置序号 (1-' + apiConfigs.length + '): '), (indexAnswer) => {
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
          
          processSelectedConfig(selectedConfig);
          rl.close();
        });
        return;
      }
      
      // 用户通过交互式菜单选择了配置
      const selectedIndex = answers.configIndex;
      const selectedConfig = apiConfigs[selectedIndex];
      
      // 如果选择的配置就是当前激活的配置，提示用户
      if (currentConfig && selectedConfig.name === currentConfig.name) {
        console.log(chalk.yellow(`\n配置 "${selectedConfig.name}" 已经是当前激活的配置`));
        return;
      }
      
      processSelectedConfig(selectedConfig);
    })
    .catch(error => {
      console.error(chalk.red(`发生错误: ${error.message}`));
    });
}

/**
 * 处理用户选择的配置
 * @param {Object} selectedConfig 选择的配置对象
 */
function processSelectedConfig(selectedConfig) {
  console.log(chalk.cyan('\n当前选择的配置:'));
  console.log(JSON.stringify(selectedConfig, null, 2));
  
  inquirer
    .prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认切换到此配置?',
        default: true // 修改默认值为true，按Enter键表示确认
      }
    ])
    .then(confirmAnswer => {
      if (confirmAnswer.confirm) {
        // 直接使用选择的配置替换整个settings.json
        saveSettings(selectedConfig.config);
        
        console.log(chalk.green(`\n成功切换到配置: ${selectedConfig.name}`));
      } else {
        console.log(chalk.yellow('\n操作已取消'));
      }
    });
}

/**
 * 列出所有可用的API配置
 */
function listConfigs() {
  const apiConfigs = readApiConfigs();
  
  if (apiConfigs.length === 0) {
    console.log(chalk.yellow('没有找到可用的API配置'));
    return;
  }
  
  console.log(chalk.cyan('可用的API配置:'));
  apiConfigs.forEach((config, index) => {
    console.log(chalk.white(` ${index + 1}. ${config.name}`));
  });
}

/**
 * 设置当前使用的API配置（使用交互式确认）
 * @param {number} index 配置索引
 */
function setConfig(index) {
  const apiConfigs = readApiConfigs();
  
  if (apiConfigs.length === 0) {
    console.log(chalk.yellow('没有找到可用的API配置'));
    return;
  }
  
  // 检查索引是否有效
  if (index < 1 || index > apiConfigs.length) {
    console.error(chalk.red(`无效的索引: ${index}，有效范围: 1-${apiConfigs.length}`));
    return;
  }
  
  const selectedConfig = apiConfigs[index - 1];
  
  // 显示当前选择的配置
  console.log(chalk.cyan('当前选择的配置:'));
  console.log(JSON.stringify(selectedConfig, null, 2));
  
  // 使用inquirer进行确认
  inquirer
    .prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认切换到此配置?',
        default: true // 修改默认值为true，按Enter键表示确认
      }
    ])
    .then(answers => {
      if (answers.confirm) {
        // 直接使用选择的配置替换整个settings.json
        saveSettings(selectedConfig.config);
        
        console.log(chalk.green(`\n成功切换到配置: ${selectedConfig.name}`));
      } else {
        console.log(chalk.yellow('\n操作已取消'));
      }
    })
    .catch(error => {
      console.error(chalk.red(`发生错误: ${error.message}`));
    });
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
 * 显示版本信息
 */
function showVersion() {
  console.log(`ccs 版本: ${VERSION}`);
}

// 设置命令行程序
program
  .name('ccs')
  .description('Claude配置切换工具')
  .version(VERSION, '-v, --version', '显示版本信息');

program
  .command('list')
  .description('列出所有可用的API配置并提示选择')
  .action(() => {
    ensureConfigDir();
    listAndSelectConfig();
  });

program
  .command('use <index>')
  .description('设置当前使用的API配置')
  .action((index) => {
    ensureConfigDir();
    setConfig(parseInt(index, 10));
  });

program
  .command('current')
  .description('显示当前激活的配置')
  .action(() => {
    ensureConfigDir();
    showCurrentConfig();
  });

// 添加错误处理
program.on('command:*', (operands) => {
  console.error(chalk.red(`错误: 未知命令 '${operands[0]}'`));
  const availableCommands = program.commands.map(cmd => cmd.name());
  console.log(chalk.cyan('\n可用命令:'));
  availableCommands.forEach(cmd => {
    console.log(`  ${cmd}`);
  });
  console.log(chalk.cyan('\n使用 --help 查看更多信息'));
  process.exit(1);
});

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0); // 添加process.exit(0)确保程序在显示帮助信息后退出
}

program.parse(process.argv); 