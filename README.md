# Claude配置切换工具 (CCS)

一个用于在不同的 Claude Code API 配置之间进行切换的命令行工具。
## Claude code 中转可用推荐 (更新时间 2025-08-19)
- 使用邀请码送的积分会多一些。
1. 注册送 10刀,每天签到(需要充值 30 元)送额度  https://claude.husan97x.xyz/register?aff=k02G  
1. 每天3000积分(20刀左右)  https://www.aicodemirror.com/register?invitecode=8KTOWC
1. 注册送1000point(20刀左右)  https://aicodeditor.com/register?invitecode=VHE6FK
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
- **Webdva网盘集成**
  - 配置Webdva网盘连接设置
  - 上传配置文件到Webdva网盘
  - 配置切换后可选择同步到网盘
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
      },
      "model": "opus"
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
      },
      "model": "opus"
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
  "model": "opus"
}
```

**注意**：切换配置时，整个 `settings.json` 文件会被选中配置的 `config` 对象完全替换。

#### 3. webdva.json - Webdva网盘配置（可选）

存储Webdva网盘连接设置，格式如下：

```json
{
  "url": "https://your-webdva-api.com",
  "token": "your-access-token"
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
    },
    "model": "opus"
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
    },
    "model": "opus"
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
    },
    "model": "opus"
  }
}

? 确认切换到此配置? Yes

成功切换到配置: zone
```

#### 配置Webdva网盘设置

```bash
# 配置Webdva网盘设置
ccs webdva config

# 上传配置到Webdva网盘
ccs webdva upload

# 下载网盘
ccs webdva download

```

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
