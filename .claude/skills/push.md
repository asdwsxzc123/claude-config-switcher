# Push Skill

快速提交并推送代码到 GitHub（不升级版本）。

## Usage

```bash
/push [commit-message]
```

参数：
- `commit-message` (可选): 提交信息，不提供时会交互式询问

## Steps

1. 检查 git 状态
2. 显示将要提交的文件
3. 获取提交信息（如果未提供）
4. 执行 `git add . && git commit -m "message" && git push`

## Example

```bash
# 交互式推送
/push

# 直接指定提交信息
/push "fix: 修复配置切换问题"
```

## Notes

- 仅推送代码，不会升级版本和创建 tag
- 适合日常开发时的快速提交
- 如果需要发布新版本，请使用 /release
