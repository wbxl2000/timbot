# 流式消息实现总览

## 架构全景

```
用户发消息 → TIM Server → timbot (OpenClaw webhook)
                                    ↓
                              模型生成回复（可能是流式 partial text）
                                    ↓
                          根据 streamingMode 选择投递策略
                                    ↓
                    ┌───────────┬────────────┬──────────────┐
                    │ text_modify│custom_modify│  tim_stream  │
                    │ TIMTextElem│TIMCustomElem│TIMStreamElem │
                    │ + modify  │ + modify    │ + 续流 API   │
                    └───────────┴────────────┴──────────────┘
                                    ↓
                          TIM Server 推送到客户端
                                    ↓
                    Web Demo / 小程序 / 其他客户端 渲染
```

---

## 一、Web Demo（`demos/openclaw-im-demo`）— 客户端侧

Web Demo 是 **Vite + Vue 3 + TS** 项目，基于 `@tencentcloud/chat-uikit-vue3` 的 TUIKit 组件库，**只实现了 `custom_modify` 模式的客户端渲染**。

### 1. 核心文件

| 文件 | 职责 |
|------|------|
| `src/scenes/Chat/Chat.vue` | 聊天页，把 `CustomMessage` 注入 MessageList |
| `src/components/StreamMessage/CustomMessage.vue` | 消息路由器：解析 payload，判断是否 bot 流式消息 |
| `src/components/StreamMessage/StreamMessage.vue` | 流式文本渲染组件（逐块拼接 + 光标动画）|
| `src/pages/Login/Login.vue` | TIM SDK 登录初始化 |

### 2. 消息识别流程

```
TIM SDK 收到消息（TIMCustomElem）
       ↓
CustomMessage.vue 解析 message.payload.data（JSON）
       ↓
检查 chatbotPlugin === 2 ?
   ├── 否 → 走默认 Message 组件渲染
   └── 是 → 进入 bot 流式消息分支
              ├── src === 2  → <StreamMessage> 流式渲染
              └── src === 23 → 错误状态展示
```

关键代码（`CustomMessage.vue`）：

```typescript
const botPayload = computed<BotPayload | null>(() => {
  const data = JSON.parse(props.message?.payload?.data || '{}');
  if (data?.chatbotPlugin === 2) return data;
  return null;
});

const isStreamMessage = computed(() => botPayload.value?.src === 2);
const isBotError = computed(() => botPayload.value?.src === 23);
```

### 3. 流式渲染逻辑

`StreamMessage.vue` 接收三个 props：`chunks`、`isFinished`、`typingText`

```typescript
const chunkText = computed(() => (props.chunks || []).join(''));
const isTypingPlaceholder = computed(
  () => !chunkText.value && Boolean(props.typingText) && props.isFinished !== 1,
);
const displayText = computed(() => chunkText.value || props.typingText || '');
```

渲染规则：

- **`chunks` 为空 + `isFinished=0`** → 显示 `typingText`（如 "正在思考中..."），低透明度
- **`chunks` 不为空 + `isFinished=0`** → 显示拼接文本 + **闪烁光标**（CSS 动画 `stream-cursor-blink`）
- **`isFinished=1`** → 显示完整文本，光标消失

### 4. 实时更新机制

Web Demo **不需要自己做轮询/WebSocket**，依赖的是 TIM SDK 内部的长连接：

1. timbot 服务端调用 `modify_c2c_msg` 修改消息内容
2. TIM SDK 自动通过长连接收到消息更新事件
3. TUIKit 的 MessageList 组件响应式更新 → 重新渲染 CustomMessage → `botPayload` computed 重算 → `chunks` 变化 → 文本增长

**核心点：Web Demo 本身没有任何流式传输代码，全靠 TIM 的消息修改推送 + Vue 响应式。**

### 5. 消息布局

对 bot 消息使用了自定义布局（不走默认气泡）：

```vue
<div class="bot-message-layout">
  <div class="bot-message-layout__wrapper">
    <div class="bot-message-layout__nick">{{ nick }}</div>
    <div class="bot-message-bubble">
      <StreamMessage :chunks="..." :is-finished="..." :typing-text="..." />
    </div>
  </div>
</div>
```

---

## 二、Timbot 服务端 — 生产与投递侧

（结合 `notes/streaming-modes.md` 的模式说明，补充实现细节）

### 1. 核心文件

| 文件 | 职责 |
|------|------|
| `src/types.ts` | 类型定义：`TimbotStreamingMode`、`TimbotStreamingFallbackPolicy` |
| `src/config-schema.ts` | 配置校验 schema |
| `src/accounts.ts` | 配置解析（normalize streamingMode / fallbackPolicy）|
| `src/streaming-policy.ts` | 消息体构建器（三种模式的 MsgBody）|
| `src/monitor.ts` | 核心逻辑：接收 webhook → 调 OpenClaw → 流式投递 |

### 2. 流式投递流程

```
OpenClaw 的 onPartialReply 回调
       ↓
partialTextAccumulator.absorbPartial(text)  // 智能文本合并
       ↓
streamLoop.update(visibleText)              // 喂入节流循环
       ↓
createLatestTextThrottleLoop (1s 节流)      // 每秒最多发一次
       ↓
sendLatestText(visibleText)                 // 按模式选择投递方式
       ↓
  ┌─────────────────────────────────────┐
  │ text_modify:                        │
  │   buildTextMsgBody(text)            │
  │   → modifyMsg(TIMTextElem)          │
  ├─────────────────────────────────────┤
  │ custom_modify:                      │
  │   buildCustomMsgBody(chunks, 0)     │
  │   → modifyMsg(TIMCustomElem)        │
  ├─────────────────────────────────────┤
  │ tim_stream:                         │
  │   buildTimStreamChunk(delta, idx)   │
  │   → sendStreamMsg(TIMStreamElem)    │
  └─────────────────────────────────────┘
```

### 3. 关键常量

```typescript
TIMBOT_PARTIAL_STREAM_THROTTLE_MS = 1000   // 节流间隔 1s
TIMBOT_STREAM_SOFT_LIMIT_BYTES = 11 * 1024 // 单条消息 11KB 软限制
TIMBOT_FINAL_TEXT_CHUNK_LIMIT = 3500       // 最终文本分片长度（用于 overflow split）
```

### 4. 三种模式的消息体对比

**text_modify** — 累积全文替换：

```json
{ "MsgType": "TIMTextElem", "MsgContent": { "Text": "全部已生成的文本" } }
```

**custom_modify** — 分块协议（Web Demo 对接的就是这个）：

```json
{
  "MsgType": "TIMCustomElem",
  "MsgContent": {
    "Data": "{\"chatbotPlugin\":2,\"src\":2,\"chunks\":[\"块1\",\"块2\"],\"isFinished\":0}"
  }
}
```

**tim_stream** — TIM 原生增量流：

```json
{
  "MsgType": "TIMStreamElem",
  "MsgContent": {
    "Chunks": [{ "EventType":"data", "Index":3, "Markdown":"增量文本", "IsLast":false }],
    "CompatibleText": "旧客户端兜底文本",
    "StreamMsgID": "xxx"
  }
}
```

### 5. 降级与兜底

```
custom_modify 降级链（三级）:
  ① modify 为 TIMTextElem  →  ② 发新普通消息  →  ③ modify 为 { src: 23 } 错误状态

text_modify 降级:
  modify 失败 → allowsFinalTextRecovery = true → 发新普通消息

tim_stream 降级:
  首次失败 → 用完整文本直接结束流
  再失败 + fallbackPolicy="final_text" → 退化为普通消息

兜底策略由 fallbackPolicy 控制:
  "strict"（默认）: 只有 text_modify 会发普通消息兜底
  "final_text": 所有模式失败后都尝试普通 TIMTextElem 兜底
```

### 6. 首条消息（typingText 占位）

- **非流式 (off)**：先 sendmsg 发占位消息（typingText），回复完成后 modify 替换
- **text_modify**：typingText 作为首条 TIMTextElem 发出，后续 modify 覆盖
- **custom_modify**：typingText 放在首条 CustomElem 的 `typingText` 字段里
- **tim_stream**：typingText 放在首次空 chunk 的 `CompatibleText` 里

---

## 三、两端协作关系

```
timbot（服务端）                          Web Demo（客户端）
━━━━━━━━━━━━━━━━━━━━━                    ━━━━━━━━━━━━━━━━━━━━
1. 收到用户消息 webhook
2. 调 OpenClaw 生成回复
3. onPartialReply 收到 partial text
4. 节流 1s，构建 CustomElem payload
5. sendmsg(TIMCustomElem)  ──────────→  6. TIM SDK 收到新消息
   {chatbotPlugin:2, chunks:[],                ↓
    isFinished:0,                        7. CustomMessage.vue 解析
    typingText:"正在思考中..."}               ↓
                                         8. StreamMessage 显示 "正在思考中..." + 光标
9. modify_c2c_msg  ─────────────────→  10. TIM SDK 收到消息更新
   {chunks:["你好！这是"],                     ↓
    isFinished:0}                        11. chunks 变化 → 显示 "你好！这是" + 光标

12. modify_c2c_msg  ────────────────→  13. 再次更新
   {chunks:["你好！这是","一段回复"],          ↓
    isFinished:1}                        14. chunks 拼接 → 显示完整文本，光标消失
```

一句话总结：timbot 负责把模型的 partial text 通过 TIM 的消息修改 API 逐步推送；Web Demo 只需要解析 `chatbotPlugin:2` 协议的 JSON，用 Vue 响应式渲染 chunks 拼接的文本，加个闪烁光标就完成了流式效果。
