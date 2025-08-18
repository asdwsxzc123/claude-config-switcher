const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { createClient } = require('webdav');
const { CONFIG_DIR } = require('./config');

const WEBDAV_CONFIG_FILE = path.join(CONFIG_DIR, 'webdav.json');

/**
 * 读取WebDAV配置
 * @returns {Object} WebDAV配置对象
 */
function readWebdavConfig() {
  try {
    if (!fs.existsSync(WEBDAV_CONFIG_FILE)) {
      return { url: '', username: '', password: '', remotePath: '/claude-configs/' };
    }
    
    const data = fs.readFileSync(WEBDAV_CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red(`读取WebDAV配置文件失败: ${error.message}`));
    return { url: '', username: '', password: '', remotePath: '/claude-configs/' };
  }
}

/**
 * 保存WebDAV配置
 * @param {Object} config WebDAV配置对象
 */
function saveWebdavConfig(config) {
  try {
    fs.writeFileSync(WEBDAV_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log(chalk.green('WebDAV配置已保存'));
  } catch (error) {
    console.error(chalk.red(`保存WebDAV配置文件失败: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 创建WebDAV客户端
 * @param {Object} config WebDAV配置
 * @returns {Object} WebDAV客户端
 */
function createWebdavClient(config) {
  return createClient(config.url, {
    username: config.username,
    password: config.password,
    timeout: 30000
  });
}

/**
 * 确保远程目录存在
 * @param {Object} client WebDAV客户端
 * @param {string} remotePath 远程路径
 */
async function ensureRemoteDirectory(client, remotePath) {
  try {
    await client.createDirectory(remotePath);
  } catch (error) {
    // 目录可能已存在，忽略错误
  }
}

/**
 * 上传单个文件到WebDAV
 * @param {Object} client WebDAV客户端
 * @param {string} remotePath 远程路径
 * @param {string} filename 文件名
 * @param {Object} configData 配置数据
 * @returns {boolean} 是否上传成功
 */
async function uploadFile(client, remotePath, filename, configData) {
  try {
    // 将配置数据转换为字符串
    const fileContent = JSON.stringify(configData, null, 2);
    const remoteFilePath = path.posix.join(remotePath, filename);

    // 上传文件
    await client.putFileContents(remoteFilePath, fileContent, {
      contentType: 'application/json',
      overwrite: true
    });

    console.log(chalk.green(`✓ 成功上传到WebDAV: ${filename}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`上传文件 ${filename} 失败: ${error.message}`));
    return false;
  }
}

/**
 * 下载单个文件从WebDAV
 * @param {Object} client WebDAV客户端
 * @param {string} remotePath 远程路径
 * @param {string} filename 文件名
 * @returns {Object|null} 配置数据或null
 */
async function downloadFile(client, remotePath, filename) {
  try {
    const remoteFilePath = path.posix.join(remotePath, filename);
    
    // 检查文件是否存在
    if (!(await client.exists(remoteFilePath))) {
      console.log(chalk.yellow(`远程文件不存在: ${filename}`));
      return null;
    }

    // 下载文件内容
    const fileContent = await client.getFileContents(remoteFilePath, { format: 'text' });
    const configData = JSON.parse(fileContent);

    console.log(chalk.green(`✓ 成功从WebDAV下载: ${filename}`));
    return configData;
  } catch (error) {
    console.error(chalk.red(`下载文件 ${filename} 失败: ${error.message}`));
    return null;
  }
}

/**
 * 从WebDAV下载配置文件
 * @param {string} filename 文件名
 * @returns {Object|null} 配置数据或null
 */
async function downloadFromWebdav(filename) {
  const webdavConfig = readWebdavConfig();
  
  if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
    console.log(chalk.yellow('WebDAV配置不完整，需要先设置URL、用户名和密码'));
    return null;
  }

  try {
    // 创建WebDAV客户端
    const client = createWebdavClient(webdavConfig);

    // 下载文件
    const remotePath = webdavConfig.remotePath || '/claude-configs/';
    return await downloadFile(client, remotePath, filename);
  } catch (error) {
    console.error(chalk.red(`从WebDAV下载失败: ${error.message}`));
    return null;
  }
}

/**
 * 列出WebDAV远程目录中的所有文件
 * @returns {Array} 文件列表
 */
async function listWebdavFiles() {
  const webdavConfig = readWebdavConfig();
  
  if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
    console.log(chalk.yellow('WebDAV配置不完整，需要先设置URL、用户名和密码'));
    return [];
  }

  try {
    // 创建WebDAV客户端
    const client = createWebdavClient(webdavConfig);

    // 列出远程目录文件
    const remotePath = webdavConfig.remotePath || '/claude-configs/';
    const files = await client.getDirectoryContents(remotePath);
    
    // 过滤出JSON文件
    const jsonFiles = files.filter(file => file.type === 'file' && file.basename.endsWith('.json'));
    
    console.log(chalk.cyan(`找到 ${jsonFiles.length} 个配置文件:`));
    jsonFiles.forEach(file => {
      console.log(chalk.white(`- ${file.basename} (${new Date(file.lastmod).toLocaleString()})`));
    });
    
    return jsonFiles;
  } catch (error) {
    console.error(chalk.red(`列出WebDAV文件失败: ${error.message}`));
    return [];
  }
}

/**
 * 同步下载所有配置文件
 * @returns {Object} 下载结果 { success: boolean, files: Object }
 */
async function syncDownloadConfigs() {
  const webdavConfig = readWebdavConfig();
  
  if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
    console.log(chalk.yellow('WebDAV配置不完整，需要先设置URL、用户名和密码'));
    return { success: false, files: {} };
  }

  console.log(chalk.cyan('开始同步下载配置文件...'));
  
  try {
    const downloadedFiles = {};
    const filesToDownload = ['apiConfigs.json', 'settings.json', 'webdav.json'];
    
    for (const filename of filesToDownload) {
      const data = await downloadFromWebdav(filename);
      if (data) {
        downloadedFiles[filename] = data;
      }
    }
    
    const downloadCount = Object.keys(downloadedFiles).length;
    if (downloadCount > 0) {
      console.log(chalk.green(`成功下载 ${downloadCount} 个配置文件`));
      return { success: true, files: downloadedFiles };
    } else {
      console.log(chalk.yellow('没有找到可下载的配置文件'));
      return { success: false, files: {} };
    }
  } catch (error) {
    console.error(chalk.red(`同步下载失败: ${error.message}`));
    return { success: false, files: {} };
  }
}

/**
 * 上传配置到WebDAV网盘
 * @param {string} filename 文件名
 * @param {Object} configData 配置数据
 */
async function uploadToWebdav(filename, configData) {
  const webdavConfig = readWebdavConfig();
  
  if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
    console.log(chalk.yellow('WebDAV配置不完整，需要先设置URL、用户名和密码'));
    return false;
  }

  try {
    // 创建WebDAV客户端
    const client = createWebdavClient(webdavConfig);

    // 确保远程目录存在
    const remotePath = webdavConfig.remotePath || '/claude-configs/';
    await ensureRemoteDirectory(client, remotePath);

    // 上传文件
    return await uploadFile(client, remotePath, filename, configData);
  } catch (error) {
    console.error(chalk.red(`上传到WebDAV失败: ${error.message}`));
    return false;
  }
}

module.exports = {
  WEBDAV_CONFIG_FILE,
  readWebdavConfig,
  saveWebdavConfig,
  createWebdavClient,
  ensureRemoteDirectory,
  uploadFile,
  downloadFile,
  uploadToWebdav,
  downloadFromWebdav,
  listWebdavFiles,
  syncDownloadConfigs
};