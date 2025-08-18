const chalk = require('chalk');
const inquirer = require('inquirer');
const { readApiConfigs, getCurrentConfig, saveSettings } = require('./config');
const { readWebdavConfig, uploadConfigs } = require('./webdav');
const { formatConfigChoices, handleManualInput, isCurrentConfig } = require('./selector');

/**
 * 处理用户选择的配置
 * @param {Object} selectedConfig 选择的配置对象
 */
async function processSelectedConfig(selectedConfig) {
  console.log(chalk.cyan('\n当前选择的配置:'));
  console.log(JSON.stringify(selectedConfig, null, 2));
  
  const confirmAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确认切换到此配置?',
      default: true
    }
  ]);

  if (confirmAnswer.confirm) {
    // 直接使用选择的配置替换整个settings.json
    saveSettings(selectedConfig.config);
    
    console.log(chalk.green(`\n成功切换到配置: ${selectedConfig.name}`));
    
    // 询问是否上传到WebDAV
    const webdavConfig = readWebdavConfig();
    if (webdavConfig.url && webdavConfig.username && webdavConfig.password) {
      const uploadAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'upload',
          message: '是否上传当前配置到WebDAV网盘?',
          default: false
        }
      ]);
      
      if (uploadAnswer.upload) {
        await uploadConfigs();
      }
    }
  } else {
    console.log(chalk.yellow('\n操作已取消'));
  }
}

/**
 * 列出所有可用的API配置并提示用户选择
 */
async function listAndSelectConfig() {
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
  
  const { choices, maxNameLength } = formatConfigChoices(apiConfigs, currentConfig);
  
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'configIndex',
        message: '请选择要切换的配置:',
        choices: choices,
        pageSize: choices.length,
        prefix: '',
        suffix: '',
      }
    ]);
    
    // 如果用户选择了"输入序号"选项
    if (answers.configIndex === 'input') {
      handleManualInput(apiConfigs, currentConfig, maxNameLength, processSelectedConfig);
      return;
    }
    
    // 用户通过交互式菜单选择了配置
    const selectedIndex = answers.configIndex;
    const selectedConfig = apiConfigs[selectedIndex];
    
    // 如果选择的配置就是当前激活的配置，提示用户
    if (isCurrentConfig(selectedConfig, currentConfig)) {
      console.log(chalk.yellow(`\n配置 "${selectedConfig.name}" 已经是当前激活的配置`));
      return;
    }
    
    await processSelectedConfig(selectedConfig);
  } catch (error) {
    console.error(chalk.red(`发生错误: ${error.message}`));
  }
}

/**
 * 设置当前使用的API配置（使用交互式确认）
 * @param {number} index 配置索引
 */
async function setConfig(index) {
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
  
  try {
    await processSelectedConfig(selectedConfig);
  } catch (error) {
    console.error(chalk.red(`发生错误: ${error.message}`));
  }
}

module.exports = {
  processSelectedConfig,
  listAndSelectConfig,
  setConfig
};