# Claude配置切换工具 (CCS)

一个用于在不同的 Claude Code API 配置之间进行切换的命令行工具。
## 功能

- **API配置并提示选择**
- **WebDAV网盘集成**
  - 配置WebDAV网盘连接设置
  - 上传配置文件到WebDAV网盘
  - 配置切换后可选择同步到网盘

## 安装
```bash
npm install -g claude-code-switcher
```
## 使用文档
#### 1. 添加新的API配置

```bash
ccs add <alias> <key> <url>
```

通过命令行直接添加新的API配置到配置文件中，**并自动激活该配置**。

**参数说明：**
- `alias`: 配置别名，用于标识该配置
- `key`: Claude API 密钥 (如: sk-xxxxxxx)
- `url`: API 基础URL (如: https://api.example.com)

**使用示例：**

```bash
# 添加一个新的配置（会自动激活）
ccs add my-api sk-xxxxxxxxxxxxxxxx https://api.example.com
```

**注意：** 添加配置后会自动切换到新配置，无需手动执行 `ccs use` 命令。
#### 2. 获取API配置列表
```bash
ccs ls
```
#### 3. webdav配置

##### webdav.json - WebDAV网盘配置（可选）

存储WebDAV网盘连接设置，格式如下：

```json
{
  "url": "https://your-webdav-api.com",
  "username": "your-username",
  "password": "your-password"
}
```

#### 2. 删除的API配置

```bash
ccs del
```

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
      "ANTHROPIC_BASE_URL": "https://xxx/pg",
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
  webdav              配置webdav网盘设置
  help [command]     display help for command
```
