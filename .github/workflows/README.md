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

## 2. 发布版本 (release.yml) ⭐推荐

**触发条件**：
- 推送以 `v` 开头的 tag (例如：v1.2.0)

**功能**：
- 自动生成更新日志
- 发布到 NPM
- 创建 GitHub Release

**推荐使用方式**：
使用项目的 `/release` skill（需要先配置 Skills）：

```bash
# 使用 Claude Code 的 /release skill
/release patch   # 修复 bug: 1.1.5 -> 1.1.6
/release minor   # 新功能: 1.1.5 -> 1.2.0
/release major   # 破坏性更新: 1.1.5 -> 2.0.0
```

`/release` skill 会自动完成：
1. 提交代码
2. 升级版本号
3. 创建 tag
4. 推送到 GitHub
5. 自动触发此 workflow 发布到 NPM 和创建 Release

**手动触发方式**（不推荐）：
```bash
# 1. 提交代码
git add .
git commit -m "feat: 添加新功能"

# 2. 升级版本号并创建 tag
npm version patch  # 或 minor/major

# 3. 推送代码和 tag
git push && git push --tags
```

## 3. 手动发布到 NPM (publish.yml)

**触发条件**：
- 仅手动触发 (workflow_dispatch)

**功能**：
- 紧急情况下手动发布到 NPM
- 用于修复发布失败等特殊情况

**使用方式**：
1. 进入 GitHub Actions 页面
2. 选择 "Manual Publish to NPM" 工作流
3. 点击 "Run workflow"
4. 运行

⚠️ **注意**：通常应该使用 `/release` skill 或 `release.yml` 自动发布，此 workflow 仅用于紧急情况。

## 4. 自动推送 (auto-push.yml)

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

## 发布新版本的完整流程 🚀

### 方式一：使用 /release Skill（推荐）⭐

```bash
# 在 Claude Code 中使用
/release patch   # 修复 bug
/release minor   # 添加新功能
/release major   # 破坏性更新
```

一键完成所有流程：
1. ✅ 提交代码
2. 📦 升级版本号
3. 🏷️ 创建 tag
4. 🚀 推送到 GitHub
5. 🎉 自动发布到 NPM + 创建 Release

### 方式二：手动操作（不推荐）

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 添加新功能"

# 2. 更新版本号并创建 tag
npm version patch  # 1.1.5 -> 1.1.6
# 或 npm version minor  # 1.1.5 -> 1.2.0
# 或 npm version major  # 1.1.5 -> 2.0.0

# 3. 推送代码和 tag
git push && git push --tags

# 4. release.yml 自动触发，完成发布到 NPM 和创建 Release
```

## 配置 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 用途 | 类型 | 获取方式 |
|------------|------|------|---------|
| `NPM_TOKEN` | 发布到 NPM | **Granular Access Token** | [查看详细配置指南](./NPM_TOKEN_SETUP.md) |

**⚠️ 重要**：必须使用 **Granular Access Token**（不是 Classic Token），并启用 "Allow publishing with 2FA enabled" 选项。

**快速配置**：
1. 访问：https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. 创建 **Granular Access Token**
3. 勾选 ✅ **"Allow publishing with 2FA enabled"**
4. 在 GitHub 仓库设置中添加为 `NPM_TOKEN` secret

📖 **详细说明**：请参阅 [NPM_TOKEN_SETUP.md](./NPM_TOKEN_SETUP.md)

配置路径：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`
