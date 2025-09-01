# Claude Code Switcher Webhook Hooks 使用指南

## 概述

Claude Code Switcher 现在支持与 Claude Code Hooks 深度集成，能够在 Claude Code 执行特定操作时自动发送 webhook 通知。这个功能专为提升开发协作效率而设计，特别适合：

- 🤝 **团队协作**：实时通知团队成员 Claude 的操作进展
- 📋 **任务跟踪**：自动监控任务完成状态和重要节点
- 🔄 **流程管控**：在关键用户交互点进行及时提醒
- 📊 **操作审计**：记录重要的代码修改和命令执行

### 核心优势

- ✅ **零配置启动**：一键添加 webhook，自动生成 Claude Code 配置
- 🎯 **智能过滤**：只推送真正重要的事件，避免消息轰炸
- 🔧 **灵活配置**：支持多种消息格式和过滤条件
- 🚀 **即插即用**：完全兼容现有的 Claude Code 工作流

## 快速开始

### 🚀 三步快速配置

#### 第一步：添加 Webhook URL

```bash
# 飞书机器人 webhook（推荐）
ccs webhook add "https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id" "项目通知"

# Slack 传入 webhook
ccs webhook add "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" "Slack通知"

# 企业微信群机器人
ccs webhook add "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key" "企微通知"

# Discord webhook
ccs webhook add "https://discord.com/api/webhooks/your-webhook-id/your-token" "Discord通知"

# 查看已配置的 webhook
ccs webhook list
```

> 💡 **提示**：可以同时添加多个 webhook，系统会并行推送到所有启用的端点

#### 第二步：配置智能监听

```bash
# 启动交互式配置向导
ccs webhook hooks
```

配置向导会引导你完成：

1. **📋 选择监听事件**：
   - ✅ 退出规划模式（用户确认执行方案时）
   - ✅ 任务列表更新（任务完成时智能检测）
   - 📝 文件编辑操作（代码修改时）
   - 🛠️ Bash 命令执行（重要操作时）
   - 📄 文件写入操作（新增文件时）

2. **🎯 选择过滤级别**：
   - **智能过滤**（推荐）：只推送重要节点和完成状态
   - **用户确认类**：只监听需要用户决策的时刻
   - **任务完成类**：专注于工作进度和成果
   - **全部事件**：接收所有选中事件的通知

3. **⚙️ 自动配置**：一键更新 `~/.claude/settings.json` 文件

#### 第三步：验证配置

```bash
# 发送测试消息验证配置
ccs webhook push "🎉 Claude Code Hooks 配置成功！"

# 查看详细配置信息
ccs webhook list
```

配置完成后，Claude Code 会在执行相关操作时自动推送通知到你的聊天工具。

## 📊 支持的事件类型

### 🤝 用户交互类事件
- **📋 ExitPlanMode**: 用户确认执行计划时触发
  - 触发时机：Claude 完成任务规划，等待用户确认
  - 通知内容：规划完成提醒，包含执行时间

- **📝 Edit**: 文件编辑操作时触发
  - 触发时机：修改现有文件内容
  - 通知内容：文件路径、修改时间

- **📄 Write**: 新建文件操作时触发
  - 触发时机：创建新文件
  - 通知内容：文件路径、创建时间

- **⚡ MultiEdit**: 批量文件编辑时触发
  - 触发时机：同时修改多个文件
  - 通知内容：修改文件数量、操作时间

- **🛠️ Bash**: 命令执行时触发
  - 触发时机：执行 shell 命令
  - 通知内容：命令内容、执行时间

### ✅ 任务完成类事件
- **📋 TodoWrite**: 任务状态变更时触发
  - 智能检测：仅在任务标记为完成时推送
  - 通知内容：完成的任务信息、完成时间
  - 过滤逻辑：避免每次任务列表更新都发送通知

## 🎯 智能消息过滤

### 过滤级别说明

| 过滤级别 | 适用场景 | 消息频率 | 推荐指数 |
|---------|---------|----------|----------|
| 🧠 **智能过滤** | 日常开发协作 | 低（仅重要节点） | ⭐⭐⭐⭐⭐ |
| 🤝 **用户确认类** | 需要人工介入的操作 | 中等 | ⭐⭐⭐⭐ |
| ✅ **任务完成类** | 专注项目进度跟踪 | 低 | ⭐⭐⭐ |
| 📢 **全部事件** | 调试或详细监控 | 高 | ⭐⭐ |

### 智能过滤机制

- **TodoWrite 事件**：只有当任务状态变为 `completed` 时才推送
- **ExitPlanMode 事件**：用户确认执行计划的关键时刻推送
- **其他事件**：使用简洁格式，避免信息冗余

### 消息格式示例

```
🔔 任务列表更新: 事件触发
时间: 2024-01-15 14:30:25
类型: ✅ 任务完成
详情: 有任务被标记为完成
```

## 配置文件说明

### Webhook 配置文件 (`~/.claude/webhook.json`)

```json
{
  "webhooks": [
    {
      "name": "项目通知",
      "url": "https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id",
      "enabled": true,
      "events": ["claude_hooks"],
      "conditions": {},
      "format": "feishu",
      "retries": 3,
      "timeout": 5000,
      "retryDelay": 1000
    }
  ]
}
```

### Claude Code Hooks 配置 (`~/.claude/settings.json`)

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-token-here"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-code-switcher webhook push \"🔔 退出规划模式: 事件触发\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n类型: 📋 规划完成\\n详情: 用户确认执行计划\""
          }
        ]
      },
      {
        "matcher": "TodoWrite",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \\\"$TOOL_INPUT\\\" | grep -q '\\\"status\\\":\\\"completed\\\"'; then npx claude-code-switcher webhook push \\\"🔔 任务列表更新: 事件触发\\n时间: $(date '+%Y-%m-%d %H:%M:%S')\\n类型: ✅ 任务完成\\n详情: 有任务被标记为完成\\\"; fi"
          }
        ]
      }
    ]
  }
}
```

## 命令参考

### Webhook 管理命令

```bash
# 子命令方式（推荐）
ccs webhook add <url> [name]        # 添加 webhook
ccs webhook list                    # 显示配置
ccs webhook remove                  # 删除配置
ccs webhook push <message>          # 推送消息
ccs webhook hooks                   # 配置 hooks 监听

# 兼容性命令
ccs webhook-add <url> [name]
ccs webhook-list
ccs webhook-remove
ccs webhook-push <message>
ccs webhook-hooks
```

### 环境变量

在 hook 命令中可以使用以下环境变量：

- `$TOOL_NAME`: 执行的工具名称
- `$TOOL_INPUT`: 工具输入的 JSON 字符串
- `$TOOL_INPUT_FILE_PATH`: 文件路径（适用于文件操作）
- `$TOOL_INPUT_COMMAND`: 命令内容（适用于 Bash 工具）

## 💼 实际应用场景

### 🏢 团队协作场景

#### 场景一：敏捷开发团队
- **需求**：实时了解开发进度，关键节点及时沟通
- **配置**：智能过滤 + 飞书群通知
- **效果**：任务完成自动通知，规划确认提醒团队成员

#### 场景二：代码审查流程
- **需求**：代码修改后及时通知 reviewer
- **配置**：用户确认类事件 + Slack 通知
- **效果**：文件修改完成后自动提醒代码审查

#### 场景三：项目管理跟踪
- **需求**：监控项目里程碑和任务完成情况
- **配置**：任务完成类事件 + 企业微信通知
- **效果**：重要任务完成时自动更新项目状态

### 🔧 运维监控场景

#### 场景四：生产环境操作审计
- **需求**：记录重要的系统操作和配置变更
- **配置**：Bash 命令事件 + 多渠道通知
- **效果**：敏感操作实时记录，确保操作可追溯

#### 场景五：自动化工作流触发
- **需求**：Claude 完成特定任务后触发其他系统
- **配置**：自定义 webhook 端点
- **效果**：无缝集成 CI/CD 和其他自动化工具

### 📈 个人效率场景

#### 场景六：工作日志自动记录
- **需求**：自动记录每天的开发活动
- **配置**：智能过滤 + 个人通知频道
- **效果**：自动生成工作记录，便于回顾总结

## 🛠️ 故障排除指南

### 📡 Webhook 推送问题

#### 推送失败 (HTTP 错误)
```bash
# 检查 webhook URL 有效性
curl -X POST "your-webhook-url" -H "Content-Type: application/json" -d '{"msg_type":"text","content":{"text":"测试消息"}}'

# 验证网络连接
ping your-webhook-domain.com
```

**常见错误码：**
- `HTTP 404`：webhook URL 不存在或已失效
- `HTTP 403`：权限不足，检查机器人配置
- `HTTP 429`：请求频率过高，调整推送频率

#### 消息不显示
- 检查机器人是否已加入群聊
- 验证消息格式是否符合平台要求
- 确认群聊是否允许机器人发言

### ⚙️ Hooks 配置问题

#### Hooks 不触发
```bash
# 验证配置文件格式
jq . ~/.claude/settings.json

# 检查 Claude Code 版本
claude-code --version

# 测试环境变量传递
echo $TOOL_NAME $TOOL_INPUT
```

**检查清单：**
- ✅ `~/.claude/settings.json` JSON 格式正确
- ✅ hooks 配置在正确位置
- ✅ matcher 名称拼写正确
- ✅ 命令路径可执行

#### 消息内容异常
```bash
# 测试命令执行
TOOL_INPUT='{"status":"completed"}' bash -c 'if echo "$TOOL_INPUT" | grep -q "completed"; then echo "匹配成功"; fi'

# 验证日期格式
date '+%Y-%m-%d %H:%M:%S'

# 检查引号转义
echo "测试消息\n时间: $(date)"
```

### 🔧 性能优化建议

#### 减少通知频率
- 使用智能过滤模式
- 避免监听高频事件（如 Read 操作）
- 合理设置消息内容长度

#### 提升推送成功率
- 配置重试机制
- 使用多个 webhook 作为备选
- 监控推送成功率

### 📞 获取帮助

如果问题仍未解决：

1. **查看日志**：检查 Claude Code 运行日志
2. **最小复现**：使用 `ccs webhook push` 测试基础功能
3. **社区支持**：在 GitHub Issues 中提问
4. **版本检查**：确保使用最新版本

## 示例配置

项目根目录包含了 `example-settings.json` 文件，展示了完整的配置示例。

## 技术支持

如遇问题，请检查：
1. Claude Code Switcher 版本是否为最新
2. Node.js 版本是否兼容
3. 依赖包是否正确安装

更多信息请参考项目主 README 文件。