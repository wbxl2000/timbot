# Tencent Cloud IM Channel Plugin for OpenClaw

OpenClaw 腾讯云 IM 通道插件 — 支持腾讯云即时通信 IM 智能机器人（Webhook + REST API）。

**Maintainer:** longyuqi@tencent.com

---

- **English:** [README.en.md](https://github.com/wbxl2000/timbot/blob/main/README.en.md)
- **中文：** [README.zh-CN.md](https://github.com/wbxl2000/timbot/blob/main/README.zh-CN.md)

Local testing, streaming mode selection, and webhook replay examples are documented in both language-specific READMEs above.

---

**[Web Demo](https://web.sdk.qcloud.com/trtc/webrtc/v5/test/qer/openclaw-demo/index.html)** — 腾讯云 IM TIMBot 插件支持全平台，本页面仅供 Web 测试，请勿用于正式环境。

**[Full integration guide / 完整对外接入教程](https://cloud.tencent.com/document/product/269/128326)** — OpenClaw：微信小程序快速接入指南

---

## Changelog

### 2026.3.10

- feat: 流式消息支持，新增 `streamingMode` 配置（`off` / `text_modify` / `custom_modify` / `tim_stream`）
- feat: 流式失败兜底策略与 `typingText` 占位消息
- fix: 多项稳定性修复（API 响应判断、签名校验、流式协议适配等）

### 2026.3.5

- feat: 群聊支持 (Bot.OnGroupMessage)
- fix: 默认 DM 策略配置中补充 allowFrom 通配符
- fix: 群消息使用 botAccount 作为发送者
- fix: startAccount 的 promise 保持 pending 直到 abortSignal 触发

### 2026.3.4

- fix: 适配 OpenClaw 2026.3.x HTTP route API

### 2026.2.11

- docs: 更新 onboarding 引导和 README

### 2026.2.10

- feat: 添加 onboarding 引导向导，准备 npm 发布
- refactor: 增加 verbose 日志

### 2026.1.30

- feat: 初始实现 Tencent IM bot 支持
- feat: 添加 webhook token 校验
- feat: 添加 userSig 生成器
- feat: 项目更名为 OpenClaw
- fix: 忽略 [custom] 类型消息
