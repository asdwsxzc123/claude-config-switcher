#!/usr/bin/env node

/**
 * 多平台配置切换工具
 * 支持Claude、Codex等多个AI平台的配置切换
 */

const { program } = require('commander');
const chalk = require('chalk');
const { ensureConfigDir, showCurrentConfig, addApiConfig } = require('./lib/config');
const { configureWebdav, uploadConfigs, downloadConfigs, listRemoteFiles, syncConfigs } = require('./lib/webdav');
const { listAndSelectConfig, setConfig } = require('./lib/interactive');
const { VERSION, openConfig, setupErrorHandling } = require('./lib/utils');
const platformManager = require('./lib/platforms/manager');
const {
  listAndSelectMultiPlatformConfig,
  setMultiPlatformConfig,
  showCurrentMultiPlatformConfig,
  deleteMultiPlatformConfig
} = require('./lib/multiPlatformConfig');
const { quickSet } = require('./lib/set');

// 设置命令行程序
program
  .name('ccs')
  .description('多平台AI配置切换工具 (支持: Claude, Codex)')
  .version(VERSION, '-v, --version', '显示版本信息');

program
  .command('list')
  .alias('ls')
  .description('列出所有可用的API配置并提示选择')
  .action(async () => {
    await listAndSelectMultiPlatformConfig();
  });

program
  .command('use <index>')
  .description('设置当前使用的API配置')
  .action(async (index) => {
    await setMultiPlatformConfig(parseInt(index, 10));
  });

program
  .command('current')
  .description('显示当前激活的配置')
  .action(() => {
    showCurrentMultiPlatformConfig();
  });

program
  .command('add <alias> <key> <url>')
  .description('添加新的API配置并自动激活')
  .option('-p, --platform <platform>', '指定平台类型 (claude|codex)', 'claude')
  .action(async (alias, key, url, options) => {
    const platform = platformManager.validatePlatform(options.platform);
    if (!platform) {
      console.log(chalk.red(`不支持的平台: ${options.platform}`));
      console.log(chalk.yellow(`支持的平台: ${platformManager.getSupportedPlatforms().join(', ')}`));
      process.exit(1);
    }

    const adapter = platformManager.getPlatform(platform);
    adapter.ensureConfigDir();

    try {
      const config = adapter.addConfig(alias, key, url);
      console.log(chalk.green(`成功添加${adapter.getDisplayName()}配置: ${alias}`));
      console.log(chalk.cyan('配置详情:'));
      console.log(JSON.stringify(config, null, 2));
      console.log();

      // 检查环境变量（仅对 Claude 平台）
      if (platform === 'claude') {
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
          console.log(chalk.yellow('⚠️  检测到以下环境变量在 shell 配置文件中设置，会覆盖配置文件的设置：'));
          foundInShell.forEach(v => {
            console.log(chalk.yellow(`   - ${v}`));
          });
          console.log(chalk.yellow('请从 shell 配置文件中删除或注释这些 export 语句'));
          console.log(chalk.gray('提示: 检查 ~/.zshrc, ~/.bashrc 等文件，然后重启终端或执行 source\n'));
        }
      }

      // 自动激活新添加的配置
      const { getAllConfigs } = require('./lib/multiPlatformConfig');
      const allConfigs = getAllConfigs();

      // 找到新添加配置的索引（从1开始）
      const configIndex = allConfigs.findIndex(c =>
        c.name === alias && c.platform === platform
      );

      if (configIndex !== -1) {
        console.log(chalk.cyan('正在激活新配置...'));
        await setMultiPlatformConfig(configIndex + 1);
      }
    } catch (error) {
      console.error(chalk.red(`添加配置失败: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * 快速配置命令
 * 使用相同的 API 配置同时设置多个平台
 */
program
  .command('set <apiKey> <url>')
  .description('快速配置 Claude 和 Codex 平台（使用相同的 API 配置）')
  .action(async (apiKey, url) => {
    await quickSet(apiKey, url);
  });

program
  .command('del [identifier]')
  .alias('delete')
  .description('删除API配置（支持交互式选择或直接指定）')
  .option('-p, --platform <platform>', '指定平台类型 (claude|codex)')
  .option('-y, --yes', '跳过确认，直接删除')
  .action(async (identifier, options) => {
    // 验证平台参数（如果提供）
    if (options.platform) {
      const platform = platformManager.validatePlatform(options.platform);
      if (!platform) {
        console.log(chalk.red(`不支持的平台: ${options.platform}`));
        console.log(chalk.yellow(`支持的平台: ${platformManager.getSupportedPlatforms().join(', ')}`));
        process.exit(1);
      }
      options.platform = platform;
    }

    // 执行删除操作
    await deleteMultiPlatformConfig(identifier, options);
  });

program
  .command('platforms')
  .description('显示所有支持的平台信息')
  .action(() => {
    const platforms = platformManager.getPlatformInfo();
    console.log(chalk.green('支持的平台:'));
    console.log();

    platforms.forEach(platform => {
      console.log(chalk.cyan(`${platform.displayName} (${platform.name})`));
      console.log(chalk.gray(`  配置目录: ${platform.configDir}`));
      console.log();
    });
  });

program
  .command('open <type>')
  .description('打开配置文件位置 (type: api|dir)')
  .option('-p, --platform <platform>', '指定平台类型 (claude|codex)', 'claude')
  .action((type, options) => {
    const platform = platformManager.validatePlatform(options.platform);
    if (!platform) {
      console.log(chalk.red(`不支持的平台: ${options.platform}`));
      console.log(chalk.yellow(`支持的平台: ${platformManager.getSupportedPlatforms().join(', ')}`));
      process.exit(1);
    }

    // 对于非Claude平台，需要修改openConfig函数
    if (platform === 'claude') {
      ensureConfigDir();
      openConfig(type);
    } else {
      const adapter = platformManager.getPlatform(platform);
      adapter.ensureConfigDir();
      console.log(chalk.cyan(`${adapter.getDisplayName()}配置目录: ${adapter.getConfigDir()}`));
      // TODO: 可以扩展openConfig函数以支持其他平台
    }
  });

// WebDAV 子命令组
const webdavCommand = program
  .command('webdav <subcommand>')
  .description('WebDAV 网盘相关操作');

webdavCommand
  .command('config')
  .description('配置WebDAV网盘设置')
  .action(async () => {
    ensureConfigDir();
    await configureWebdav();
  });

webdavCommand
  .command('upload')
  .description('上传配置文件到WebDAV网盘')
  .action(async () => {
    ensureConfigDir();
    await uploadConfigs();
  });

webdavCommand
  .command('download')
  .description('从WebDAV网盘下载配置文件')
  .action(async () => {
    ensureConfigDir();
    await downloadConfigs();
  });

webdavCommand
  .command('list')
  .description('列出WebDAV网盘中的远程文件')
  .action(async () => {
    ensureConfigDir();
    await listRemoteFiles();
  });

webdavCommand
  .command('sync')
  .description('同步配置文件（双向同步选项）')
  .action(async () => {
    ensureConfigDir();
    await syncConfigs();
  });

// 保留原有的单独命令（兼容性）
program
  .command('webdav-config')
  .description('配置WebDAV网盘设置')
  .action(async () => {
    ensureConfigDir();
    await configureWebdav();
  });

program
  .command('webdav-upload')
  .description('上传配置文件到WebDAV网盘')
  .action(async () => {
    ensureConfigDir();
    await uploadConfigs();
  });

program
  .command('webdav-download')
  .description('从WebDAV网盘下载配置文件')
  .action(async () => {
    ensureConfigDir();
    await downloadConfigs();
  });

program
  .command('webdav-list')
  .description('列出WebDAV网盘中的远程文件')
  .action(async () => {
    ensureConfigDir();
    await listRemoteFiles();
  });

program
  .command('webdav-sync')
  .description('同步配置文件（双向同步选项）')
  .action(async () => {
    ensureConfigDir();
    await syncConfigs();
  });


// 设置错误处理
setupErrorHandling(program);

// 解析命令行参数
program.parse(process.argv);