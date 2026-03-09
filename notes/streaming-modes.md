# Streaming Mode 详解

通过 `streamingMode` 配置项选择回复模式，可选值：`off`（默认）、`text_modify`、`custom_modify`、`tim_stream`。

## off（默认）

不使用流式。agent 生成完毕后一次性发送完整回复。

- API: `sendmsg`（TIMTextElem）
- typingText: 先 `sendmsg` 发占位消息，回复完成后 `modify_c2c_msg` 替换为实际内容，modify 失败则发新消息
- 客户端要求: 无

## text_modify

发送一条 TIMTextElem，随着 agent 逐块生成，反复 `modify` 更新这条消息的文本内容。

- API: 首条 `sendmsg`（TIMTextElem）→ 每个 chunk 调用 `modify_c2c_msg`/`modify_group_msg`（TIMTextElem，内容为所有 chunk 拼接）
- typingText: 作为首条 TIMTextElem 发出，后续 modify 覆盖
- 降级: modify 失败 → `allowsFinalTextRecovery` 始终为 true → 发送新普通消息兜底
- 客户端要求: 支持消息修改。用户看到文本逐步变长，但 modify 会有闪烁感

## custom_modify

与 text_modify 类似使用 modify API 逐步更新，但消息体是 TIMCustomElem，包含自定义协议（`chatbotPlugin: 2`），客户端解析后可实现更好的流式渲染。

- API: 首条 `sendmsg`（TIMCustomElem）→ 每个 chunk 调用 `modify`（TIMCustomElem）
- CustomElem Data 协议:
  ```json
  { "chatbotPlugin": 2, "src": 2, "chunks": ["块1", "块2"], "isFinished": 0, "typingText": "正在思考中..." }
  ```
  - `src: 2` = 正常流式, `src: 23` = 错误状态
  - `isFinished`: `0` = 生成中, `1` = 已完成
  - `typingText`: 仅在 chunks 为空且 isFinished=0 时存在
  - chunks 数组随 deliver 回调逐步累积
- typingText: 作为首条 CustomElem 的 typingText 字段
- 降级（三级兜底）: ① modify 为 TIMTextElem → ② 发新普通消息 → ③ modify 为错误状态 `{src: 23}`
- 客户端要求: 需解析 `chatbotPlugin: 2` 协议，不支持的客户端只看到 `[custom]`

## tim_stream

使用腾讯 IM 原生流式消息 API（TIMStreamElem），通过 `Chunks` 续流发送增量文本。

- API: `send_c2c_stream_msg` / `send_group_stream_msg`
- StreamElem 消息体:
  ```json
  {
    "MsgType": "TIMStreamElem",
    "MsgContent": {
      "Chunks": [
        {
          "EventType": "data",
          "Index": 1,
          "Markdown": "当前 chunk 增量文本",
          "IsLast": false
        }
      ],
      "CompatibleText": "旧客户端兜底文本",
      "StreamMsgID": "首次请求返回的 ID"
    }
  }
  ```
  - `Chunks`: 本次发送的增量分片数组
  - `EventType`: 当前实现固定为 `data`
  - `Index`: 递增分片序号
  - `Markdown`: 当前 chunk 的增量文本
  - `IsLast`: `true` 表示最后一块
  - `CompatibleText`: 旧客户端兜底显示文本
  - `StreamMsgID`: 首次请求返回，后续续流必须携带
- typingText: 首次空 chunk 通过 `CompatibleText` 发出
- 降级: 首次失败时尝试用完整文本直接结束；`fallbackPolicy=final_text` 时再退化为普通消息
- 客户端要求: 新版客户端看流式效果，旧客户端看 CompatibleText 完整文本（优于 custom_modify 的兼容性）
- API 限制: 分片间隔 ≤15s，体验版日限 1000 条，单条 <128KB，续流 ≤5次/秒

## blockStreaming

timbot 当前不使用 OpenClaw 的 blockStreaming。

- 非流式模式通过「发送 typingText 占位消息 -> 最终 modify」实现
- 流式模式通过 `onPartialReply` 获取 partial text，再走 timbot 自己的更新逻辑
- 因此 `blockStreamingCoalesce` 之类的 block streaming 配置对 timbot 不生效

## fallbackPolicy

控制流式失败时的兜底行为：

- `strict`（默认）: 仅 text_modify 会尝试发普通消息兜底
- `final_text`: 所有流式模式失败后都尝试发普通 TIMTextElem 兜底

判断逻辑: `allowsFinalTextRecovery = streamingMode === "text_modify" || fallbackPolicy === "final_text"`

## 注意事项

1. 流式消息 MsgType 为 `TIMStreamElem`
2. `streaming` 默认关闭，因为不支持流式的客户端（旧版本/多端登录）只会看到 CompatibleText 提示，无法看到实际回复内容
3. 流式消息中途失败时会先尝试终结已有流式消息再降级为普通消息
4. `typingText` 在非流式模式下通过「发送占位消息 → 回复完成后 modify 修改」实现；在流式模式下作为首个空 chunk 的 `CompatibleText`
