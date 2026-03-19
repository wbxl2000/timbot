# timbot Handoff Document

**Date:** 2026-03-17
**Version:** 2026.3.12
**Maintainer:** longyuqi@tencent.com
**Repo:** https://github.com/wbxl2000/timbot

---

## 项目概述

timbot 是 [OpenClaw](https://github.com/wbxl2000/openclaw) 的腾讯云 IM 通道插件，通过 Webhook + REST API 接入腾讯云即时通信 IM，让 OpenClaw 的 AI agent 能在腾讯 IM 中响应 C2C 和群组消息。

- **npm 包名：** `timbot`
- **对外文档：** https://cloud.tencent.com/document/product/269/128326
- **peer dependency：** `openclaw >= 2026.1.30`

---

## 架构概览

```
腾讯 IM Webhook (POST /timbot)
        ↓
  src/monitor.ts          ← Webhook 接收、签名校验、消息解析
        ↓
  OpenClaw 核心           ← agent 路由、session 管理、reply 队列
        ↓
  src/monitor.ts          ← 回复发送（sendTimbotMessage / sendTimbotGroupMessage）
        ↓
  腾讯 IM REST API        ← sendmsg / modify_c2c_msg / send_c2c_stream_msg 等
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `src/channel.ts` | 插件主入口，实现 `ChannelPlugin` 接口，注册到 OpenClaw |
| `src/monitor.ts` | Webhook 处理核心：接收消息、签名校验、流式逻辑、发送回复 |
| `src/accounts.ts` | 账号配置解析与合并（单账号/多账号） |
| `src/types.ts` | 所有类型定义（配置、消息体、请求/响应结构） |
| `src/streaming-policy.ts` | 流式消息体构建工具（buildTextMsgBody / buildCustomMsgBody 等） |
| `src/config-schema.ts` | JSON Schema，用于 OpenClaw 配置校验 |
| `src/onboarding.ts` | OpenClaw 引导向导适配器 |
| `src/runtime.ts` | PluginRuntime 单例（当前未被 monitor.ts 主路径使用） |
| `src/logger.ts` | 日志工具（LOG_PREFIX / logSimple） |

---

## 配置结构

```yaml
channels:
  timbot:
    sdkAppId: "1600012345"       # 腾讯 IM SDKAppID（必填）
    secretKey: "xxx"              # 腾讯 IM SecretKey（必填）
    token: "webhook-token"        # Webhook 回调 Token（可选，建议填）
    botAccount: "@RBT#001"        # 机器人账号（默认 @RBT#001）
    identifier: "administrator"   # 签名用管理员账号（默认 administrator）
    apiDomain: "console.tim.qq.com"
    webhookPath: "/timbot"

    streamingMode: "off"          # off | text_modify | custom_modify | tim_stream
    fallbackPolicy: "strict"      # strict | final_text
    overflowPolicy: "stop"        # stop | split
    typingText: "正在思考中..."

    dm:
      policy: "open"              # open | pairing | allowlist | disabled
      allowFrom: ["*"]

    # 多账号（多 IM 应用）时使用
    accounts:
      acct1:
        sdkAppId: "..."
        secretKey: "..."
```

配置完整要求：`sdkAppId` + `secretKey` 同时存在。

---

## 流式模式

详见 `notes/streaming-modes.md`（模式协议说明）和 `notes/streaming-impl.md`（端到端实现详解）。四种模式简述：

| 模式 | 机制 | 适用场景 |
|------|------|---------|
| `off`（默认） | 生成完毕一次性发送 | 兼容性最好 |
| `text_modify` | sendmsg 首条 → modify 逐步更新文本 | 轻量流式，有闪烁感 |
| `custom_modify` | sendmsg 首条 → modify 更新 TIMCustomElem，包含自定义协议 | 客户端支持自定义渲染时最佳 |
| `tim_stream` | 腾讯 IM 原生 TIMStreamElem，增量续流 | 新版客户端原生流式体验 |

**注意：** 流式模式依赖上游 provider 输出 partial text（`onPartialReply`）。若 provider 只有最终文本，流式模式退化为"占位消息 + 最终发送"。可用 `--raw-stream-path` 日志确认上游是否产出 partial。

`fallbackPolicy=final_text` 可让所有流式模式在失败时降级为普通 TIMTextElem 兜底。

### Web Demo 客户端侧

Web Demo（`demos/openclaw-im-demo`，Vite + Vue 3 + TS）实现了 `custom_modify` 模式的客户端渲染：

- `CustomMessage.vue` 解析 `TIMCustomElem` 的 `chatbotPlugin: 2` 协议，区分流式消息 (`src: 2`) 和错误状态 (`src: 23`)
- `StreamMessage.vue` 渲染 `chunks` 拼接文本 + 闪烁光标动画，`isFinished=1` 时光标消失
- 实时更新完全依赖 TIM SDK 长连接推送消息修改事件 + Vue 响应式，客户端无需自建轮询/WebSocket

---

## 长文本超限处理

详见 `notes/long-text-overflow.md`。当前策略：

1. 流式阶段持续更新同一条消息
2. 接近软上限后停止继续更新
3. 最终收尾时将剩余内容按固定长度硬切，以后续消息续发

**已知缺陷：** 会在 Markdown 中间切开，破坏格式。待优化（见 TODO 部分）。

---

## 并发安全

详见 `notes/concurrency-analysis.md`。结论：多用户同时访问安全，流式状态完全隔离。

- Webhook 层：每个请求独立 async 上下文，无全局锁
- OpenClaw 队列层：以 `channel|to|accountId|threadId` 为 key 隔离
- 同一用户连续发消息：同一队列串行处理 + 去抖

已知限流：腾讯 IM 流式续流 5 次/秒；体验版日限 1000 条消息（所有用户共享）。

---

## 本地开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 测试
pnpm test

# 本地安装（link 模式）
bash install-timbot.sh

# 卸载
bash uninstall-timbot.sh

# 调试运行
openclaw gateway run --verbose --force

# 手动触发 Webhook（模拟 C2C 消息）
TS=$(date +%s) && RAND=$RANDOM
curl -sS 'http://127.0.0.1:18789/timbot' \
  -H 'content-type: application/json' \
  --data-binary "{
    \"CallbackCommand\":\"Bot.OnC2CMessage\",
    \"From_Account\":\"qer5\",
    \"To_Account\":\"@RBT#001\",
    \"MsgTime\":$TS,
    \"MsgRandom\":$RAND,
    \"MsgKey\":\"local_${TS}_${RAND}\",
    \"MsgBody\":[{\"MsgType\":\"TIMTextElem\",\"MsgContent\":{\"Text\":\"你好\"}}]
  }"
```

---

## 发布

详见 `PUBLISH.md`。

```bash
# Beta
pnpm build && pnpm publish --tag beta --access public --no-git-checks

# 正式
pnpm build && pnpm publish --access public --no-git-checks
```

版本号格式：`2026.3.12`（正式）/ `2026.3.12-beta.1`（Beta）。

---

## 已知问题 & 待办

### 高优先级

- **超长文本换载体**（`notes/todo-send-file.md`）
  当前硬切方案会破坏 Markdown 格式。计划：超限后转文件（`.md` / `.txt`）发送，或发送摘要 + 文件入口。

- **默认启用流式**（`notes/todo-default-streaming.md`）
  当前默认 `off`，待新版客户端覆盖率确认后，计划改为 `tim_stream` 作为默认，配合 `CompatibleText` 兜底旧客户端。

### 中等优先级

- **多机器人账号支持**（`notes/muti-agent.md`）
  支持同一 IM 应用下多个 `@RBT#xxx` 账号，每个账号绑定一个 agent，实现"不同会话切换不同 AI 助手"的飞书模式体验。
  方案：新增 `bots` 配置字段，Webhook 路由按 `To_Account` 找对应 bot → agentId。

- **WebSocket 长连接**（`notes/todo-websocket-long-connection.md`）
  低延迟状态同步通道，支持工具调用进度、实时 partial text 直推前端。属于大功能基础设施。

- **长文本 Markdown-aware 分段**（`notes/long-text-overflow.md` P2/P3）
  在硬切前先找空行、保护代码块和表格结构。

### 低优先级

- **`administrator` 账号替代 `@RBT#001`**（`notes/todo-administrator-account.md`）
  调研 `administrator` 是否可作为 botAccount，简化 onboarding 配置。需确认 REST API 行为、自身消息过滤、权限差异。

---

## 依赖关系

- **运行时：** 无外部 npm 依赖（纯 Node.js 内置模块 + openclaw peer dep）
- **构建：** TypeScript 5，pnpm
- **测试：** Node.js 内置 `--test`

---

## 联系

- **Maintainer：** longyuqi@tencent.com
- **Issues：** https://github.com/wbxl2000/timbot/issues
- **Web Demo：** https://web.sdk.qcloud.com/trtc/webrtc/v5/test/qer/openclaw-demo/index.html
