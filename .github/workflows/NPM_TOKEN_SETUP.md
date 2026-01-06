# NPM Token 配置指南

GitHub Actions 自动发布到 NPM 需要配置正确的 NPM Token。

## 问题

如果遇到以下错误：
```
403 Forbidden - Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

说明你需要使用 **Granular Access Token**（细粒度访问令牌）。

## 解决方案

### 1. 创建 Granular Access Token

访问：https://www.npmjs.com/settings/YOUR_USERNAME/tokens

1. 点击 **"Generate New Token"**
2. 选择 **"Granular Access Token"**（不是 Classic Token）
3. 配置以下选项：

   **Token name**: `GitHub Actions - claude-code-switcher`

   **Expiration**: 自定义（建议 1 年或更长）

   **Packages and scopes**:
   - 选择 **"Read and write"**
   - 在包列表中选择 `claude-code-switcher`
   - 如果包还不存在，选择 **"All packages"** 或创建后再限制

   **Organizations**:
   - 如果需要，选择你的组织

   **⭐ 重要：启用 "Allow publishing with 2FA enabled"**
   - 勾选这个选项以允许在启用 2FA 的情况下发布

4. 点击 **"Generate token"**
5. **立即复制 token**（只会显示一次！）

### 2. 在 GitHub 仓库中配置 Secret

1. 访问：https://github.com/asdwsxzc123/claude-config-switcher/settings/secrets/actions

2. 如果已有 `NPM_TOKEN`：
   - 点击 `NPM_TOKEN`
   - 点击 **"Update"**
   - 粘贴新的 Granular Access Token
   - 点击 **"Update secret"**

3. 如果没有 `NPM_TOKEN`：
   - 点击 **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Secret: 粘贴你的 Granular Access Token
   - 点击 **"Add secret"**

### 3. 验证配置

配置完成后，再次运行发布流程：

```bash
/release patch
```

GitHub Actions 会使用新的 token 发布到 NPM。

## Classic Token vs Granular Token

| 类型 | 2FA 支持 | 权限控制 | 推荐 |
|------|---------|---------|------|
| **Classic Token** (Automation) | ❌ 不支持发布 | 全局权限 | ❌ 不推荐 |
| **Granular Access Token** | ✅ 支持发布 | 细粒度控制 | ✅ 推荐 |

## 常见问题

**Q: 为什么之前的 Automation Token 不能用了？**

A: NPM 在 2023 年后要求所有启用了 2FA 的账户必须使用 Granular Access Token 才能发布包。

**Q: Token 过期了怎么办？**

A: 重新生成一个新的 Granular Access Token，并更新 GitHub Secret。

**Q: 我可以为多个仓库使用同一个 Token 吗？**

A: 可以，但建议为每个项目创建独立的 token，并限制权限范围以提高安全性。

## 参考资料

- [NPM Tokens](https://docs.npmjs.com/about-access-tokens)
- [Granular Access Tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
