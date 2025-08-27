# WebDAV 网盘功能使用说明

## 功能概述

Claude配置切换工具现在支持WebDAV协议，可以将您的配置文件上传到支持WebDAV的网盘服务中进行备份和同步。

## 支持的WebDAV服务

- 坚果云
- Nextcloud
- ownCloud
- Box
- Dropbox (通过WebDAV接口)
- 其他支持WebDAV协议的网盘服务

## 配置步骤

### 1. 配置WebDAV连接

```bash
ccs webdav-config
# 或者使用
ccs webdav config
```

系统将提示您输入以下信息：
- **WebDAV服务器地址**: 如 `https://dav.jianguoyun.com/dav/`
- **用户名**: 您的网盘用户名或邮箱
- **密码**: 您的网盘密码或应用密码
- **远程存储路径**: 可选，默认为 `/claude-configs/`

### 2. 上传配置文件

```bash
ccs webdav-upload
# 或者使用
ccs webdav upload
```

此命令会将以下文件上传到WebDAV网盘：
- `apiConfigs.json` - API配置列表
- `settings.json` - 当前激活配置
- `CLAUDE.md` - Claude配置说明文件
- `webdav.json` - WebDAV配置信息（密码已掩码）

### 3. 下载配置文件

```bash
ccs webdav-download
# 或者使用
ccs webdav download
```

此命令会从WebDAV网盘下载所有配置文件到本地：
- `apiConfigs.json` - API配置列表
- `settings.json` - 当前激活配置  
- `CLAUDE.md` - Claude配置说明文件
- `webdav.json` - WebDAV配置信息（自动合并本地密码）

### 4. 列出远程文件

```bash
ccs webdav-list
# 或者使用
ccs webdav list
```

查看WebDAV网盘中的所有配置文件及其修改时间。

### 5. 双向同步

```bash
ccs webdav-sync
# 或者使用
ccs webdav sync
```

提供交互式选项进行双向同步：
- 从网盘下载到本地
- 从本地上传到网盘
- 查看远程文件列表

### 6. 自动同步

当您使用 `ccs list` 或 `ccs use <index>` 切换配置后，如果已配置WebDAV，系统会询问是否自动上传到网盘。

## 常见WebDAV配置示例

### 坚果云
```
WebDAV服务器地址: https://dav.jianguoyun.com/dav/
用户名: 您的邮箱
密码: 应用密码（不是登录密码）
```

### Nextcloud
```
WebDAV服务器地址: https://your-nextcloud.com/remote.php/dav/files/USERNAME/
用户名: 您的用户名
密码: 您的密码或应用密码
```

## 安全说明

- 密码信息存储在本地 `~/.claude/webdav.json` 文件中
- 上传到网盘的配置文件中，密码字段会被掩码处理
- 建议使用应用专用密码而不是主密码
- 确保WebDAV连接使用HTTPS协议

## 故障排除

### 连接失败
1. 检查网络连接
2. 验证WebDAV地址是否正确
3. 确认用户名和密码正确
4. 检查是否需要使用应用专用密码

### 上传失败
1. 检查远程路径是否有写权限
2. 确认网盘空间是否充足
3. 检查文件名是否符合服务器要求

### 超时问题
- 默认超时时间为30秒
- 如果网络较慢，可能需要等待更长时间
- 大文件上传可能需要更多时间

## 命令参考

### WebDAV 相关命令（推荐使用）
- `ccs webdav-config` 或 `ccs webdav config` - 配置WebDAV设置
- `ccs webdav-upload` 或 `ccs webdav upload` - 上传配置到WebDAV
- `ccs webdav-download` 或 `ccs webdav download` - 从WebDAV下载配置文件
- `ccs webdav-list` 或 `ccs webdav list` - 列出WebDAV网盘中的远程文件
- `ccs webdav-sync` 或 `ccs webdav sync` - 双向同步配置（交互式选择）

### 基础配置命令
- `ccs current` - 查看当前配置
- `ccs list` - 列出并切换配置（可选择上传到WebDAV）
- `ccs use <index>` - 直接切换配置（可选择上传到WebDAV）
