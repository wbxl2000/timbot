# WeCom (WeChat Work) Channel Plugin for Clawdbot

Maintainer: YanHaidao (VX: YanHaidao)

Status: WeCom intelligent bot (API mode) via encrypted webhooks + passive replies (stream).

## Install

### Option A: Install from npm
```bash
clawdbot plugins install @clawdbot/wecom
clawdbot plugins enable wecom
clawdbot gateway restart
```

### Option B: Local development (link)
```bash
clawdbot plugins install --link extensions/wecom
clawdbot plugins enable wecom
clawdbot gateway restart
```

## Configure

```json5
{
  channels: {
    wecom: {
      enabled: true,
      webhookPath: "/wecom",
      token: "YOUR_TOKEN",
      encodingAESKey: "YOUR_ENCODING_AES_KEY",
      receiveId: "",
      dm: { policy: "pairing" }
    }
  }
}
```

## Notes

- Webhooks require public HTTPS. For security, only expose the `/wecom` path to the internet.
- Stream behavior: the first reply may be a minimal placeholder; WeCom will call back with `msgtype=stream` to refresh and fetch the full content.
- Limitations: passive replies only; standalone send is not supported.

---

# Clawdbot 企业微信（WeCom）Channel 插件

维护者：YanHaidao（VX：YanHaidao）

状态：支持企业微信智能机器人（API 模式）加密回调 + 被动回复（stream）。

## 安装

### 方式 A：从 npm 安装
```bash
clawdbot plugins install @clawdbot/wecom
clawdbot plugins enable wecom
clawdbot gateway restart
```

### 方式 B：本地开发（link）
```bash
clawdbot plugins install --link extensions/wecom
clawdbot plugins enable wecom
clawdbot gateway restart
```

## 配置

```json5
{
  channels: {
    wecom: {
      enabled: true,
      webhookPath: "/wecom",
      token: "YOUR_TOKEN",
      encodingAESKey: "YOUR_ENCODING_AES_KEY",
      receiveId: "",
      dm: { policy: "pairing" }
    }
  }
}
```

## 说明

- webhook 必须是公网 HTTPS。出于安全考虑，建议只对外暴露 `/wecom` 路径。
- stream 模式：第一次回包可能是占位符；随后 WeCom 会以 `msgtype=stream` 回调刷新拉取完整内容。
- 限制：仅支持被动回复，不支持脱离回调的主动发送。
