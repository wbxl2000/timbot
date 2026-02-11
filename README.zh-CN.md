# OpenClaw 腾讯云 IM 通道插件

维护者：longyuqi@tencent.com

状态：支持腾讯云即时通信 IM 智能机器人，通过 Webhook 回调 + REST API 实现。

**我们已在微信公众号发布完整对外接入教程：[完整对外接入教程](https://mp.weixin.qq.com/s/6iq-w023LGuYr6N9SR_kvw)**

## 安装

### 方式 A：从 npm 安装
```bash
openclaw plugins install timbot
```

### 方式 B：本地开发（link）
```bash
git clone <repo-url> && cd timbot
pnpm install && pnpm build
bash install-timbot.sh
```

## 快速开始

### 第一步：创建 IM 应用并获取凭证

1. 登录 [腾讯云即时通信 IM 控制台](https://console.cloud.tencent.com/im)
2. 点击**创建新应用**，输入名称，数据中心选择**中国**
3. 进入应用详情页，记录以下参数：
   - **SDKAppID** — 应用唯一标识 ID
   - **SecretKey** — 用于生成鉴权签名的密钥

### 第二步：创建机器人账号并配置消息回调

1. 在 IM 控制台左侧菜单点击 **REST API 调试**
2. 选择应用 → **机器人 → 创建机器人**，设置 UserID / Nick / FaceUrl，点击发起调用
3. 在左侧菜单选择 **回调配置 → 消息服务 Chat**：
   - **URL**：`http://<你的服务器IP>:18789/timbot`
   - 勾选**开启鉴权**
   - **鉴权 Token**：自定义字符串（如 `mysecrettoken`）
   - 勾选机器人事件下的**机器人事件回调**

### 第三步：配置并激活

#### 交互式配置（推荐）

```bash
openclaw onboard
```

在通道列表中选择 **Tencent IM (plugin)**，按提示输入 SDKAppID、SecretKey 和 Token。

### 第四步：开放网络权限

```bash
openclaw config set gateway.bind lan
openclaw gateway restart
```

确保服务器防火墙放行 **18789** 端口。

### 第五步：验证

通过 IM 客户端向机器人发送消息，收到回复即表示接入成功。

## 配置项说明

| 配置项 | 说明 |
|--------|------|
| `webhookPath` | Webhook 回调路径（默认 `/timbot`） |
| `sdkAppId` | 腾讯云 IM SDK 应用 ID |
| `secretKey` | 密钥，用于动态生成 UserSig |
| `botAccount` | 机器人账号 ID |
| `apiDomain` | 腾讯 IM API 域名（默认 `console.tim.qq.com`） |
| `token` | 回调签名验证 Token |
| `welcomeText` | 新会话欢迎语 |
| `dm.policy` | 私聊策略：`pairing`、`allowlist`、`open` 或 `disabled` |

## 说明

- Webhook 需要公网可访问。出于安全考虑，建议只对外暴露 webhook 路径。
- `sdkAppId` 和 `secretKey` 需从[腾讯云 IM 控制台](https://console.cloud.tencent.com/im)获取。
- 支持通过 `accounts` 配置多账号。
