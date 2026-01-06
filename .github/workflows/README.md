# GitHub Actions 工作流说明

本项目包含以下 GitHub Actions 工作流：

## 1. CI (ci.yml)

**触发条件**：
- Push 到 main/master 分支
- 创建 Pull Request

**功能**：
- 在多个 Node.js 版本上运行测试 (14.x, 16.x, 18.x, 20.x)
- 安装依赖
- 执行语法检查

## 2. 发布到 NPM (publish.yml)

**触发条件**：
- 创建新的 GitHub Release
- 手动触发 (workflow_dispatch)

**功能**：
- 自动发布到 NPM
- 需要配置 `NPM_TOKEN` secret

**配置步骤**：
1. 在 npmjs.com 生成 Access Token
2. 在 GitHub 仓库设置中添加 Secret：`NPM_TOKEN`
3. 创建 Release 或手动触发工作流

## 3. 自动推送 (auto-push.yml)

**触发条件**：
- 仅支持手动触发

**功能**：
- 检查是否有未提交的变更
- 自动提交并推送到仓库

**使用方式**：
1. 进入 GitHub Actions 页面
2. 选择 "Auto Push" 工作流
3. 点击 "Run workflow"
4. 输入提交信息
5. 运行

⚠️ **注意**：一般不推荐使用自动推送，建议手动审核后推送。

## 4. 创建 Release (release.yml)

**触发条件**：
- 推送以 `v` 开头的 tag (例如：v1.2.0)

**功能**：
- 自动生成更新日志
- 创建 GitHub Release

**使用方式**：
```bash
# 更新版本号
npm version patch  # 或 minor/major

# 推送 tag
git push origin v1.2.0
```

## 发布新版本的完整流程

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 添加新功能"

# 2. 更新版本号 (会自动创建 tag)
npm version patch  # 1.1.5 -> 1.1.6
# 或
npm version minor  # 1.1.5 -> 1.2.0
# 或
npm version major  # 1.1.5 -> 2.0.0

# 3. 推送代码和 tag
git push && git push --tags

# 4. 在 GitHub 上创建 Release (release.yml 会自动创建)
#    或手动在 GitHub 网页上创建 Release

# 5. Release 创建后，publish.yml 会自动发布到 NPM
```

## 配置 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 用途 | 获取方式 |
|------------|------|---------|
| `NPM_TOKEN` | 发布到 NPM | https://www.npmjs.com/settings/YOUR_USERNAME/tokens |

配置路径：`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`
