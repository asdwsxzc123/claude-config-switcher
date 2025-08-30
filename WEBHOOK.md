# Webhook 功能使用指南

## 功能概述

Claude Config Switcher 支持在配置切换时发送 webhook 通知，目前主要支持飞书机器人消息推送。

## 快速配置

### 1. 获取飞书机器人 webhook URL

1. 在飞书群聊中，点击右上角设置按钮
2. 选择"群机器人"
3. 点击"添加机器人"，选择"自定义机器人"
4. 填写机器人名称和描述
5. 复制生成的 webhook URL

### 2. 配置 webhook

使用命令直接配置：

```bash
ccs webhook add https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-token
```

### 3. 验证配置

查看当前配置：

```bash
ccs webhook show
```

## 命令使用说明

### 添加/更新 webhook URL

```bash
ccs webhook add <url>
```

示例：
```bash
ccs webhook add https://open.feishu.cn/open-apis/bot/v2/hook/43bf300a-2eaa-4131-9155-30d120855933
```

### 查看当前配置

```bash
ccs webhook show
```

### 删除 webhook 配置

```bash
ccs webhook remove
```

## 消息格式

当配置切换成功时，会发送如下格式的消息：

```
[Claude Config Switcher] 配置切换通知
时间: 2025-08-30 18:30:00
从: old-config-name
切换到: new-config-name  
模型: claude-3-5-sonnet-20241022
API地址: https://api.example.com
```

## 功能特性

### ✅ 已实现特性

- **非阻塞执行**：webhook 发送失败不会影响配置切换流程
- **自动重试**：默认重试 3 次，每次递增延迟（1s, 2s, 3s）
- **错误处理**：详细的错误日志记录
- **URL 验证**：自动验证 webhook URL 格式
- **静默跳过**：未配置时静默跳过，不产生错误

### 🔧 配置验证

系统会自动验证配置：
- 检查 `webhook_url` 字段是否存在
- 验证 URL 格式是否正确（http/https）
- 配置文件格式错误时显示警告

## 故障排除

### webhook 消息未发送

1. **检查配置文件**：确认 `~/.claude/webhook.json` 存在且格式正确
2. **验证 URL**：确认飞书机器人 webhook URL 有效
3. **网络连接**：确认网络可以访问飞书 API
4. **查看日志**：关注控制台的警告和错误信息

### 常见错误

**错误：`webhook URL 格式无效`**
- 检查 URL 是否包含协议（http/https）
- 确认 URL 格式符合标准

**错误：`请求超时`**
- 检查网络连接
- 飞书 API 可能暂时不可用，会自动重试

**错误：`HTTP 400/404`**
- webhook URL 可能已失效，请重新生成

## 安全注意事项

⚠️ **重要提醒**：

1. **保护 webhook URL**：不要在公开场所分享您的 webhook URL
2. **定期更换**：建议定期更换飞书机器人的 webhook 地址
3. **访问控制**：确保只有授权用户能访问配置文件

## 技术实现

### 消息发送流程

1. 配置切换成功后触发 webhook
2. 读取 `~/.claude/webhook.json` 配置
3. 验证配置和 URL 格式
4. 构造飞书机器人消息格式
5. 发送 HTTP POST 请求
6. 重试机制处理失败情况

### 重试策略

- 最大重试次数：3 次
- 重试间隔：递增延迟（1s, 2s, 3s）
- 最终失败：记录警告日志，不影响主流程

## 扩展和自定义

当前实现专门针对飞书机器人进行了优化，如需支持其他平台（如钉钉、企业微信），可以通过修改消息格式来实现。

代码位置：`lib/webhook.js` 的 `buildConfigSwitchMessage` 函数。

## 反馈和支持

如遇到问题或有改进建议，请在 GitHub 仓库提交 Issue。