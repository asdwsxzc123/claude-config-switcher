# Claude配置切换工具 (CCS)

一个用于在不同的 Claude Code API 配置之间进行切换的命令行工具。
## Claude code 中转可用推荐 (更新时间 2025-08-19)
- 使用邀请码送的积分会多一些。
1. 注册送5刀,每天签到(需要充值 30 元)送额度  https://claude.husan97x.xyz/register?aff=k02G  
1. 每天3000积分  https://www.aicodemirror.com/register?invitecode=8KTOWC
1. 注册送1000point  https://aicodeditor.com/register?invitecode=VHE6FK
1. 注册送5刀  https://ai-router.plugins-world.cn/register?aff=VvoS


## 功能

- 列出所有可用的API配置并提示选择
  - 支持交互式菜单（光标上下移动选择）
  - 支持手动输入序号
  - **优化的界面排版**：配置名称、API密钥、URL都进行了对齐美化
  - **安全的密钥显示**：API密钥只显示前8位和后4位，中间用...代替
  - **彩色高亮显示**：不同信息用不同颜色标识，当前激活配置用✓标记
- 通过命令行直接添加新的API配置
- 切换当前使用的API配置
- 显示当前配置
- 显示版本信息
- **模型设置功能**
  - 交互式选择或直接设置模型
  - 支持删除模型设置
  - 查看当前模型和可用模型列表
- **WebDAV网盘集成**
  - 配置WebDAV网盘连接设置
  - 上传配置文件到WebDAV网盘
  - 配置切换后可选择同步到网盘
- **🔔 Webhook通知系统**
  - 与Claude Code Hooks深度集成
  - 支持飞书、Slack、企业微信、Discord等主流平台
  - 智能事件过滤，只推送重要通知
  - 用户交互和任务完成实时监控
  - 一键配置，零学习成本
- 错误处理和帮助提示

## 安装

### 本地安装

```bash
npm install -g claude-code-switcher
```

## 使用方法

### 配置文件

工具需要以下配置文件，都位于 `~/.claude/` 目录下：

#### 1. apiConfigs.json - API配置列表

存储所有可用的Claude API配置，格式如下：

```json
[
  {
    "name": "wenwen-ai",
    "config": {
      "env": {
        "ANTHROPIC_AUTH_TOKEN": "sk-XXXXXXX",
        "ANTHROPIC_BASE_URL": "https://code.wenwen-ai.com",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
      },
      "permissions": {
        "allow": [],
        "deny": []
      }
    }
  },
  {
    "name": "zone",
    "config": {
      "env": {
        "ANTHROPIC_AUTH_TOKEN": "sk-XXXXXXX",
        "ANTHROPIC_BASE_URL": "https://zone.veloera.org/pg",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
      },
      "permissions": {
        "allow": [],
        "deny": []
      }
    }
  }
]
```

#### 2. settings.json - 当前激活配置

存储当前使用的配置，格式如下：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://zone.veloera.org/pg",
    "ANTHROPIC_AUTH_TOKEN": "sk-XXXXXXX",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "permissions": {
    "allow": [],
    "deny": []
  },
  "model": "claude-opus-4-20250514"
}
```

**注意**：切换配置时，整个 `settings.json` 文件会被选中配置的 `config` 对象完全替换。

#### 3. webdav.json - WebDAV网盘配置（可选）

存储WebDAV网盘连接设置，格式如下：

```json
{
  "url": "https://your-webdav-api.com",
  "username": "your-username",
  "password": "your-password"
}
```

#### 4. webhook.json - Webhook通知配置（可选）

存储webhook通知设置，支持多个webhook并行推送：

```json
{
  "webhooks": [
    {
      "name": "项目通知",
      "url": "https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id",
      "enabled": true,
      "events": ["claude_hooks"],
      "format": "feishu",
      "retries": 3,
      "timeout": 5000
    }
  ]
}
```

### 命令

#### 添加新的API配置

```bash
ccs add <alias> <key> <url>
```

通过命令行直接添加新的API配置到配置文件中。

**参数说明：**
- `alias`: 配置别名，用于标识该配置
- `key`: Claude API 密钥 (如: sk-xxxxxxx)
- `url`: API 基础URL (如: https://api.example.com)

**使用示例：**

```bash
# 添加一个新的配置
ccs add my-api sk-xxxxxxxxxxxxxxxx https://api.example.com

# 添加wenwen-ai配置
ccs add wenwen-ai sk-xxxxxxxxxxxxxxxx https://code.wenwen-ai.com

# 添加zone配置
ccs add zone sk-xxxxxxxxxxxxxxxx https://zone.veloera.org/pg
```

**输出示例：**

```
成功添加配置: my-api

配置详情:
{
  "name": "my-api",
  "config": {
    "env": {
      "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxx",
      "ANTHROPIC_BASE_URL": "https://api.example.com",
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
    },
    "permissions": {
      "allow": [],
      "deny": []
    }
  }
}
```

**注意事项：**
- 如果别名已存在，新配置将覆盖原有配置
- 添加的配置会自动包含默认的权限设置和模型配置
- 配置会立即保存到 `~/.claude/apiConfigs.json` 文件中

#### 输出当前配置

```bash
ccs current
```

输出示例：

```
当前激活的配置: zone

配置详情:
{
  "name": "zone",
  "config": {
    "env": {
      "ANTHROPIC_AUTH_TOKEN": "sk-xxxx",
      "ANTHROPIC_BASE_URL": "https://zone.veloera.org/pg",
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
      "HTTPS_PROXY": "http://127.0.0.1:7890",
      "HTTP_PROXY": "http://127.0.0.1:7890"
    },
    "permissions": {
      "allow": [],
      "deny": []
    }
  }
}
```


#### 列出所有可用的API配置并提示选择

```bash
ccs list
```

输出示例：

```
? 请选择要切换的配置: (Use arrow keys)
> 1. [wenwen-ai  ] sk-xxxx...XXXX https://code.wenwen-ai.com       (当前)
  2. [zone       ] sk-yyyy...YYYY https://zone.veloera.org/pg
  3. [co.yes.vg  ] sk-zzzz...ZZZZ https://co.yes.vg/api
  4. [a-generic  ] sk-aaaa...AAAA https://a-generic.be-a.dev/api
  ──────────────
  输入序号...

? 请选择要切换的配置: 2. [zone       ] sk-yyyy...YYYY https://zone.veloera.org/pg

当前选择的配置:
{
  "name": "zone",
  "config": {
    "env": {
      "ANTHROPIC_AUTH_TOKEN": "sk-xxxx",
      "ANTHROPIC_BASE_URL": "https://zone.veloera.org/pg",
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
    },
    "permissions": {
      "allow": [],
      "deny": []
    }
  }
}

? 确认切换到此配置? Yes

成功切换到配置: zone
```

**交互方式**:

1. **光标选择**: 使用键盘上下箭头选择配置，按Enter确认
2. **手动输入**: 选择"输入序号..."选项，然后输入配置的序号

#### 打开配置文件位置

```bash
# 打开API配置文件
ccs open api

# 打开配置目录
ccs open dir
```

此命令支持跨平台：
- **macOS**: 使用 `open` 命令
- **Windows**: 使用 `start` 命令
- **Linux**: 使用 `xdg-open` 命令

#### 直接设置当前使用的API配置

```bash
ccs use <序号>
```

例如：

```bash
ccs use 2
```

输出示例：

```
当前选择的配置:
{
  "name": "zone",
  "config": {
    "env": {
      "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxx",
      "ANTHROPIC_BASE_URL": "https://zone.veloera.org/pg",
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
    },
    "permissions": {
      "allow": [],
      "deny": []
    }
  }
}

? 确认切换到此配置? Yes

成功切换到配置: zone
```

#### 设置模型

```bash
# 交互式选择模型
ccs model

# 直接设置模型
ccs model claude-opus-4-20250514

# 删除模型设置
ccs model delete
```

**交互式选择示例：**

```
? 请选择要设置的模型:
> claude-opus-4-20250514
  ──────────────
  删除模型设置
  取消

成功设置模型: claude-opus-4-20250514
```

#### 查看当前模型

```bash
ccs model-current
```

输出示例：

```
当前模型: claude-opus-4-20250514
```

#### 列出可用模型

```bash
ccs model-list
```

输出示例：

```
可用的模型:
  - claude-opus-4-20250514 (当前)
```

#### WebDAV 网盘同步

```bash
# WebDAV 子命令方式（推荐）
ccs webdav config          # 配置WebDAV网盘设置
ccs webdav upload          # 上传配置到WebDAV网盘
ccs webdav download        # 从网盘下载配置
ccs webdav list           # 列出网盘中的文件
ccs webdav sync           # 双向同步配置

# 兼容性命令
ccs webdav-config
ccs webdav-upload
ccs webdav-download
```

#### 🔔 Webhook 通知管理

```bash
# Webhook 子命令方式（推荐）
ccs webhook add <url> [name]     # 添加webhook URL
ccs webhook list                 # 显示当前配置
ccs webhook push <message>       # 推送测试消息
ccs webhook hooks               # 配置Claude Code Hooks监听
ccs webhook remove              # 删除webhook配置

# 兼容性命令
ccs webhook-add <url> [name]
ccs webhook-list
ccs webhook-push <message>
ccs webhook-hooks
ccs webhook-remove
```

**Webhook 快速配置：**

```bash
# 1. 添加飞书群机器人
ccs webhook add "https://open.feishu.cn/open-apis/bot/v2/hook/your-id" "项目通知"

# 2. 配置智能监听（交互式向导）
ccs webhook hooks

# 3. 测试推送
ccs webhook push "🎉 Claude Code Hooks 配置成功！"
```

详细使用说明请参考：[Webhook Hooks 使用指南](./docs/WEBHOOK_HOOKS_GUIDE.md)

#### 显示版本信息

```bash
ccs --version
# 或
ccs -v
```

输出示例：

```
ccs 版本: 1.0.0
```

#### 显示帮助信息

```bash
ccs --help
```

输出示例：

```
Usage: ccs [options] [command]

Claude配置切换工具

Options:
  -v, --version      显示版本信息
  -h, --help         display help for command

Commands:
  list               列出所有可用的API配置并提示选择
  add <alias> <key> <url>  添加新的API配置
  use <index>        设置当前使用的API配置
  current            显示当前激活的配置
  open <type>        打开配置文件位置 (type: api|dir)
  model [modelName]  设置或查看当前模型 (可选: 直接指定模型名称，使用 "delete" 删除模型设置)
  model-current      显示当前设置的模型
  model-list         列出所有可用的模型
  webdva-config      配置Webdva网盘设置
  upload             上传配置文件到Webdva网盘
  help [command]     display help for command
```

#### 错误处理

当输入不存在的命令时，会显示错误信息和可用命令列表：

```bash
ccs unknown
```

输出示例：

```
错误: 未知命令 'unknown'

可用命令:
  list
  add
  use
  current
  webdva-config
  upload

使用 --help 查看更多信息
```

## 注意事项

- 确保 `~/.claude/apiConfigs.json` 和 `~/.claude/settings.json` 文件存在并包含有效的配置信息
- 工具会自动创建 `~/.claude` 目录（如果不存在）
- 确认操作时默认为"是"，直接按Enter键即可确认
- 切换配置时会完全替换 `settings.json` 文件内容
