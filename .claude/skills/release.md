# Release Skill

自动化版本发布流程，包括提交代码、升级版本、推送到 GitHub。

## Usage

```bash
/release [version-type]
```

参数：
- `version-type` (可选): `patch` | `minor` | `major`
  - 不提供时会交互式询问

## Steps

1. **检查 Git 状态**
   - 查看是否有未提交的文件
   - 显示当前版本号

2. **询问版本类型**（如果未提供参数）
   - patch: 补丁版本（bug 修复）如 1.1.5 -> 1.1.6
   - minor: 次版本（新功能）如 1.1.5 -> 1.2.0
   - major: 主版本（破坏性更新）如 1.1.5 -> 2.0.0

3. **生成提交信息**
   - 基于 git diff 分析改动
   - 生成符合规范的 commit message

4. **执行发布流程**
   ```bash
   git add .
   git commit -m "提交信息"
   npm version [patch|minor|major]
   git push && git push --tags
   ```

5. **显示结果**
   - 新版本号
   - GitHub Actions 链接
   - NPM 发布链接

## Example

```bash
# 交互式发布
/release

# 直接指定版本类型
/release patch
/release minor
/release major
```

## Notes

- 需要配置 NPM_TOKEN secret 才能自动发布到 NPM
- 推送 tag 后会自动触发 GitHub Actions
- 确保所有测试通过后再发布
