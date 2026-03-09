# 多用户并发访问分析

## 结论

多用户同时访问是安全的，不会出问题。不同用户的请求完全并行处理，流式状态天然隔离。

## 各层并发分析

### 1. Webhook 接收层（timbot）

- 腾讯 IM Webhook 每收到一条消息发一个 HTTP POST
- HTTP 服务器天然并发，每个请求在独立 async 上下文中执行
- `processAndReply` / `processGroupAndReply` 是 async 函数，不互相阻塞
- 没有全局锁或互斥量

### 2. 流式消息状态隔离（`src/monitor.ts:875-879`）

```typescript
let streamMsgKey: string | undefined;
let timStreamMsgId: string | undefined;
let streamFailed = !useStreaming;
const streamChunks: string[] = [];
```

都是 `processAndReply` 函数内的局部变量，每次调用独立创建，不存在竞争。

### 3. OpenClaw 队列层（per-session 隔离）

队列以 `channel|to|accountId|threadId` 为 key（`openclaw-src/auto-reply/reply/queue/drain.ts:50-64`）。

| 场景 | key 示例 | 行为 |
|------|---------|------|
| 用户 A 发消息 | `timbot\|userA\|\|` | 独立队列 |
| 用户 B 同时发消息 | `timbot\|userB\|\|` | 独立队列，与 A 并发 |
| 用户 A 连续发 2 条 | `timbot\|userA\|\|` | 同一队列，串行处理 |

- 不同用户 → 不同队列 → 完全并发
- 同一用户连续发消息 → 同一队列 → 串行处理 + 去重

### 4. Session 写锁（`openclaw-src/agents/session-write-lock.ts`）

- 按 session 文件粒度加文件锁（`sessionFile.jsonl.lock`）
- 防止多进程并发写同一 session 文件
- 单进程内支持重入（count 计数）
- 不同用户的 session 文件不同，锁互不影响
- 超时 10s / 过期 30min / 最大持有 5min / watchdog 60s 轮询

### 5. Inbound Debounce（`openclaw-src/auto-reply/inbound-debounce.ts`）

- 按 user/thread 维度滚动去抖
- 同一用户短时间连发多条 → 合并成一批处理
- 不同用户的去抖互不干扰
- 可按 channel 配置去抖时间

### 6. blockStreaming（`openclaw-src/auto-reply/reply/block-streaming.ts`）

- 每个 reply 请求创建独立 dispatcher
- 配置是声明式的，无共享可变状态
- 多个 reply 可并发流式发送

## 潜在瓶颈（非 bug）

| 瓶颈 | 原因 | 影响 |
|------|------|------|
| LLM API 并发 | 多用户同时触发 agent 回复 | 取决于 LLM 提供商 rate limit |
| 腾讯 IM API rate limit | 流式消息 API 限制续流 5 次/秒 | 单用户流式更新频率受限，不同用户独立 |
| 腾讯 IM 体验版限制 | 流式消息日限 1000 条 | 所有用户共享配额 |
| Node.js 单线程 | CPU 密集任务阻塞事件循环 | 实际影响小，主要是 I/O 等待 |
