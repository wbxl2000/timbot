# Tencent Cloud IM Channel Plugin for OpenClaw

Maintainer: longyuqi@tencent.com

Status: Tencent Cloud IM intelligent bot via webhooks + REST API.

## Install

### Option A: Install from npm
```bash
openclaw plugins install timbot
```

### Option B: Local development (link)
```bash
git clone <repo-url> && cd timbot
pnpm install && pnpm build
bash install-timbot.sh
```

## Quick Start

### Step 1: Create IM App and Get Credentials

1. Go to [Tencent Cloud IM Console](https://console.cloud.tencent.com/im)
2. Click **Create Application**, enter a name, select **China** data center
3. In the app detail page, record:
   - **SDKAppID** — unique app identifier
   - **SecretKey** — key for generating UserSig

### Step 2: Create Bot Account and Configure Callbacks

1. In the IM console sidebar, click **REST API Debug**
2. Select your app → **Bot → Create Bot**, set UserID / Nick / FaceUrl, then submit
3. In the sidebar, click **Callback Configuration → Chat**:
   - **URL**: `http://<your-server-ip>:18789/timbot`
   - Check **Enable Authentication**
   - **Token**: a custom string (e.g. `mysecrettoken`)
   - Check **Bot Event Callback** under Bot Events

### Step 3: Configure and Activate

#### Interactive Setup (Recommended)

```bash
openclaw onboard
```

Select **Tencent IM (plugin)** in the channel list, then follow the prompts to enter SDKAppID, SecretKey, and Token.

#### Manual Configuration

Edit `~/.openclaw/openclaw.json`:

```json5
{
  channels: {
    timbot: {
      enabled: true,
      webhookPath: "/timbot",
      sdkAppId: "YOUR_SDK_APP_ID",
      secretKey: "YOUR_SECRET_KEY",
      botAccount: "@RBT#001",
      token: "YOUR_CALLBACK_TOKEN",
      dm: { policy: "open" }
    }
  }
}
```

Then activate:

```bash
openclaw onboard          # select Tencent IM in the channel list
openclaw gateway restart
```

### Step 4: Open Network Access

```bash
openclaw config set gateway.bind lan
openclaw gateway restart
```

Ensure port **18789** is open in your server firewall.

### Step 5: Verify

Send a message to the bot through your IM client. If the bot responds, the integration is working.

## Configuration Options

| Option | Description |
|--------|-------------|
| `webhookPath` | Webhook endpoint path (default: `/timbot`) |
| `sdkAppId` | Tencent Cloud IM SDK App ID |
| `secretKey` | Secret key for generating UserSig |
| `botAccount` | Bot account ID |
| `apiDomain` | Tencent IM API domain (default: `console.tim.qq.com`) |
| `token` | Callback token for signature verification |
| `welcomeText` | Welcome message for new conversations |
| `dm.policy` | DM policy: `pairing`, `allowlist`, `open`, or `disabled` |

## Notes

- Webhooks require public HTTPS or HTTP with firewall rules. Only expose the webhook path.
- `sdkAppId` and `secretKey` are obtained from the [Tencent Cloud IM Console](https://console.cloud.tencent.com/im).
- Supports multiple accounts via the `accounts` configuration.

## WeChat Mini Program Integration

For integrating with WeChat Mini Programs via Tencent Cloud IM, see the [WeChat Mini Program Quick Start Guide](https://mp.weixin.qq.com/s/6iq-w023LGuYr6N9SR_kvw).

---

# OpenClaw 腾讯云 IM 通道插件

维护者：longyuqi@tencent.com

状态：支持腾讯云即时通信 IM 智能机器人，通过 Webhook 回调 + REST API 实现。

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

#### 手动配置

编辑 `~/.openclaw/openclaw.json`：

```json5
{
  channels: {
    timbot: {
      enabled: true,
      webhookPath: "/timbot",
      sdkAppId: "16000xxxxx",       // 第一步获取的 SDKAppID
      secretKey: "xxxxxx",          // 第一步获取的 SecretKey
      botAccount: "@RBT#001",
      token: "mysecrettoken",       // 第二步设置的鉴权 Token
      dm: { policy: "open" }
    }
  }
}
```

然后激活：

```bash
openclaw onboard          # 在通道列表中选择 Tencent IM
openclaw gateway restart
```

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

## 微信小程序接入

如需通过腾讯云 IM 接入微信小程序，请参考[微信小程序快速接入指南](https://mp.weixin.qq.com/s/6iq-w023LGuYr6N9SR_kvw)。
