const chalk = require('chalk');
const inquirer = require('inquirer');
const { readSettings, writeSettings } = require('./config');

// 可用的模型列表
const AVAILABLE_MODELS = [
  'claude-opus-4-20250514',
];

/**
 * 显示当前模型设置
 */
function showCurrentModel() {
  const settings = readSettings();

  if (settings.model) {
    console.log(chalk.green('当前模型: ') + chalk.white(settings.model));
  } else {
    console.log(chalk.yellow('当前未设置模型'));
  }
}

/**
 * 设置模型（交互式）
 */
async function setModelInteractive() {
  const settings = readSettings();
  const currentModel = settings.model;

  // 构建选项列表
  const choices = [
    ...AVAILABLE_MODELS.map(model => ({
      name: model === currentModel ? chalk.green(`${model} (当前)`) : model,
      value: model
    })),
    new inquirer.Separator(),
    { name: chalk.red('删除模型设置'), value: 'delete' },
    { name: chalk.gray('取消'), value: 'cancel' }
  ];

  try {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: '请选择要设置的模型:',
        choices: choices,
        pageSize: 10
      }
    ]);

    if (answer.model === 'cancel') {
      console.log(chalk.yellow('操作已取消'));
      return;
    }

    if (answer.model === 'delete') {
      // 删除模型设置
      if (settings.model) {
        delete settings.model;
        writeSettings(settings);
        console.log(chalk.green('已删除模型设置'));
      } else {
        console.log(chalk.yellow('当前没有模型设置'));
      }
    } else {
      // 设置新模型
      settings.model = answer.model;
      writeSettings(settings);
      console.log(chalk.green(`成功设置模型: ${answer.model}`));
    }

  } catch (error) {
    console.error(chalk.red(`设置模型失败: ${error.message}`));
  }
}

/**
 * 直接设置指定的模型
 * @param {string} modelName 模型名称
 */
function setModelDirect(modelName) {
  const settings = readSettings();

  if (modelName === 'delete' || modelName === 'remove') {
    // 删除模型设置
    if (settings.model) {
      delete settings.model;
      writeSettings(settings);
      console.log(chalk.green('已删除模型设置'));
    } else {
      console.log(chalk.yellow('当前没有模型设置'));
    }
  } else if (AVAILABLE_MODELS.includes(modelName)) {
    // 设置为指定的模型
    settings.model = modelName;
    writeSettings(settings);
    console.log(chalk.green(`成功设置模型: ${modelName}`));
  } else {
    console.error(chalk.red(`无效的模型名称: ${modelName}`));
    console.log(chalk.cyan('可用的模型:'));
    AVAILABLE_MODELS.forEach(model => {
      console.log(`  - ${model}`);
    });
  }
}

/**
 * 列出所有可用的模型
 */
function listModels() {
  const settings = readSettings();
  const currentModel = settings.model;

  console.log(chalk.cyan('可用的模型:'));
  AVAILABLE_MODELS.forEach(model => {
    if (model === currentModel) {
      console.log(chalk.green(`  - ${model} (当前)`));
    } else {
      console.log(`  - ${model}`);
    }
  });

  if (!currentModel) {
    console.log(chalk.yellow('\n当前未设置模型'));
  }
}

module.exports = {
  showCurrentModel,
  setModelInteractive,
  setModelDirect,
  listModels,
  AVAILABLE_MODELS
};