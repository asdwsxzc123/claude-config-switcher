const fs = require('fs');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { readApiConfigs, readSettings, writeApiConfigs, writeSettings, API_CONFIGS_FILE, SETTINGS_FILE, CLAUDE_MD_FILE, readClaudeMd, writeClaudeMd } = require('./config');
const { readWebdavConfig, saveWebdavConfig, uploadToWebdav, downloadFromWebdav, listWebdavFiles, syncDownloadConfigs } = require('./webdav-client');
const { readWebhookConfig } = require('./webhook');

/**
 * 动态文件配置列表
 * 可以通过修改此列表来控制需要同步的文件
 */
const FILE_CONFIG_LIST = [
  {
    filename: 'apiConfigs.json',
    localPath: API_CONFIGS_FILE,
    readFunction: readApiConfigs,
    writeFunction: writeApiConfigs,
    description: 'API配置文件'
  },
  {
    filename: 'settings.json',
    localPath: SETTINGS_FILE,
    readFunction: readSettings,
    writeFunction: writeSettings,
    description: '设置文件'
  },
  {
    filename: 'CLAUDE.md',
    localPath: CLAUDE_MD_FILE,
    readFunction: readClaudeMd,
    writeFunction: writeClaudeMd,
    description: 'Claude规范文件'
  },
  {
    filename: 'webdav.json',
    localPath: null, // 特殊处理
    readFunction: () => createSafeWebdavConfig(readWebdavConfig()),
    writeFunction: saveWebdavConfig,
    description: 'WebDAV配置文件',
    special: true // 标记需要特殊处理
  },
  {
    filename: 'webhook.json',
    localPath: require('path').join(require('os').homedir(), '.claude', 'webhook.json'),
    readFunction: () => readFileData(require('path').join(require('os').homedir(), '.claude', 'webhook.json'), { type: 'json', defaultValue: { webhooks: [] } }),
    writeFunction: (data) => writeFileData(require('path').join(require('os').homedir(), '.claude', 'webhook.json'), data, { type: 'json' }),
    description: 'Webhook配置文件'
  }
];

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
 * @param {Object} fileConfig 文件配置对象
 * @returns {boolean} 是否上传成功
 */
async function uploadConfigFile(fileConfig) {
  const { filename, localPath, readFunction, description, special } = fileConfig;
  
  // 特殊文件直接读取并上传
  if (special || !localPath) {
    try {
      const data = readFunction();
      const result = await uploadToWebdav(filename, data);
      if (result) {
        console.log(chalk.green(`✓ 已上传: ${filename}${description ? ` (${description})` : ''}`));
      }
      return result;
    } catch (error) {
      console.log(chalk.yellow(`${filename} 上传失败: ${error.message}`));
      return false;
    }
  }
  
  // 普通文件检查存在性
  if (fs.existsSync(localPath)) {
    const data = readFunction();
    const result = await uploadToWebdav(filename, data);
    if (result) {
      console.log(chalk.green(`✓ 已上传: ${filename}${description ? ` (${description})` : ''}`));
    }
    return result;
  } else {
    console.log(chalk.yellow(`${filename} 文件不存在，跳过上传`));
    return false;
  }
}

/**
 * 通用文件数据读取函数
 * 支持自动检测文件类型并使用相应的解析方式
 * @param {string} filePath - 文件路径
 * @param {Object} options - 读取选项
 * @param {string} options.encoding - 文件编码，默认 'utf8'
 * @param {string} options.type - 强制指定文件类型 ('json'|'text'|'buffer')
 * @param {*} options.defaultValue - 文件不存在时的默认值
 * @returns {*} 解析后的文件数据
 * @throws {Error} 文件读取或解析失败时抛出错误
 */
function readFileData(filePath, options = {}) {
  const {
    encoding = 'utf8',
    type = null,
    defaultValue = null
  } = options;

  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      if (defaultValue !== null) {
        return defaultValue;
      }
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 读取文件内容
    const rawData = fs.readFileSync(filePath, type === 'buffer' ? null : encoding);
    
    // 如果指定为 buffer 类型，直接返回
    if (type === 'buffer') {
      return rawData;
    }
    
    // 如果指定为文本类型，直接返回字符串
    if (type === 'text') {
      return rawData.toString();
    }
    
    // 自动检测或强制 JSON 解析
    if (type === 'json' || filePath.endsWith('.json')) {
      try {
        return JSON.parse(rawData);
      } catch (jsonError) {
        throw new Error(`JSON 解析失败 (${filePath}): ${jsonError.message}`);
      }
    }
    
    // 默认返回字符串
    return rawData.toString();
    
  } catch (error) {
    throw new Error(`读取文件失败 (${filePath}): ${error.message}`);
  }
}

/**
 * 通用文件数据写入函数  
 * 支持自动序列化不同类型的数据并写入文件
 * @param {string} filePath - 文件路径
 * @param {*} data - 要写入的数据
 * @param {Object} options - 写入选项
 * @param {string} options.encoding - 文件编码，默认 'utf8'
 * @param {string} options.type - 强制指定数据类型 ('json'|'text'|'buffer')
 * @param {number} options.indent - JSON 缩进空格数，默认 2
 * @param {boolean} options.createDir - 是否自动创建目录，默认 true
 * @returns {boolean} 写入是否成功
 * @throws {Error} 文件写入失败时抛出错误
 */
function writeFileData(filePath, data, options = {}) {
  const {
    encoding = 'utf8',
    type = null,
    indent = 2,
    createDir = true
  } = options;

  try {
    // 自动创建目录
    if (createDir) {
      const dir = require('path').dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    let writeData = data;
    
    // 根据类型或文件扩展名处理数据
    if (type === 'json' || (type === null && filePath.endsWith('.json'))) {
      if (typeof data === 'string') {
        // 如果传入的是字符串，先尝试解析再格式化
        try {
          writeData = JSON.stringify(JSON.parse(data), null, indent);
        } catch {
          writeData = JSON.stringify(data, null, indent);
        }
      } else {
        writeData = JSON.stringify(data, null, indent);
      }
    } else if (type === 'buffer' || Buffer.isBuffer(data)) {
      // Buffer 数据直接写入
      fs.writeFileSync(filePath, data);
      return true;
    } else {
      // 其他类型转为字符串
      writeData = typeof data === 'string' ? data : String(data);
    }
    
    fs.writeFileSync(filePath, writeData, encoding);
    return true;
    
  } catch (error) {
    throw new Error(`写入文件失败 (${filePath}): ${error.message}`);
  }
}

/**
 * 通用文件操作处理函数
 * 封装常见的文件操作逻辑，包括备份、恢复、批量处理等
 * @param {string} operation - 操作类型 ('backup'|'restore'|'copy'|'move'|'delete')
 * @param {string|Array} source - 源文件路径（可以是单个路径或路径数组）
 * @param {string} target - 目标路径（用于 backup、copy、move 操作）
 * @param {Object} options - 操作选项
 * @param {boolean} options.overwrite - 是否覆盖目标文件，默认 false
 * @param {string} options.backupSuffix - 备份文件后缀，默认 '.bak'
 * @param {boolean} options.createDir - 是否自动创建目录，默认 true
 * @returns {Object} 操作结果 {success: boolean, message: string, details: Array}
 */
function handleFileOperation(operation, source, target = null, options = {}) {
  const {
    overwrite = false,
    backupSuffix = '.bak',
    createDir = true
  } = options;

  const results = {
    success: true,
    message: '',
    details: []
  };

  try {
    // 确保 source 是数组格式，便于统一处理
    const sourceFiles = Array.isArray(source) ? source : [source];
    
    for (const sourcePath of sourceFiles) {
      const detail = { file: sourcePath, success: false, error: null };
      
      try {
        switch (operation) {
          case 'backup':
            if (!target) {
              throw new Error('备份操作需要指定目标路径');
            }
            const backupPath = target.endsWith(backupSuffix) ? target : `${target}${backupSuffix}`;
            
            if (fs.existsSync(backupPath) && !overwrite) {
              throw new Error('备份文件已存在，使用 overwrite: true 来覆盖');
            }
            
            if (createDir) {
              const dir = require('path').dirname(backupPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
            }
            
            fs.copyFileSync(sourcePath, backupPath);
            detail.success = true;
            detail.message = `备份完成: ${backupPath}`;
            break;
            
          case 'restore':
            const restorePath = target || sourcePath;
            const sourceBackup = sourcePath.endsWith(backupSuffix) ? sourcePath : `${sourcePath}${backupSuffix}`;
            
            if (!fs.existsSync(sourceBackup)) {
              throw new Error(`备份文件不存在: ${sourceBackup}`);
            }
            
            if (fs.existsSync(restorePath) && !overwrite) {
              throw new Error('目标文件已存在，使用 overwrite: true 来覆盖');
            }
            
            fs.copyFileSync(sourceBackup, restorePath);
            detail.success = true;
            detail.message = `恢复完成: ${restorePath}`;
            break;
            
          case 'copy':
            if (!target) {
              throw new Error('复制操作需要指定目标路径');
            }
            
            if (fs.existsSync(target) && !overwrite) {
              throw new Error('目标文件已存在，使用 overwrite: true 来覆盖');
            }
            
            if (createDir) {
              const dir = require('path').dirname(target);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
            }
            
            fs.copyFileSync(sourcePath, target);
            detail.success = true;
            detail.message = `复制完成: ${target}`;
            break;
            
          case 'move':
            if (!target) {
              throw new Error('移动操作需要指定目标路径');
            }
            
            if (fs.existsSync(target) && !overwrite) {
              throw new Error('目标文件已存在，使用 overwrite: true 来覆盖');
            }
            
            if (createDir) {
              const dir = require('path').dirname(target);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
            }
            
            fs.renameSync(sourcePath, target);
            detail.success = true;
            detail.message = `移动完成: ${target}`;
            break;
            
          case 'delete':
            if (fs.existsSync(sourcePath)) {
              fs.unlinkSync(sourcePath);
              detail.success = true;
              detail.message = `删除完成: ${sourcePath}`;
            } else {
              detail.success = true;
              detail.message = `文件不存在，跳过删除: ${sourcePath}`;
            }
            break;
            
          default:
            throw new Error(`不支持的操作类型: ${operation}`);
        }
      } catch (error) {
        detail.error = error.message;
        results.success = false;
      }
      
      results.details.push(detail);
    }
    
    // 生成总结信息
    const successCount = results.details.filter(d => d.success).length;
    const totalCount = results.details.length;
    
    if (results.success) {
      results.message = `操作完成: ${successCount}/${totalCount} 个文件处理成功`;
    } else {
      results.message = `操作部分失败: ${successCount}/${totalCount} 个文件处理成功`;
    }
    
  } catch (error) {
    results.success = false;
    results.message = `操作失败: ${error.message}`;
  }
  
  return results;
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
 * @param {Object} fileConfig 文件配置对象
 * @returns {boolean} 是否下载成功
 */
async function downloadAndApplyConfig(fileConfig) {
  const { filename, writeFunction, special, description } = fileConfig;
  const data = await downloadFromWebdav(filename);
  if (data) {
    try {
      // 特殊处理webdav.json，合并本地密码
      if (special && filename === 'webdav.json') {
        const localWebdavConfig = readWebdavConfig();
        if (localWebdavConfig.password && localWebdavConfig.password !== '***masked***') {
          data.password = localWebdavConfig.password;
        }
        saveWebdavConfig(data);
      } else {
        writeFunction(data);
      }
      console.log(chalk.green(`✓ 已应用配置: ${filename}${description ? ` (${description})` : ''}`));
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
 * @param {Array} fileList 可选的文件列表，不传则使用默认列表
 */
async function downloadConfigs(fileList = FILE_CONFIG_LIST) {
  const webdavConfig = readWebdavConfig();
  
  if (!isWebdavConfigComplete(webdavConfig)) {
    const shouldContinue = await promptWebdavSetup();
    if (!shouldContinue) {
      return;
    }
  }

  console.log(chalk.cyan('开始从WebDAV网盘下载配置文件...'));
  console.log(chalk.gray(`准备下载 ${fileList.length} 个文件`));
  
  let downloadCount = 0;
  
  // 使用动态文件列表进行下载
  for (const fileConfig of fileList) {
    if (await downloadAndApplyConfig(fileConfig)) {
      downloadCount++;
    }
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
 * 获取可用的文件列表供用户选择
 * @returns {Array} 用户选择的文件配置列表
 */
async function selectFilesToSync() {
  const { files } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'files',
      message: '请选择要同步的文件:',
      choices: FILE_CONFIG_LIST.map(config => ({
        name: `${config.filename}${config.description ? ` - ${config.description}` : ''}`,
        value: config,
        checked: true // 默认全选
      }))
    }
  ]);
  return files;
}

/**
 * 同步配置（双向同步选项）
 * @param {boolean} selectFiles 是否让用户选择要同步的文件
 */
async function syncConfigs(selectFiles = false) {
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
        { name: '查看远程文件列表', value: 'list' },
        { name: '选择文件同步', value: 'selective' }
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
    case 'selective':
      const selectedFiles = await selectFilesToSync();
      if (selectedFiles.length > 0) {
        const { direction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'direction',
            message: '选择同步方向:',
            choices: [
              { name: '下载选中的文件', value: 'download' },
              { name: '上传选中的文件', value: 'upload' }
            ]
          }
        ]);
        if (direction === 'download') {
          await downloadConfigs(selectedFiles);
        } else {
          await uploadConfigs(selectedFiles);
        }
      } else {
        console.log(chalk.yellow('未选择任何文件'));
      }
      break;
  }
}

/**
 * 上传当前配置到WebDAV
 * @param {Array} fileList 可选的文件列表，不传则使用默认列表
 */
async function uploadConfigs(fileList = FILE_CONFIG_LIST) {
  const webdavConfig = readWebdavConfig();
  
  if (!isWebdavConfigComplete(webdavConfig)) {
    const shouldContinue = await promptWebdavSetup();
    if (!shouldContinue) {
      return;
    }
  }

  console.log(chalk.cyan('开始上传配置文件到WebDAV网盘...'));
  console.log(chalk.gray(`准备上传 ${fileList.length} 个文件`));
  
  let uploadCount = 0;
  
  // 使用动态文件列表进行上传
  for (const fileConfig of fileList) {
    if (await uploadConfigFile(fileConfig)) {
      uploadCount++;
    }
  }
  
  console.log(chalk.green(`配置文件上传完成，共上传 ${uploadCount} 个文件`));
}

/**
 * 添加自定义文件到同步列表
 * @param {Object} fileConfig 文件配置对象
 */
function addFileToSyncList(fileConfig) {
  // 检查是否已存在
  const exists = FILE_CONFIG_LIST.some(f => f.filename === fileConfig.filename);
  if (!exists) {
    FILE_CONFIG_LIST.push(fileConfig);
    console.log(chalk.green(`✓ 已添加文件到同步列表: ${fileConfig.filename}`));
  } else {
    console.log(chalk.yellow(`文件已在同步列表中: ${fileConfig.filename}`));
  }
}

/**
 * 从同步列表移除文件
 * @param {string} filename 文件名
 */
function removeFileFromSyncList(filename) {
  const index = FILE_CONFIG_LIST.findIndex(f => f.filename === filename);
  if (index !== -1) {
    FILE_CONFIG_LIST.splice(index, 1);
    console.log(chalk.green(`✓ 已从同步列表移除: ${filename}`));
  } else {
    console.log(chalk.yellow(`文件不在同步列表中: ${filename}`));
  }
}

/**
 * 获取当前同步文件列表
 * @returns {Array} 文件配置列表
 */
function getSyncFileList() {
  return [...FILE_CONFIG_LIST];
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
  syncDownloadConfigs,
  // 文件同步列表管理
  addFileToSyncList,
  removeFileFromSyncList,
  getSyncFileList,
  FILE_CONFIG_LIST,
  // 通用文件读写函数
  readFileData,
  writeFileData,
  handleFileOperation
};