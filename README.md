# Tencent Cloud IM Channel Plugin for Clawdbot

Maintainer: longyuqi@tencent.com

Status: Tencent Cloud IM intelligent bot via webhooks + REST API.

## Install

### Option A: Install from npm
```bash
clawdbot plugins install @clawdbot/timbot
clawdbot plugins enable timbot
clawdbot gateway restart
```

### Option B: Local development (link)
```bash
clawdbot plugins install --link extensions/timbot
clawdbot plugins enable timbot
clawdbot gateway restart
```

## Configure

```json5
{
  channels: {
    timbot: {
      enabled: true,
      webhookPath: "/timbot",
      sdkAppId: "YOUR_SDK_APP_ID",
      secretKey: "YOUR_SECRET_KEY",
      botAccount: "YOUR_BOT_ACCOUNT",
      apiDomain: "https://console.tim.qq.com",
      token: "YOUR_CALLBACK_TOKEN",
      welcomeText: "Hello!",
      dm: { policy: "open" }
    }
  }
}
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `webhookPath` | Webhook endpoint path |
| `sdkAppId` | Tencent Cloud IM SDK App ID |
| `secretKey` | Secret key for generating UserSig (obtained from IM Console) |
| `botAccount` | Bot account ID |
| `apiDomain` | Tencent IM API domain |
| `token` | Callback token for signature verification |
| `welcomeText` | Welcome message for new conversations |
| `dm.policy` | DM policy: `pairing`, `allowlist`, `open`, or `disabled` |

## Notes

- Webhooks require public HTTPS. For security, only expose the webhook path to the internet.
- Obtain `sdkAppId` and `secretKey` from the [Tencent Cloud IM Console](https://console.cloud.tencent.com/im). The `secretKey` is used to dynamically generate UserSig.
- Supports multiple accounts via the `accounts` configuration.

---

# Clawdbot 腾讯云 IM Channel 插件

维护者：longyuqi@tencent.com

状态：支持腾讯云即时通信 IM 智能机器人，通过 Webhook 回调 + REST API 实现。

## 安装

### 方式 A：从 npm 安装
```bash
clawdbot plugins install @clawdbot/timbot
clawdbot plugins enable timbot
clawdbot gateway restart
```

### 方式 B：本地开发（link）
```bash
clawdbot plugins install --link extensions/timbot
clawdbot plugins enable timbot
clawdbot gateway restart
```

## 配置

```json5
{
  channels: {
    timbot: {
      enabled: true,
      webhookPath: "/timbot",
      sdkAppId: "YOUR_SDK_APP_ID",
      secretKey: "YOUR_SECRET_KEY",
      botAccount: "YOUR_BOT_ACCOUNT",
      apiDomain: "https://console.tim.qq.com",
      token: "YOUR_CALLBACK_TOKEN",
      welcomeText: "你好！",
      dm: { policy: "open" }
    }
  }
}
```

### 配置项说明

| 配置项 | 说明 |
|--------|------|
| `webhookPath` | Webhook 回调路径 |
| `sdkAppId` | 腾讯云 IM SDK 应用 ID |
| `secretKey` | 密钥，用于动态生成 UserSig（从 IM 控制台获取） |
| `botAccount` | 机器人账号 ID |
| `apiDomain` | 腾讯 IM API 域名 |
| `token` | 回调签名验证 Token |
| `welcomeText` | 新会话欢迎语 |
| `dm.policy` | 私聊策略：`pairing`、`allowlist`、`open` 或 `disabled` |

## 说明

- Webhook 必须是公网 HTTPS。出于安全考虑，建议只对外暴露 webhook 路径。
- `sdkAppId` 和 `secretKey` 需从[腾讯云 IM 控制台](https://console.cloud.tencent.com/im)获取。`secretKey` 用于动态生成 UserSig。
- 支持通过 `accounts` 配置多账号。
