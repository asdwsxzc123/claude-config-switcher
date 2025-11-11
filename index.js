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
  showCurrentMultiPlatformConfig 
} = require('./lib/multiPlatformConfig');

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
  .description('添加新的API配置')
  .option('-p, --platform <platform>', '指定平台类型 (claude|codex)', 'claude')
  .action((alias, key, url, options) => {
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
    } catch (error) {
      console.error(chalk.red(`添加配置失败: ${error.message}`));
      process.exit(1);
    }
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