# Claude Code Hooks 使用指南

## 概述

Claude Code Hooks 是用户定义的 shell 命令，在 Claude Code 执行的特定生命周期节点自动运行。它们提供对 Claude Code 行为的确定性控制，确保某些操作总是执行，而不依赖 LLM 的选择。

## 核心概念

### 什么是 Hooks？
- **定义**：在特定事件触发时自动执行的 shell 命令
- **目的**：提供自动化、验证和控制功能
- **特点**：确定性执行，不依赖 AI 判断

### Hook 的执行时机
- **PreToolUse**：在工具调用前执行
- **PostToolUse**：在工具调用后执行（计划中）

## 主要使用场景

### 1. 自动格式化代码
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *.py ]]; then black \"$TOOL_INPUT_FILE_PATH\"; fi"
          }
        ]
      }
    ]
  }
}
```

### 2. 代码质量检查
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *.js ]]; then eslint \"$TOOL_INPUT_FILE_PATH\" || exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

### 3. 权限控制
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *production* ]]; then echo '禁止修改生产环境文件' >&2; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

### 4. 日志记录
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date): $TOOL_INPUT_COMMAND\" >> ~/.claude/command-log.txt"
          }
        ]
      }
    ]
  }
}
```

### 5. 自动备份
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -f \"$TOOL_INPUT_FILE_PATH\" ]]; then cp \"$TOOL_INPUT_FILE_PATH\" \"$TOOL_INPUT_FILE_PATH.backup.$(date +%s)\"; fi"
          }
        ]
      }
    ]
  }
}
```

## 配置方法

### 方法一：交互式配置（推荐）
```bash
/hooks
```
使用菜单界面配置，比手动编辑 JSON 更简单直观。

### 方法二：直接编辑配置文件
编辑 `~/.claude/settings.json` 或项目级别的 `settings.json`：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "工具名称",
        "hooks": [
          {
            "type": "command",
            "command": "你的命令"
          }
        ]
      }
    ]
  }
}
```

## Hook 配置结构详解

### 基本结构
```json
{
  "hooks": {
    "事件类型": [
      {
        "matcher": "工具匹配器",
        "hooks": [
          {
            "type": "command",
            "command": "shell命令",
            "timeout": 60000
          }
        ]
      }
    ]
  }
}
```

### 配置参数说明
- **事件类型**：`PreToolUse`（工具执行前）
- **matcher**：工具匹配器（如 `Bash`、`Edit`、`Write` 等）
- **type**：固定为 `"command"`
- **command**：要执行的 shell 命令
- **timeout**：超时时间（毫秒，默认 60000）

## 环境变量

Hook 执行时可用的环境变量：

### 通用变量
- `TOOL_NAME`：工具名称
- `TOOL_INPUT`：工具输入的 JSON 字符串

### 特定工具变量
- `TOOL_INPUT_FILE_PATH`：文件路径（Edit、Write、Read 工具）
- `TOOL_INPUT_COMMAND`：命令内容（Bash 工具）
- `TOOL_INPUT_CONTENT`：文件内容（Write 工具）

## Hook 控制机制

### 退出代码控制
- **0**：成功，继续执行
- **1**：警告，继续执行但记录错误
- **2**：阻断，停止工具执行，stderr 内容反馈给 Claude

### JSON 结构化控制
在 stdout 输出 JSON 格式的控制信息：

```json
{
  "continue": false,
  "stopReason": "自定义阻断原因",
  "feedback": "给 Claude 的反馈信息"
}
```

## 实际应用示例

### TypeScript 项目完整配置
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *.ts || \"$TOOL_INPUT_FILE_PATH\" == *.tsx ]]; then prettier --write \"$TOOL_INPUT_FILE_PATH\" 2>/dev/null || true; fi"
          },
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *.ts || \"$TOOL_INPUT_FILE_PATH\" == *.tsx ]]; then eslint \"$TOOL_INPUT_FILE_PATH\" --fix 2>/dev/null || true; fi"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] 执行命令: $TOOL_INPUT_COMMAND\" >> ~/.claude/bash-history.log"
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *node_modules* ]]; then echo '警告：不建议修改 node_modules 文件' >&2; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

### Python 项目配置
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *.py ]]; then black \"$TOOL_INPUT_FILE_PATH\" 2>/dev/null && isort \"$TOOL_INPUT_FILE_PATH\" 2>/dev/null; fi"
          },
          {
            "type": "command",
            "command": "if [[ \"$TOOL_INPUT_FILE_PATH\" == *.py ]]; then flake8 \"$TOOL_INPUT_FILE_PATH\" || echo '代码风格检查发现问题，请注意' >&2; fi"
          }
        ]
      }
    ]
  }
}
```

## 高级特性

### 条件执行
```bash
# 基于文件类型的条件执行
if [[ "$TOOL_INPUT_FILE_PATH" == *.py ]]; then
    # Python 文件处理
elif [[ "$TOOL_INPUT_FILE_PATH" == *.js ]]; then
    # JavaScript 文件处理
fi

# 基于工具类型的条件执行
case "$TOOL_NAME" in
    "Edit")
        # 编辑操作处理
        ;;
    "Write")
        # 写入操作处理
        ;;
esac
```

### 并行执行和去重
- 匹配的 hooks 自动并行运行
- 相同的 hook 命令自动去重
- 60 秒默认执行超时（可自定义）

### MCP 工具支持
Hook 也适用于 MCP (Model Context Protocol) 工具：
```json
{
  "matcher": "mcp__server__tool",
  "hooks": [...]
}
```

## 调试和故障排除

### 常见问题

1. **Hook 未执行**
   - 检查 matcher 是否正确匹配工具名称
   - 确认配置 JSON 格式正确
   - 查看 Claude Code 日志

2. **命令执行失败**
   - 检查命令路径和权限
   - 验证环境变量是否可用
   - 测试命令是否在 shell 中正常工作

3. **意外阻断**
   - 检查退出代码逻辑
   - 查看 stderr 输出
   - 确认条件判断是否正确

### 调试技巧

1. **日志输出**
```bash
echo "Debug: $TOOL_NAME - $TOOL_INPUT_FILE_PATH" >> /tmp/claude-debug.log
```

2. **环境变量检查**
```bash
env | grep TOOL_ >> /tmp/claude-env.log
```

3. **条件测试**
```bash
if [[ -z "$TOOL_INPUT_FILE_PATH" ]]; then
    echo "文件路径为空" >&2
    exit 1
fi
```

## 最佳实践

### 1. 设计原则
- **单一职责**：每个 hook 只做一件事
- **幂等性**：多次执行结果一致
- **快速执行**：避免长时间运行的操作
- **错误处理**：妥善处理各种异常情况

### 2. 性能优化
- 使用条件判断避免不必要的执行
- 利用并行执行特性
- 合理设置超时时间
- 缓存重复计算结果

### 3. 安全考虑
- 验证文件路径和输入
- 避免执行不受信任的代码
- 限制 hook 的权限范围
- 记录敏感操作日志

### 4. 维护建议
- 定期检查和更新 hook 配置
- 备份重要的 hook 脚本
- 文档化自定义 hook 的功能
- 团队共享通用 hook 配置

## 总结

Claude Code Hooks 提供了强大的自动化和控制能力，让您能够：

- 🔧 **自动化**：格式化代码、运行测试、生成文档
- 🛡️ **控制**：权限管理、路径限制、操作验证  
- 📊 **监控**：日志记录、性能跟踪、操作审计
- 🎯 **定制**：根据项目需求自定义工作流程

通过合理配置和使用 Hooks，您可以显著提升使用 Claude Code 的效率和安全性，确保代码质量和开发规范的一致性。