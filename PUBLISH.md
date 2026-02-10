# 发布指南

## 前置条件

- 已登录 npm: `npm login`
- 已安装依赖: `pnpm install`

## 发布命令

### Beta 版本

```bash
# 1. 修改 package.json 中 version 为 x.x.x-beta.N 格式
# 2. 构建并发布
pnpm build && pnpm publish --tag beta --access public --no-git-checks
```

安装 beta 版本: `openclaw plugins install timbot@beta`

### 正式版本

```bash
# 1. 修改 package.json 中 version 为 x.x.x 格式（去掉 -beta.N）
# 2. 构建并发布
pnpm build && pnpm publish --access public --no-git-checks
```

安装正式版本: `openclaw plugins install timbot`

## 本地开发

```bash
# 卸载旧版本
bash uninstall-timbot.sh

# 构建 + 安装（link 模式）
bash install-timbot.sh

# 测试 onboarding
openclaw channels add
```

## 版本号规范

- 正式版: `2026.2.10`
- Beta 版: `2026.2.10-beta.1`, `2026.2.10-beta.2`, ...
- 每次发布前递增版本号
