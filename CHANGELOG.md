# Changelog

## 2026.3.10

- feat: 流式消息支持，新增 `streamingMode` 配置（`off` / `text_modify` / `custom_modify` / `tim_stream`）
- feat: 流式失败兜底策略 `fallbackPolicy`（`strict` / `final_text`）
- feat: `typingText` 占位消息，非流式通过 modify 替换，流式作为 CompatibleText
- feat: 消息修改 API（modify_c2c_msg / modify_group_msg）
- fix: API 响应判断改为 `ActionStatus` 检查，兼容流式 API 不返回 `ErrorCode` 的情况
- fix: `tim_stream` 改为腾讯云官方 `TIMStreamElem` 协议（`Chunks` / `StreamMsgID` / `CompatibleText`）
- fix: `identifier` 正确用于 UserSig、API URL 和无 `botAccount` 时的发送者身份
- fix: 流式超限停止时优先覆盖 `typingText` 占位消息，避免遗留“正在思考中...”
- fix: webhook 签名校验改为 `timingSafeEqual`
- fix: 占位符消息跳过日志从 warn 降级为 verbose
- fix: 明确关闭 OpenClaw `blockStreaming` 能力，移除无效的 `blockStreamingCoalesce` 配置
- docs: README 重写为配置项参考格式，接入教程链接更新为腾讯云官方文档

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
