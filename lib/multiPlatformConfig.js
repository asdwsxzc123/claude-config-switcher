const chalk = require('chalk');
const inquirer = require('inquirer');
const platformManager = require('./platforms/manager');
const { notifyConfigSwitch } = require('./webhook');
const { readAllConfigs, migrateOldConfigs } = require('./unifiedConfig');

/**
 * 多平台配置管理模块
 * 统一处理所有平台的配置列表、选择和切换
 */

/**
 * 获取所有平台的配置列表
 * @param {string} filterPlatform 过滤特定平台，不传则返回所有平台
 * @returns {Array} 配置列表，每个配置包含平台信息
 */
function getAllConfigs(filterPlatform = null) {
  // 在读取配置前先迁移旧配置
  migrateOldConfigs();
  
  const allConfigs = readAllConfigs();
  
  // 过滤特定平台
  if (filterPlatform) {
    return allConfigs.filter(config => config.platform === filterPlatform);
  }
  
  // 为配置添加显示信息
  return allConfigs.map((config, index) => {
    const adapter = platformManager.getPlatform(config.platform);
    return {
      ...config,
      platformDisplayName: adapter ? adapter.getDisplayName() : config.platform,
      originalIndex: index
    };
  });
}

/**
 * 格式化配置选项用于显示
 * @param {Array} configs 配置列表
 * @param {Object} currentConfig 当前配置
 * @returns {Object} 格式化后的选项和最大名称长度
 */
function formatMultiPlatformChoices(configs, currentConfig = null) {
  if (configs.length === 0) {
    return { choices: [], maxNameLength: 0 };
  }

  // 计算最大名称长度和最大平台标签长度用于对齐
  const maxNameLength = Math.max(...configs.map(config => config.name.length));
  const maxPlatformLength = Math.max(...configs.map(config => config.platformDisplayName.length));

  const choices = configs.map((config, index) => {
    const adapter = platformManager.getPlatform(config.platform);
    const summary = adapter ? adapter.getConfigSummary(config) : { maskedKey: 'N/A', url: 'N/A' };

    // 序号（从1开始，右对齐）
    const sequenceNumber = `${index + 1}`.padStart(2);

    const paddedName = config.name.padEnd(maxNameLength);
    const platformTag = `[${config.platformDisplayName}]`.padEnd(maxPlatformLength + 2);

    // 检查是否为当前激活的配置
    const isCurrent = isCurrentConfig(config, currentConfig);
    const currentMark = isCurrent ? ' (当前)' : '';

    // 格式: 序号. 名称 [平台] 脱敏Key URL (当前)
    const displayText = `${chalk.gray(sequenceNumber + '.')}  ${paddedName}  ${platformTag}  ${chalk.gray(summary.maskedKey)}  ${chalk.cyan(summary.url)}${currentMark}`;

    return {
      name: isCurrent ? chalk.green(displayText) : displayText,
      value: index
    };
  });

  // 如果配置数量很多，添加手动输入选项
  if (configs.length > 10) {
    choices.push(new inquirer.Separator());
    choices.push({
      name: chalk.gray('输入序号...'),
      value: 'input'
    });
  }

  return { choices, maxNameLength };
}

/**
 * 检查配置是否为当前激活的配置
 * @param {Object} config 配置对象
 * @param {Object} currentConfig 当前激活的配置
 * @returns {boolean} 是否为当前配置
 */
function isCurrentConfig(config, currentConfig) {
  if (!currentConfig || !config) return false;
  
  return currentConfig.platform === config.platform && 
         currentConfig.name === config.name;
}

/**
 * 获取当前激活的配置（跨平台）
 * @returns {Object|null} 当前激活的配置
 */
function getCurrentMultiPlatformConfig() {
  const platforms = platformManager.getSupportedPlatforms();
  
  for (const platformName of platforms) {
    try {
      const adapter = platformManager.getPlatform(platformName);
      const currentConfig = adapter.getCurrentConfig();
      
      if (currentConfig) {
        return {
          ...currentConfig,
          platform: platformName,
          platformDisplayName: adapter.getDisplayName()
        };
      }
    } catch (error) {
      console.warn(chalk.yellow(`检查${platformName}当前配置时出错: ${error.message}`));
    }
  }
  
  return null;
}

/**
 * 激活指定的配置
 * @param {Object} config 要激活的配置对象
 * @returns {boolean} 是否成功激活
 */
async function activateConfig(config) {
  try {
    // 获取切换前的配置（用于webhook通知）
    const previousConfig = getCurrentMultiPlatformConfig();
    
    const adapter = platformManager.getPlatform(config.platform);
    const success = adapter.activateConfig(config);
    
    if (success) {
      console.log(chalk.green(`成功切换到${config.platformDisplayName}配置: ${config.name}`));
      
      // 发送webhook通知（非阻塞）
      try {
        await notifyConfigSwitch(previousConfig, config);
      } catch (error) {
        console.warn(chalk.yellow(`webhook通知发送失败: ${error.message}`));
      }
      
      return true;
    } else {
      console.error(chalk.red(`切换${config.platformDisplayName}配置失败`));
      return false;
    }
  } catch (error) {
    console.error(chalk.red(`激活配置时出错: ${error.message}`));
    return false;
  }
}

/**
 * 显示当前激活的配置信息
 * @param {string} platform 指定平台，不传则显示所有平台
 */
function showCurrentMultiPlatformConfig(platform = null) {
  if (platform) {
    // 显示指定平台的当前配置
    const validPlatform = platformManager.validatePlatform(platform);
    if (!validPlatform) {
      console.log(chalk.red(`不支持的平台: ${platform}`));
      console.log(chalk.yellow(`支持的平台: ${platformManager.getSupportedPlatforms().join(', ')}`));
      return;
    }

    const adapter = platformManager.getPlatform(validPlatform);
    const currentConfig = adapter.getCurrentConfig();

    if (currentConfig) {
      const summary = adapter.getConfigSummary(currentConfig);

      console.log(chalk.green(`当前${adapter.getDisplayName()}配置: `) + chalk.white(currentConfig.name));
      console.log();
      console.log(chalk.cyan('配置详情:'));
      console.log(`  平台:     ${adapter.getDisplayName()}`);
      console.log(`  名称:     ${currentConfig.name}`);
      console.log(`  API Key:  ${summary.maskedKey}`);
      console.log(`  Base URL: ${summary.url}`);
    } else {
      console.log(chalk.yellow(`当前没有激活的${adapter.getDisplayName()}配置`));
    }
  } else {
    // 显示所有平台的当前配置
    const platforms = platformManager.getSupportedPlatforms();
    let hasActiveConfig = false;

    for (const platformName of platforms) {
      try {
        const adapter = platformManager.getPlatform(platformName);
        const currentConfig = adapter.getCurrentConfig();

        if (currentConfig) {
          const summary = adapter.getConfigSummary(currentConfig);

          if (!hasActiveConfig) {
            console.log(chalk.green('当前激活的配置:'));
            console.log();
            hasActiveConfig = true;
          }

          console.log(chalk.cyan(`${adapter.getDisplayName()}:`));
          console.log(`  名称:     ${chalk.white(currentConfig.name)}`);
          console.log(`  API Key:  ${chalk.gray(summary.maskedKey)}`);
          console.log(`  Base URL: ${chalk.cyan(summary.url)}`);
          console.log();
        }
      } catch (error) {
        console.warn(chalk.yellow(`检查${platformName}配置时出错: ${error.message}`));
      }
    }

    if (!hasActiveConfig) {
      console.log(chalk.yellow('当前没有激活的配置'));
    }
  }
}

/**
 * 列出配置并提示用户选择（支持多平台）
 * @param {string} platform 指定平台，不传则显示所有平台
 */
async function listAndSelectMultiPlatformConfig(platform = null) {
  const configs = getAllConfigs(platform);

  if (configs.length === 0) {
    if (platform) {
      console.log(chalk.yellow(`没有找到${platform}平台的配置`));
    } else {
      console.log(chalk.yellow('没有找到任何配置'));
    }
    return;
  }

  // 获取当前激活的配置
  const currentConfig = getCurrentMultiPlatformConfig();

  // 显示当前激活的配置
  if (currentConfig) {
    const adapter = platformManager.getPlatform(currentConfig.platform);
    const summary = adapter ? adapter.getConfigSummary(currentConfig) : { maskedKey: 'N/A', url: 'N/A' };

    console.log(chalk.green('当前激活的配置: ') +
                chalk.white(`${currentConfig.name} [${currentConfig.platformDisplayName}]`));
    console.log(chalk.gray(`  API Key:  ${summary.maskedKey}`));
    console.log(chalk.cyan(`  Base URL: ${summary.url}`));
    console.log();
  }
  
  const { choices } = formatMultiPlatformChoices(configs, currentConfig);
  
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'configIndex',
        message: '请选择要切换的配置:',
        choices: choices,
        pageSize: Math.min(choices.length, 15),
        prefix: '',
        suffix: '',
      }
    ]);
    
    // 如果用户选择了手动输入
    if (answers.configIndex === 'input') {
      const inputAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualIndex',
          message: `请输入配置序号 (1-${configs.length}):`,
          validate: (input) => {
            const num = parseInt(input, 10);
            if (isNaN(num) || num < 1 || num > configs.length) {
              return `请输入有效的序号 (1-${configs.length})`;
            }
            return true;
          }
        }
      ]);
      
      answers.configIndex = parseInt(inputAnswer.manualIndex, 10) - 1;
    }
    
    const selectedConfig = configs[answers.configIndex];
    
    // 检查是否选择了当前激活的配置
    if (isCurrentConfig(selectedConfig, currentConfig)) {
      console.log(chalk.yellow(`\n配置 "${selectedConfig.name}" [${selectedConfig.platformDisplayName}] 已经是当前激活的配置`));
      return;
    }
    
    // 激活选择的配置
    await activateConfig(selectedConfig);
    
  } catch (error) {
    if (error.isTtyError) {
      console.error(chalk.red('无法在当前环境中运行交互式选择器'));
    } else {
      console.error(chalk.red(`发生错误: ${error.message}`));
    }
  }
}

/**
 * 通过索引设置配置（支持多平台）
 * @param {number} index 配置索引
 * @param {string} platform 指定平台，不传则使用所有平台
 */
async function setMultiPlatformConfig(index, platform = null) {
  const configs = getAllConfigs(platform);
  
  if (configs.length === 0) {
    if (platform) {
      console.log(chalk.yellow(`没有找到${platform}平台的配置`));
    } else {
      console.log(chalk.yellow('没有找到任何配置'));
    }
    return;
  }
  
  // 检查索引是否有效
  if (index < 1 || index > configs.length) {
    console.error(chalk.red(`无效的索引: ${index}，有效范围: 1-${configs.length}`));
    return;
  }
  
  const selectedConfig = configs[index - 1];
  
  // 激活选择的配置
  await activateConfig(selectedConfig);
}

module.exports = {
  getAllConfigs,
  formatMultiPlatformChoices,
  isCurrentConfig,
  getCurrentMultiPlatformConfig,
  activateConfig,
  showCurrentMultiPlatformConfig,
  listAndSelectMultiPlatformConfig,
  setMultiPlatformConfig
};