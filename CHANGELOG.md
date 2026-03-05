# Changelog

## 2026.3.5

- feat: 群聊支持 (Bot.OnGroupMessage) (0986ef7)
- fix: 默认 DM 策略配置中补充 allowFrom 通配符 (48dfab4)
- fix: 群消息使用 botAccount 作为发送者 (4214531)
- fix: startAccount 的 promise 保持 pending 直到 abortSignal 触发 (7f79103)

## 2026.3.4

- fix: 适配 OpenClaw 2026.3.x HTTP route API (523a5bf)

## 2026.2.11

- docs: 更新 onboarding 引导和 README (370ac61)

## 2026.2.10

- feat: 添加 onboarding 引导向导，准备 npm 发布 (a7a1742)
- refactor: 增加 verbose 日志 (7747ee7)

## 2026.1.30

- feat: 初始实现 Tencent IM bot 支持 (a5ce59e)
- feat: 添加 webhook token 校验 (b7558b0)
- feat: 添加 userSig 生成器 (1ab1998)
- feat: 项目更名为 OpenClaw (3543eb2)
- fix: 忽略 [custom] 类型消息 (16ceda2)
