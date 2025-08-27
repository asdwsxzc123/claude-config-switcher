const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { readApiConfigs, readSettings, writeApiConfigs, writeSettings, API_CONFIGS_FILE, SETTINGS_FILE, CLAUDE_MD_FILE, readClaudeMd, writeClaudeMd } = require('./config');
const { readWebdavConfig, saveWebdavConfig, uploadToWebdav, downloadFromWebdav, listWebdavFiles, syncDownloadConfigs } = require('./webdav-client');

/**
 * 配置WebDAV网盘设置
 */
async function configureWebdav() {
  const currentConfig = readWebdavConfig();
  
  console.log(chalk.cyan('配置WebDAV网盘设置'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: '请输入WebDAV服务器地址:',
      default: currentConfig.url,
      validate: (input) => {
        if (!input.trim()) {
          return '请输入有效的URL地址';
        }
        try {
          new URL(input);
          return true;
        } catch {
          return '请输入有效的URL格式';
        }
      }
    },
    {
      type: 'input',
      name: 'username',
      message: '请输入用户名:',
      default: currentConfig.username,
      validate: (input) => {
        if (!input.trim()) {
          return '请输入用户名';
        }
        return true;
      }
    },
    {
      type: 'password',
      name: 'password',
      message: '请输入密码:',
      default: currentConfig.password,
      validate: (input) => {
        if (!input.trim()) {
          return '请输入密码';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'remotePath',
      message: '请输入远程存储路径 (可选):',
      default: currentConfig.remotePath || '/claude-configs/',
      validate: (input) => {
        if (input && !input.startsWith('/')) {
          return '路径必须以 / 开头';
        }
        return true;
      }
    }
  ]);

  saveWebdavConfig({
    url: answers.url.trim(),
    username: answers.username.trim(),
    password: answers.password.trim(),
    remotePath: answers.remotePath.trim() || '/claude-configs/'
  });
}

/**
 * 上传单个配置文件
 * @param {string} filename 文件名
 * @param {string} filePath 文件路径
 * @param {Function} readFunction 读取函数
 * @returns {boolean} 是否上传成功
 */
async function uploadConfigFile(filename, filePath, readFunction) {
  if (fs.existsSync(filePath)) {
    const data = readFunction();
    return await uploadToWebdav(filename, data);
  } else {
    console.log(chalk.yellow(`${filename}文件不存在，跳过上传`));
    return false;
  }
}

/**
 * 创建安全的WebDAV配置（移除敏感信息）
 * @param {Object} webdavConfig 原始配置
 * @returns {Object} 安全的配置对象
 */
function createSafeWebdavConfig(webdavConfig) {
  return {
    url: webdavConfig.url,
    username: webdavConfig.username,
    password: '***masked***',
    remotePath: webdavConfig.remotePath
  };
}

/**
 * 检查WebDAV配置是否完整
 * @param {Object} webdavConfig WebDAV配置
 * @returns {boolean} 配置是否完整
 */
function isWebdavConfigComplete(webdavConfig) {
  return webdavConfig.url && webdavConfig.username && webdavConfig.password;
}

/**
 * 提示用户配置WebDAV设置
 * @returns {boolean} 是否继续
 */
async function promptWebdavSetup() {
  console.log(chalk.yellow('请先配置WebDAV设置'));
  const configure = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setup',
      message: '是否现在配置WebDAV设置?',
      default: true
    }
  ]);
  
  if (configure.setup) {
    await configureWebdav();
    return true;
  } else {
    return false;
  }
}

/**
 * 下载并应用配置文件
 * @param {string} filename 文件名
 * @param {string} localPath 本地文件路径
 * @param {Function} writeFunction 写入函数
 * @returns {boolean} 是否下载成功
 */
async function downloadAndApplyConfig(filename, localPath, writeFunction) {
  const data = await downloadFromWebdav(filename);
  if (data) {
    try {
      // 特殊处理webdav.json，合并本地密码
      if (filename === 'webdav.json') {
        const localWebdavConfig = readWebdavConfig();
        if (localWebdavConfig.password && localWebdavConfig.password !== '***masked***') {
          data.password = localWebdavConfig.password;
        }
        saveWebdavConfig(data);
      } else {
        writeFunction(data);
      }
      console.log(chalk.green(`✓ 已应用配置: ${filename}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`应用配置文件 ${filename} 失败: ${error.message}`));
      return false;
    }
  }
  return false;
}

/**
 * 从WebDAV下载配置文件
 */
async function downloadConfigs() {
  const webdavConfig = readWebdavConfig();
  
  if (!isWebdavConfigComplete(webdavConfig)) {
    const shouldContinue = await promptWebdavSetup();
    if (!shouldContinue) {
      return;
    }
  }

  console.log(chalk.cyan('开始从WebDAV网盘下载配置文件...'));
  
  let downloadCount = 0;
  
  // 下载apiConfigs.json
  if (await downloadAndApplyConfig('apiConfigs.json', API_CONFIGS_FILE, writeApiConfigs)) {
    downloadCount++;
  }
  
  // 下载settings.json
  if (await downloadAndApplyConfig('settings.json', SETTINGS_FILE, writeSettings)) {
    downloadCount++;
  }
  
  // 下载CLAUDE.md
  if (await downloadAndApplyConfig('CLAUDE.md', CLAUDE_MD_FILE, writeClaudeMd)) {
    downloadCount++;
  }
  
  // 下载webdav.json（特殊处理）
  if (await downloadAndApplyConfig('webdav.json', null, null)) {
    downloadCount++;
  }
  
  if (downloadCount > 0) {
    console.log(chalk.green(`配置文件下载完成，共下载 ${downloadCount} 个文件`));
  } else {
    console.log(chalk.yellow('没有找到可下载的配置文件'));
  }
}

/**
 * 列出WebDAV远程文件
 */
async function listRemoteFiles() {
  const webdavConfig = readWebdavConfig();
  
  if (!isWebdavConfigComplete(webdavConfig)) {
    const shouldContinue = await promptWebdavSetup();
    if (!shouldContinue) {
      return;
    }
  }

  console.log(chalk.cyan('正在列出WebDAV远程文件...'));
  await listWebdavFiles();
}

/**
 * 同步配置（双向同步选项）
 */
async function syncConfigs() {
  const webdavConfig = readWebdavConfig();
  
  if (!isWebdavConfigComplete(webdavConfig)) {
    const shouldContinue = await promptWebdavSetup();
    if (!shouldContinue) {
      return;
    }
  }

  const syncAction = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择同步方向:',
      choices: [
        { name: '从网盘下载到本地', value: 'download' },
        { name: '从本地上传到网盘', value: 'upload' },
        { name: '查看远程文件列表', value: 'list' }
      ]
    }
  ]);

  switch (syncAction.action) {
    case 'download':
      await downloadConfigs();
      break;
    case 'upload':
      await uploadConfigs();
      break;
    case 'list':
      await listRemoteFiles();
      break;
  }
}

/**
 * 上传当前配置到WebDAV
 */
async function uploadConfigs() {
  const webdavConfig = readWebdavConfig();
  
  if (!isWebdavConfigComplete(webdavConfig)) {
    const shouldContinue = await promptWebdavSetup();
    if (!shouldContinue) {
      return;
    }
  }

  console.log(chalk.cyan('开始上传配置文件到WebDAV网盘...'));
  
  // 上传apiConfigs.json
  await uploadConfigFile('apiConfigs.json', API_CONFIGS_FILE, readApiConfigs);
  
  // 上传settings.json
  await uploadConfigFile('settings.json', SETTINGS_FILE, readSettings);
  
  // 上传CLAUDE.md
  await uploadConfigFile('CLAUDE.md', CLAUDE_MD_FILE, readClaudeMd);
  
  // 上传webdav配置（移除敏感信息）
  const webdavConfigSafe = createSafeWebdavConfig(webdavConfig);
  await uploadToWebdav('webdav.json', webdavConfigSafe);
  
  console.log(chalk.green('配置文件上传完成'));
}

module.exports = {
  configureWebdav,
  uploadConfigs,
  downloadConfigs,
  listRemoteFiles,
  syncConfigs,
  readWebdavConfig,
  saveWebdavConfig,
  uploadToWebdav,
  downloadFromWebdav,
  syncDownloadConfigs
};