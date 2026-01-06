const chalk = require('chalk');
const inquirer = require('inquirer');
const platformManager = require('./platforms/manager');
const { notifyConfigSwitch } = require('./webhook');
const { readAllConfigs, migrateOldConfigs, writeAllConfigs, removeConfig } = require('./unifiedConfig');

/**
 * 多平台配置管理模块
 * 统一处理所有平台的配置列表、选择和切换
 */

/**
 * 检查并提示用户清除可能覆盖配置的环境变量
 * 检查 ANTHROPIC_BASE_URL 和 ANTHROPIC_AUTH_TOKEN 环境变量
 * 只警告那些在 shell 配置文件中设置的环境变量（会覆盖 settings.json）
 */
function checkEnvironmentVariables() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const envVarsToCheck = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'];

  // 检查常见的 shell 配置文件
  const configFiles = [
    path.join(os.homedir(), '.zshrc'),
    path.join(os.homedir(), '.zshenv'),
    path.join(os.homedir(), '.zprofile'),
    path.join(os.homedir(), '.bashrc'),
    path.join(os.homedir(), '.bash_profile'),
    path.join(os.homedir(), '.profile')
  ];

  const foundInShell = [];

  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      try {
        const content = fs.readFileSync(configFile, 'utf8');
        // 查找未注释的 export 语句
        for (const envVar of envVarsToCheck) {
          const exportPattern = new RegExp(`^\\s*export\\s+${envVar}\\s*=`, 'm');
          if (exportPattern.test(content)) {
            if (!foundInShell.includes(envVar)) {
              foundInShell.push(envVar);
            }
          }
        }
      } catch (error) {
        // 忽略读取错误
      }
    }
  }

  if (foundInShell.length > 0) {
    console.log(chalk.yellow('\n⚠️  检测到以下环境变量在 shell 配置文件中设置，会覆盖配置文件的设置：'));
    foundInShell.forEach(v => {
      console.log(chalk.yellow(`   - ${v}`));
    });
    console.log(chalk.yellow('请从 shell 配置文件中删除或注释这些 export 语句'));
    console.log(chalk.gray('提示: 检查 ~/.zshrc, ~/.bashrc 等文件，然后重启终端或执行 source\n'));
  }
}

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
 * 直接通过平台适配器获取该平台的当前配置，然后通过 key 匹配
 * @param {Object} config 配置对象
 * @param {Object} currentConfig 当前激活的配置（已废弃，保留参数兼容性）
 * @returns {boolean} 是否为当前配置
 */
function isCurrentConfig(config, currentConfig) {
  if (!config) return false;

  // 直接通过平台适配器获取该平台的当前配置
  const adapter = platformManager.getPlatform(config.platform);
  if (!adapter) return false;

  const platformCurrentConfig = adapter.getCurrentConfig();
  if (!platformCurrentConfig) return false;

  // 通过 key 和 url 匹配（而不是通过 name 匹配）
  const configSummary = adapter.getConfigSummary(config);
  const currentSummary = adapter.getConfigSummary(platformCurrentConfig);

  return configSummary.key === currentSummary.key &&
         configSummary.url === currentSummary.url;
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
    // 显示所有平台的当前配置（始终显示 Claude 和 Codex）
    const platforms = platformManager.getSupportedPlatforms();

    console.log(chalk.green('当前激活的配置:'));
    console.log();

    // 遍历所有平台，始终显示每个平台的状态
    for (const platformName of platforms) {
      try {
        const adapter = platformManager.getPlatform(platformName);
        const currentConfig = adapter.getCurrentConfig();

        console.log(chalk.cyan(`${adapter.getDisplayName()}:`));

        if (currentConfig) {
          // 平台有配置，显示配置详情
          const summary = adapter.getConfigSummary(currentConfig);
          console.log(`  名称:     ${chalk.white(currentConfig.name)}`);
          console.log(`  API Key:  ${chalk.gray(summary.maskedKey)}`);
          console.log(`  Base URL: ${chalk.cyan(summary.url)}`);
        } else {
          // 平台没有配置，显示未配置提示
          console.log(`  ${chalk.gray('未配置')}`);
        }

        console.log();
      } catch (error) {
        console.warn(chalk.yellow(`检查${platformName}配置时出错: ${error.message}`));
      }
    }
  }
}

/**
 * 列出配置并提示用户选择（支持多平台）
 * @param {string} platform 指定平台，不传则显示所有平台
 */
async function listAndSelectMultiPlatformConfig(platform = null) {
  // 检查是否存在可能覆盖配置的环境变量
  checkEnvironmentVariables();

  const configs = getAllConfigs(platform);

  if (configs.length === 0) {
    if (platform) {
      console.log(chalk.yellow(`没有找到${platform}平台的配置`));
    } else {
      console.log(chalk.yellow('没有找到任何配置'));
    }
    return;
  }

  // 显示所有平台的当前激活配置
  console.log(chalk.green('当前激活的配置:'));
  console.log();

  const platforms = platformManager.getSupportedPlatforms();
  for (const platformName of platforms) {
    try {
      const adapter = platformManager.getPlatform(platformName);
      const currentConfig = adapter.getCurrentConfig();

      if (currentConfig) {
        const summary = adapter.getConfigSummary(currentConfig);
        console.log(chalk.cyan(`${adapter.getDisplayName()}: `) +
                    chalk.white(currentConfig.name) +
                    chalk.gray(` (${summary.maskedKey}  ${summary.url})`));
      } else {
        console.log(chalk.cyan(`${adapter.getDisplayName()}: `) + chalk.gray('未配置'));
      }
    } catch (error) {
      console.warn(chalk.yellow(`检查${platformName}配置时出错: ${error.message}`));
    }
  }
  console.log();

  // 获取当前激活的配置（用于标记列表中的当前配置）
  const currentConfig = getCurrentMultiPlatformConfig();
  
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
  // 检查是否存在可能覆盖配置的环境变量
  checkEnvironmentVariables();

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

/**
 * 清除指定平台的激活状态
 * @param {string} platform 平台名称
 */
function clearPlatformActivation(platform) {
  try {
    const adapter = platformManager.getPlatform(platform);

    // 根据平台类型清除激活状态
    if (platform === 'claude') {
      // Claude 平台：清除 settings.json 中的认证字段
      const { readSettings, writeSettings } = require('./unifiedConfig');
      const settings = readSettings();

      if (settings.env) {
        delete settings.env.ANTHROPIC_AUTH_TOKEN;
        delete settings.env.ANTHROPIC_BASE_URL;
        writeSettings(settings);
      }
    } else if (platform === 'codex') {
      // Codex 平台：删除配置文件
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const codexConfigDir = path.join(os.homedir(), '.codex');
      const configFile = path.join(codexConfigDir, 'config.toml');
      const authFile = path.join(codexConfigDir, 'auth.json');

      if (fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
      }
      if (fs.existsSync(authFile)) {
        fs.unlinkSync(authFile);
      }
    }

    console.log(chalk.gray(`已清除 ${adapter.getDisplayName()} 平台的激活状态`));
  } catch (error) {
    console.warn(chalk.yellow(`清除平台激活状态时出错: ${error.message}`));
  }
}

/**
 * 格式化删除选项（支持多选）
 * @param {Array} configs 配置列表
 * @param {Object} currentConfig 当前配置
 * @returns {Array} 格式化后的选项
 */
function formatDeleteChoices(configs, currentConfig = null) {
  if (configs.length === 0) {
    return [];
  }

  // 计算最大名称长度和最大平台标签长度用于对齐
  const maxNameLength = Math.max(...configs.map(config => config.name.length));
  const maxPlatformLength = Math.max(...configs.map(config => config.platformDisplayName.length));

  return configs.map((config, index) => {
    const adapter = platformManager.getPlatform(config.platform);
    const summary = adapter ? adapter.getConfigSummary(config) : { maskedKey: 'N/A', url: 'N/A' };

    // 序号（从1开始，右对齐）
    const sequenceNumber = `${index + 1}`.padStart(2);
    const paddedName = config.name.padEnd(maxNameLength);
    const platformTag = `[${config.platformDisplayName}]`.padEnd(maxPlatformLength + 2);

    // 检查是否为当前激活的配置
    const isCurrent = isCurrentConfig(config, currentConfig);
    const currentMark = isCurrent ? chalk.yellow(' [当前]') : '';

    // 格式: 序号. 名称 [平台] 脱敏Key URL [当前]
    const displayText = `${chalk.gray(sequenceNumber + '.')}  ${paddedName}  ${platformTag}  ${chalk.gray(summary.maskedKey)}  ${chalk.cyan(summary.url)}${currentMark}`;

    return {
      name: displayText,
      value: index,
      // 标记当前配置，用于后续警告
      isCurrent: isCurrent
    };
  });
}

/**
 * 交互式删除配置
 * @param {Object} options 选项对象
 * @param {string} options.platform 指定平台
 * @param {boolean} options.yes 跳过确认
 */
async function interactiveDeleteConfig(options = {}) {
  const { platform = null, yes = false } = options;

  // 检查环境变量
  checkEnvironmentVariables();

  // 获取所有配置
  const configs = getAllConfigs(platform);

  if (configs.length === 0) {
    if (platform) {
      console.log(chalk.yellow(`没有找到${platform}平台的配置`));
    } else {
      console.log(chalk.yellow('没有找到任何配置'));
    }
    return;
  }

  // 获取当前配置
  const currentConfig = getCurrentMultiPlatformConfig();

  // 格式化选项
  const choices = formatDeleteChoices(configs, currentConfig);

  try {
    // 第一步：选择要删除的配置（多选）
    const selectAnswer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedIndexes',
        message: '请选择要删除的配置（使用空格选择，回车确认）:',
        choices: choices,
        pageSize: Math.min(choices.length, 15),
        validate: (input) => {
          if (input.length === 0) {
            return '请至少选择一个配置';
          }
          return true;
        }
      }
    ]);

    if (selectAnswer.selectedIndexes.length === 0) {
      console.log(chalk.yellow('未选择任何配置，取消删除'));
      return;
    }

    // 获取选中的配置
    const selectedConfigs = selectAnswer.selectedIndexes.map(index => configs[index]);

    // 显示将要删除的配置
    console.log();
    console.log(chalk.yellow(`已选择 ${selectedConfigs.length} 个配置:`));
    selectedConfigs.forEach(config => {
      const adapter = platformManager.getPlatform(config.platform);
      const summary = adapter.getConfigSummary(config);
      const isCurrent = isCurrentConfig(config, currentConfig);
      const currentMark = isCurrent ? chalk.red(' - 当前激活的配置！') : '';
      console.log(`  - ${config.name} (${config.platformDisplayName}) - ${summary.maskedKey}${currentMark}`);
    });
    console.log();

    // 检查是否包含当前配置
    const deletingCurrent = selectedConfigs.some(config => isCurrentConfig(config, currentConfig));
    if (deletingCurrent) {
      console.log(chalk.red('⚠️  警告：你正在删除当前激活的配置！'));
      console.log();
    }

    // 第二步：确认删除（除非使用 -y 参数）
    if (!yes) {
      const confirmAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: '确认删除这些配置？',
          default: false
        }
      ]);

      if (!confirmAnswer.confirmed) {
        console.log(chalk.yellow('已取消删除'));
        return;
      }
    }

    // 执行删除
    let successCount = 0;
    const platformsToCheck = new Set();

    for (const config of selectedConfigs) {
      const success = removeConfig(config.name, config.platform);
      if (success) {
        successCount++;
        platformsToCheck.add(config.platform);
        console.log(chalk.green(`✓ 已删除: ${config.name} (${config.platformDisplayName})`));
      } else {
        console.log(chalk.red(`✗ 删除失败: ${config.name} (${config.platformDisplayName})`));
      }
    }

    console.log();
    console.log(chalk.green(`成功删除 ${successCount}/${selectedConfigs.length} 个配置`));

    // 检查被删除的平台是否还有其他配置，如果没有则清除激活状态
    for (const platform of platformsToCheck) {
      const remainingConfigs = getAllConfigs(platform);
      if (remainingConfigs.length === 0) {
        clearPlatformActivation(platform);
      } else if (deletingCurrent && currentConfig && currentConfig.platform === platform) {
        // 如果删除了当前配置，但该平台还有其他配置，也清除激活状态
        clearPlatformActivation(platform);
      }
    }

  } catch (error) {
    if (error.isTtyError) {
      console.error(chalk.red('无法在当前环境中运行交互式选择器'));
    } else {
      console.error(chalk.red(`发生错误: ${error.message}`));
    }
  }
}

/**
 * 删除配置（通过索引或别名）
 * @param {string|number} identifier 配置索引或别名
 * @param {Object} options 选项对象
 * @param {string} options.platform 指定平台
 * @param {boolean} options.yes 跳过确认
 */
async function deleteMultiPlatformConfig(identifier, options = {}) {
  const { platform = null, yes = false } = options;

  // 如果没有提供标识符，使用交互式删除
  if (identifier === undefined || identifier === null) {
    await interactiveDeleteConfig(options);
    return;
  }

  // 获取所有配置
  const configs = getAllConfigs(platform);

  if (configs.length === 0) {
    if (platform) {
      console.log(chalk.yellow(`没有找到${platform}平台的配置`));
    } else {
      console.log(chalk.yellow('没有找到任何配置'));
    }
    return;
  }

  let configToDelete = null;

  // 判断 identifier 是索引还是别名
  const indexNum = parseInt(identifier, 10);
  if (!isNaN(indexNum) && indexNum >= 1 && indexNum <= configs.length) {
    // 按索引查找
    configToDelete = configs[indexNum - 1];
  } else {
    // 按别名查找
    configToDelete = configs.find(config => config.name === identifier);

    if (!configToDelete) {
      console.log(chalk.red(`未找到配置: ${identifier}`));
      console.log(chalk.yellow(`提示: 使用 'ccs list' 查看所有可用配置`));
      return;
    }
  }

  // 获取当前配置
  const currentConfig = getCurrentMultiPlatformConfig();
  const isCurrent = isCurrentConfig(configToDelete, currentConfig);

  // 显示配置信息
  console.log();
  console.log(chalk.cyan('即将删除配置:'));
  const adapter = platformManager.getPlatform(configToDelete.platform);
  const summary = adapter.getConfigSummary(configToDelete);
  console.log(`  名称:     ${chalk.white(configToDelete.name)}`);
  console.log(`  平台:     ${configToDelete.platformDisplayName}`);
  console.log(`  API Key:  ${chalk.gray(summary.maskedKey)}`);
  console.log(`  Base URL: ${chalk.cyan(summary.url)}`);

  if (isCurrent) {
    console.log(chalk.red('  ⚠️  这是当前激活的配置！'));
  }
  console.log();

  // 确认删除（除非使用 -y 参数）
  if (!yes) {
    const confirmAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '确认删除？',
        default: false
      }
    ]);

    if (!confirmAnswer.confirmed) {
      console.log(chalk.yellow('已取消删除'));
      return;
    }
  }

  // 执行删除
  const success = removeConfig(configToDelete.name, configToDelete.platform);

  if (success) {
    console.log(chalk.green('✓ 配置已删除'));

    // 检查该平台是否还有其他配置
    const remainingConfigs = getAllConfigs(configToDelete.platform);
    if (remainingConfigs.length === 0 || isCurrent) {
      clearPlatformActivation(configToDelete.platform);
    }
  } else {
    console.log(chalk.red('✗ 删除失败'));
  }
}

module.exports = {
  getAllConfigs,
  formatMultiPlatformChoices,
  isCurrentConfig,
  getCurrentMultiPlatformConfig,
  activateConfig,
  showCurrentMultiPlatformConfig,
  listAndSelectMultiPlatformConfig,
  setMultiPlatformConfig,
  deleteMultiPlatformConfig,
  interactiveDeleteConfig,
  clearPlatformActivation
};