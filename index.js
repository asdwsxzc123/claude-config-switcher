#!/usr/bin/env node

/**
 * Claude配置切换工具
 * 用于在不同的Claude API配置之间进行切换
 */

const { program } = require('commander');
const { ensureConfigDir, showCurrentConfig, addApiConfig } = require('./lib/config');
const { configureWebdav, uploadConfigs, downloadConfigs, listRemoteFiles, syncConfigs } = require('./lib/webdav');
const { listAndSelectConfig, setConfig } = require('./lib/interactive');
const { VERSION, openConfig, setupErrorHandling } = require('./lib/utils');
const { showCurrentModel, setModelInteractive, setModelDirect, listModels } = require('./lib/model');

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

program
  .command('add <alias> <key> <url>')
  .description('添加新的API配置')
  .action((alias, key, url) => {
    ensureConfigDir();
    addApiConfig(alias, key, url);
  });

program
  .command('open <type>')
  .description('打开配置文件位置 (type: api|dir)')
  .action((type) => {
    ensureConfigDir();
    openConfig(type);
  });

// Model 相关命令
program
  .command('model [modelName]')
  .description('设置或查看当前模型 (可选: 直接指定模型名称，使用 "delete" 删除模型设置)')
  .action((modelName) => {
    ensureConfigDir();
    if (modelName) {
      setModelDirect(modelName);
    } else {
      setModelInteractive();
    }
  });

program
  .command('model-current')
  .description('显示当前设置的模型')
  .action(() => {
    ensureConfigDir();
    showCurrentModel();
  });

program
  .command('model-list')
  .description('列出所有可用的模型')
  .action(() => {
    ensureConfigDir();
    listModels();
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