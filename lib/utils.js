const chalk = require('chalk');
const { exec } = require('child_process');
const { readApiConfigs, CONFIG_DIR, API_CONFIGS_FILE } = require('./config');
const packageJson = require('../package.json');

// 版本号
const VERSION = packageJson.version;

/**
 * 列出所有可用的API配置
 */
function listConfigs() {
  const apiConfigs = readApiConfigs();
  
  if (apiConfigs.length === 0) {
    console.log(chalk.yellow('没有找到可用的API配置'));
    return;
  }
  
  console.log(chalk.cyan('可用的API配置:'));
  apiConfigs.forEach((config, index) => {
    console.log(chalk.white(` ${index + 1}. ${config.name}`));
  });
}

/**
 * 显示版本信息
 */
function showVersion() {
  console.log(`ccs 版本: ${VERSION}`);
}

/**
 * 打开配置文件位置
 * @param {string} type 打开类型: 'api' 打开API配置文件, 'dir' 打开配置目录
 */
function openConfig(type) {
  let targetPath;
  let command;
  
  if (type === 'api') {
    targetPath = API_CONFIGS_FILE;
  } else if (type === 'dir') {
    targetPath = CONFIG_DIR;
  } else {
    console.error(chalk.red('错误: 无效的打开类型。请使用 "api" 或 "dir"'));
    return;
  }

  // 根据操作系统选择合适的命令
  switch (process.platform) {
    case 'darwin': // macOS
      command = `open "${targetPath}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${targetPath}"`;
      break;
    default: // Linux 和其他
      command = `xdg-open "${targetPath}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.error(chalk.red(`打开失败: ${error.message}`));
      console.log(chalk.cyan(`配置文件路径: ${targetPath}`));
    } else {
      console.log(chalk.green(`已打开: ${targetPath}`));
    }
  });
}

/**
 * 处理未知命令的错误
 * @param {Object} program Commander程序对象
 */
function setupErrorHandling(program) {
  // 添加错误处理
  program.on('command:*', (operands) => {
    console.error(chalk.red(`错误: 未知命令 '${operands[0]}'`));
    const availableCommands = program.commands.map(cmd => cmd.name());
    console.log(chalk.cyan('\n可用命令:'));
    availableCommands.forEach(cmd => {
      console.log(`  ${cmd}`);
    });
    console.log(chalk.cyan('\n使用 --help 查看更多信息'));
    process.exit(1);
  });

  // 如果没有提供命令，显示帮助信息
  if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit(0);
  }
}

module.exports = {
  VERSION,
  listConfigs,
  showVersion,
  openConfig,
  setupErrorHandling
};