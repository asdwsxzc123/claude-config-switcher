/**
 * 快速配置命令模块
 * 使用相同的 API 配置同时设置多个平台
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const os = require('os');
const fs = require('fs');
const path = require('path');
const platformManager = require('./platforms/manager');
const { getAllConfigs, setMultiPlatformConfig } = require('./multiPlatformConfig');

/**
 * 选择要配置的平台
 * @returns {Promise<string[]>} 选中的平台列表
 */
async function selectPlatforms() {
  const { platforms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'platforms',
      message: '请选择要配置的平台:',
      choices: [
        { name: 'Claude', value: 'claude', checked: true },
        { name: 'Codex', value: 'codex', checked: true }
      ],
      validate: (input) => {
        if (input.length === 0) {
          return '请至少选择一个平台';
        }
        return true;
      }
    }
  ]);
  return platforms;
}

/**
 * 根据平台类型处理 URL，添加对应的后缀
 * @param {string} platform - 平台名称
 * @param {string} url - 原始 URL
 * @returns {string} 处理后的 URL
 */
function processUrlForPlatform(platform, url) {
  let platformUrl = url.replace(/\/+$/, ''); // 移除末尾斜杠

  if (platform === 'claude') {
    if (!platformUrl.endsWith('/api')) {
      platformUrl += '/api';
    }
  } else if (platform === 'codex') {
    if (!platformUrl.endsWith('/openai/v1')) {
      platformUrl += '/openai/v1';
    }
  }

  return platformUrl;
}

/**
 * 为单个平台配置 API
 * @param {string} platform - 平台名称
 * @param {string} apiKey - API 密钥
 * @param {string} url - 基础 URL
 * @returns {Promise<{success: boolean, platformUrl: string|null}>} 配置结果
 */
async function configurePlatform(platform, apiKey, url) {
  const alias = platform; // 默认 alias 就是平台名
  const adapter = platformManager.getPlatform(platform);
  adapter.ensureConfigDir();

  // 检查是否存在同名配置
  const configs = adapter.readConfigs();
  const existingConfig = configs.find(c => c.name === alias);

  if (existingConfig) {
    // 存在同名配置，询问是否覆盖
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${adapter.getDisplayName()} 已存在名为 "${alias}" 的配置，是否覆盖？`,
        default: true
      }
    ]);

    if (!overwrite) {
      console.log(chalk.yellow(`跳过 ${adapter.getDisplayName()} 配置`));
      return { success: false, platformUrl: null };
    }
  }

  // 添加/覆盖配置
  try {
    const platformUrl = processUrlForPlatform(platform, url);
    adapter.addConfig(alias, apiKey, platformUrl);
    console.log(chalk.green(`✓ 已配置 ${adapter.getDisplayName()}: ${alias}`));
    return { success: true, platformUrl };
  } catch (error) {
    console.error(chalk.red(`配置 ${adapter.getDisplayName()} 失败: ${error.message}`));
    return { success: false, platformUrl: null };
  }
}

/**
 * 打印已配置的平台详情
 * @param {string[]} platforms - 平台列表
 * @param {string} apiKey - API 密钥（用于脱敏显示）
 */
function printConfiguredPlatforms(platforms, apiKey) {
  const allConfigs = getAllConfigs();

  console.log(chalk.cyan('\n已配置的平台:'));
  for (const platform of platforms) {
    const config = allConfigs.find(c => c.name === platform && c.platform === platform);
    if (config) {
      console.log(chalk.white(`\n[${platform.toUpperCase()}]`));
      console.log(chalk.gray(`  别名: ${config.name}`));

      // 根据平台类型获取 URL
      const configUrl = platform === 'claude'
        ? config.config.env?.ANTHROPIC_BASE_URL
        : config.config.url;
      console.log(chalk.gray(`  URL: ${configUrl || 'N/A'}`));

      // 脱敏显示 API Key
      const adapter = platformManager.getPlatform(platform);
      console.log(chalk.gray(`  Key: ${adapter.maskKey(apiKey)}`));
    }
  }
}

/**
 * 检测当前 shell 类型并返回配置文件路径
 * @returns {string} shell 配置文件路径
 */
function detectShellConfigFile() {
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) {
    return path.join(os.homedir(), '.zshrc');
  } else if (shell.includes('bash')) {
    // macOS 使用 .bash_profile，Linux 使用 .bashrc
    const bashProfile = path.join(os.homedir(), '.bash_profile');
    const bashrc = path.join(os.homedir(), '.bashrc');
    return fs.existsSync(bashProfile) ? bashProfile : bashrc;
  } else {
    // 默认尝试 .zshrc
    return path.join(os.homedir(), '.zshrc');
  }
}

/**
 * 需要注释掉的相关环境变量列表
 */
const ANTHROPIC_ENV_VARS = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL'
];

/**
 * 注释掉 shell 配置文件中已存在的相关环境变量
 * @param {string} content - 文件内容
 * @returns {{content: string, commented: string[]}} 处理后的内容和被注释的变量列表
 */
function commentOutExistingEnvVars(content) {
  const commented = [];
  let newContent = content;

  for (const envVar of ANTHROPIC_ENV_VARS) {
    // 匹配未注释的 export 语句（行首可能有空格，但不能有 #）
    // 排除 Claude Code Switcher 配置块中的变量（这些会被整体替换）
    const pattern = new RegExp(
      `^(\\s*)export\\s+${envVar}\\s*=(.*)$`,
      'gm'
    );

    newContent = newContent.replace(pattern, (match, indent, value, offset) => {
      // 检查这一行是否在 Claude Code Switcher 配置块内
      const beforeMatch = newContent.substring(0, offset);
      const lastMarkerIndex = beforeMatch.lastIndexOf('# Claude Code Switcher - API 配置');

      // 如果在配置块内（标记后的 3 行内），不注释
      if (lastMarkerIndex !== -1) {
        const linesBetween = beforeMatch.substring(lastMarkerIndex).split('\n').length - 1;
        if (linesBetween <= 3) {
          return match; // 保持原样，让后续逻辑处理
        }
      }

      // 注释掉这一行
      if (!commented.includes(envVar)) {
        commented.push(envVar);
      }
      return `${indent}# [ccs] 已注释: export ${envVar}=${value}`;
    });
  }

  return { content: newContent, commented };
}

/**
 * 将环境变量添加到 shell 配置文件
 * @param {string} apiKey - API 密钥
 * @param {string} claudeUrl - Claude 平台的 URL
 */
function addToShellConfig(apiKey, claudeUrl) {
  const shellConfigFile = detectShellConfigFile();

  // 生成环境变量配置
  const envLines = [
    '',
    '# Claude Code Switcher - API 配置',
    `export ANTHROPIC_BASE_URL="${claudeUrl}"`,
    `export ANTHROPIC_AUTH_TOKEN="${apiKey}"`,
    ''
  ].join('\n');

  try {
    // 读取现有内容
    let existingContent = '';
    if (fs.existsSync(shellConfigFile)) {
      existingContent = fs.readFileSync(shellConfigFile, 'utf8');
    }

    // 1. 先注释掉已存在的相关环境变量
    const { content: contentWithComments, commented } = commentOutExistingEnvVars(existingContent);
    existingContent = contentWithComments;

    if (commented.length > 0) {
      console.log(chalk.yellow(`\n⚠️  已注释掉以下环境变量:`));
      commented.forEach(v => console.log(chalk.yellow(`   - ${v}`)));
    }

    // 2. 检查是否已存在 Claude Code Switcher 配置块
    const startMarker = '# Claude Code Switcher - API 配置';
    const envVarPattern = /# Claude Code Switcher - API 配置\nexport ANTHROPIC_BASE_URL="[^"]*"\nexport ANTHROPIC_AUTH_TOKEN="[^"]*"/g;

    if (existingContent.includes(startMarker)) {
      // 替换现有配置块
      existingContent = existingContent.replace(envVarPattern, envLines.trim());
      fs.writeFileSync(shellConfigFile, existingContent, 'utf8');
      console.log(chalk.green(`\n✓ 已更新 ${shellConfigFile} 中的环境变量`));
    } else {
      // 先写入注释后的内容，再追加新配置
      if (commented.length > 0) {
        fs.writeFileSync(shellConfigFile, existingContent, 'utf8');
      }
      fs.appendFileSync(shellConfigFile, envLines, 'utf8');
      console.log(chalk.green(`\n✓ 已添加环境变量到 ${shellConfigFile}`));
    }

    console.log(chalk.yellow(`\n提示: 请运行以下命令使配置生效:`));
    console.log(chalk.cyan(`  source ${shellConfigFile}`));
    console.log(chalk.yellow(`\n注意: shell 环境变量会覆盖 ccs 的配置，如需使用 ccs 切换功能，请删除这些环境变量`));
  } catch (error) {
    console.error(chalk.red(`写入 shell 配置文件失败: ${error.message}`));
  }
}

/**
 * 快速配置多平台
 * @param {string} apiKey - API 密钥
 * @param {string} url - 基础 URL
 */
async function quickSet(apiKey, url) {
  // 1. 选择要配置的平台
  const platforms = await selectPlatforms();

  let lastConfiguredPlatform = null;
  let lastConfiguredAlias = null;
  let claudeUrl = null;

  // 2. 为每个选中的平台配置
  for (const platform of platforms) {
    const result = await configurePlatform(platform, apiKey, url);
    if (result.success) {
      lastConfiguredPlatform = platform;
      lastConfiguredAlias = platform;

      // 保存 Claude 平台的 URL（用于后续写入环境变量）
      if (platform === 'claude') {
        claudeUrl = result.platformUrl;
      }
    }
  }

  // 3. 激活最后配置的平台并打印配置详情
  if (lastConfiguredPlatform && lastConfiguredAlias) {
    const allConfigs = getAllConfigs();
    const configIndex = allConfigs.findIndex(
      c => c.name === lastConfiguredAlias && c.platform === lastConfiguredPlatform
    );

    if (configIndex !== -1) {
      console.log(chalk.cyan('\n正在激活配置...'));
      await setMultiPlatformConfig(configIndex + 1);
    }

    // 打印已配置的平台详情
    printConfiguredPlatforms(platforms, apiKey);

    // 4. 询问是否添加到 shell 环境变量
    const { addToShell } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addToShell',
        message: '是否将环境变量添加到 shell 配置文件？',
        default: false
      }
    ]);

    if (addToShell) {
      addToShellConfig(apiKey, claudeUrl || processUrlForPlatform('claude', url));
    }
  }
}

module.exports = {
  quickSet,
  selectPlatforms,
  processUrlForPlatform,
  configurePlatform,
  printConfiguredPlatforms,
  detectShellConfigFile,
  addToShellConfig
};
