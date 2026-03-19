# OpenClaw 腾讯云 IM 通道插件

维护者：longyuqi@tencent.com

支持腾讯云即时通信 IM 智能机器人，通过 Webhook 回调 + REST API 实现。

完整接入教程请参考：**[腾讯云官方文档](https://cloud.tencent.com/document/product/269/128326)**

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

## 配置项说明

配置位于 OpenClaw config 的 `channels.timbot` 下。

### 基础配置

| 配置项 | 必需 | 说明 | 默认值 |
|--------|------|------|--------|
| `sdkAppId` | 是 | 腾讯云 IM SDK 应用 ID | — |
| `secretKey` | 是 | 密钥，用于动态生成 UserSig | — |
| `identifier` | 否 | API 调用身份标识 | `administrator` |
| `botAccount` | 否 | 机器人账号 ID | `@RBT#001` |
| `apiDomain` | 否 | 腾讯 IM API 域名 | `console.tim.qq.com` |
| `token` | 否 | 回调签名验证 Token | — |
| `webhookPath` | 否 | Webhook 回调路径 | `/timbot` |
| `enabled` | 否 | 是否启用该通道 | `true` |

### 消息与流式配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `welcomeText` | 新会话欢迎语 | — |
| `typingText` | 机器人生成中占位文案（非流式模式下通过发送占位消息 + modify 实现；流式模式下作为 CompatibleText） | `正在思考中...` |
| `streamingMode` | 流式模式：`off` / `text_modify` / `custom_modify` / `tim_stream` | `off` |
| `fallbackPolicy` | 流式失败兜底策略：`strict`（不降级）/ `final_text`（降级为最终文本） | `strict` |
| `overflowPolicy` | 流式超限后的处理策略：`stop`（停止并提示，默认）/ `split`（按长度强行分段续发） | `stop` |

### 私聊策略（dm）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `dm.policy` | 私聊策略：`open` / `allowlist` / `pairing` / `disabled` | `open` |
| `dm.allowFrom` | 允许发消息的用户列表（`open` 策略默认 `["*"]`） | — |

### 多账号配置

| 配置项 | 说明 |
|--------|------|
| `defaultAccount` | 默认账号 ID |
| `accounts` | 多账号配置对象，key 为账号 ID，value 为上述所有账号级配置项 |

多账号模式下，顶层配置作为所有账号的基础配置，各账号的同名字段会覆盖顶层配置。

## FAQ

### streamingMode 应该怎么选？

- **不确定 / 刚开始接入** → `off`（默认），最稳定，所有客户端都能正常展示。
- **希望有"正在输入"体验，且使用官方客户端** → `text_modify`，兼容性最好，各端（Web、Android、iOS、小程序、桌面）都能看到消息被持续更新。
- **自研前端，需要自定义渲染逻辑** → `custom_modify`，拥有更细致的控制能力，通过 `TIMCustomElem` 传递结构化数据，前端自行解析渲染。
- **想用腾讯云原生流式能力（`TIMStreamElem`）** → `tim_stream`，需确认客户端已支持该消息类型，否则只能看到 CompatibleText。

注意：以上三种“流式模式”只决定 TIM 侧的消息承载方式，不保证上游模型一定会逐块输出。前提是所选 provider/model 能在 OpenClaw 中产生 partial 文本（`onPartialReply`）。如果上游只在结束时返回 final，TIM 侧会表现为「占位消息 -> 最终替换」，不会看到逐字增长。

### 如何快速修改流式消息配置？

```bash

# 开启 text_modify 流式模式
openclaw config set channels.timbot.streamingMode text_modify

# 开启 custom_modify 流式模式
openclaw config set channels.timbot.streamingMode custom_modify

# 开启 tim_stream 流式模式
openclaw config set channels.timbot.streamingMode tim_stream

# 关闭流式
openclaw config set channels.timbot.streamingMode off

# 设置失败兜底策略为降级发送最终文本
openclaw config set channels.timbot.fallbackPolicy final_text

# 长文本超限后直接停止并提示（默认）
openclaw config set channels.timbot.overflowPolicy stop

# 长文本超限后按长度继续分段发送
openclaw config set channels.timbot.overflowPolicy split

# 自定义占位文案
openclaw config set channels.timbot.typingText "思考中，请稍候..."
```

## 多 Agent 配置教程

timbot 支持在同一个腾讯 IM 应用下配置多个机器人账号，每个机器人绑定不同的 OpenClaw Agent，实现"不同会话 = 不同 AI 助手"的体验。

### 前置条件

- timbot >= 2026.3.12
- 单账号基础配置已完成（`sdkAppId` + `secretKey`）
- **在腾讯云 IM 控制台创建好多个机器人账号（`@RBT#001`、`@RBT#002` 等）**

> 每个 sdkAppId 最多支持 20 个 `@RBT#` 机器人账号。

### 原理概览

```
用户发消息给 @RBT#002
      ↓
腾讯 IM Webhook（To_Account = "@RBT#002"）
      ↓
timbot 按 To_Account 匹配到 accountId = "translator"
      ↓
OpenClaw bindings 将 accountId 路由到 agentId = "translator"
      ↓
translator agent 的 workspace 处理消息并回复
```

### 第一步：创建 Agent workspace

为每个 Agent 创建独立的 workspace：

```bash
openclaw agents add translator
openclaw agents add coder
```

每个 Agent 拥有独立的 `SOUL.md`（人设）、`AGENTS.md`（行为指令）、session 存储和 auth 配置。

### 第二步：配置 timbot 多账号

#### 方式 A：CLI 命令（推荐）

```bash
# 设置默认账号
openclaw config set channels.timbot.defaultAccount default

# 为每个账号设置 botAccount
openclaw config set channels.timbot.accounts.default.botAccount "@RBT#001"
openclaw config set channels.timbot.accounts.translator.botAccount "@RBT#002"
openclaw config set channels.timbot.accounts.coder.botAccount "@RBT#003"

# 可按账号覆盖顶层配置（可选）
openclaw config set channels.timbot.accounts.coder.streamingMode tim_stream
```

也可以用 `--batch-json` 一次性批量设置：

```bash
openclaw config set --batch-json '[
  { "path": "channels.timbot.defaultAccount", "value": "default" },
  { "path": "channels.timbot.accounts.default.botAccount", "value": "@RBT#001" },
  { "path": "channels.timbot.accounts.translator.botAccount", "value": "@RBT#002" },
  { "path": "channels.timbot.accounts.coder.botAccount", "value": "@RBT#003" }
]'
```

#### 方式 B：手动编辑配置文件

编辑 `~/.openclaw/openclaw.json`：

```json5
{
  channels: {
    timbot: {
      // 共享凭证
      sdkAppId: "1600012345",
      secretKey: "your-secret-key",
      token: "webhook-token",
      webhookPath: "/timbot",

      // 顶层作为所有账号的默认值
      streamingMode: "off",
      dm: { policy: "open", allowFrom: ["*"] },

      // 默认账号
      defaultAccount: "default",

      // 多账号配置
      accounts: {
        default: {
          botAccount: "@RBT#001",   // AI 助手
        },
        translator: {
          botAccount: "@RBT#002",   // 翻译官
        },
        coder: {
          botAccount: "@RBT#003",   // 代码助手
          streamingMode: "tim_stream",  // 可按账号覆盖
        },
      },
    },
  },
}
```

账号级字段会覆盖顶层同名字段，未指定的继承顶层默认值。`sdkAppId`、`secretKey` 等共享凭证只需在顶层写一次。

### 第三步：添加 bindings

bindings 将 timbot 的 `accountId` 映射到 OpenClaw 的 `agentId`。

#### 方式 A：CLI 命令（推荐）

```bash
# 将 timbot 的各账号绑定到对应 agent
openclaw agents bind --agent main --bind timbot:default
openclaw agents bind --agent translator --bind timbot:translator
openclaw agents bind --agent coder --bind timbot:coder

# 验证绑定关系
openclaw agents bindings
```

#### 方式 B：手动编辑配置文件

在 `~/.openclaw/openclaw.json` 中添加：

```json5
{
  agents: {
    list: [
      { id: "main", default: true, workspace: "~/.openclaw/workspace" },
      { id: "translator", workspace: "~/.openclaw/workspace-translator" },
      { id: "coder", workspace: "~/.openclaw/workspace-coder" },
    ],
  },

  bindings: [
    { agentId: "main",       match: { channel: "timbot", accountId: "default" } },
    { agentId: "translator", match: { channel: "timbot", accountId: "translator" } },
    { agentId: "coder",      match: { channel: "timbot", accountId: "coder" } },
  ],

  channels: {
    timbot: {
      // ... 上一步的配置
    },
  },
}
```

### 第四步：设置 Agent 人设

每个 Agent 的 workspace 下编辑 `SOUL.md` 定义人格：

```bash
# ~/.openclaw/workspace-translator/SOUL.md
echo "你是一位专业翻译官，擅长中英互译。请用简洁准确的风格翻译用户提供的内容。" \
  > ~/.openclaw/workspace-translator/SOUL.md

# ~/.openclaw/workspace-coder/SOUL.md
echo "你是一位资深程序员，擅长代码审查、调试和编写。回复时附带代码示例。" \
  > ~/.openclaw/workspace-coder/SOUL.md
```

### 第五步：重启并验证

```bash
# 重启 Gateway
openclaw gateway restart

# 检查 agents 和 bindings
openclaw agents list --bindings

# 检查通道状态
openclaw channels status --probe
```

### 按用户路由（可选）

如果只有一个机器人账号，但想把不同用户的消息路由到不同 Agent，可以用 peer 匹配：

```json5
{
  bindings: [
    // 指定用户 → translator agent
    {
      agentId: "translator",
      match: { channel: "timbot", peer: { kind: "direct", id: "user_alice" } },
    },
    // 指定群 → coder agent
    {
      agentId: "coder",
      match: { channel: "timbot", peer: { kind: "group", id: "@TGS#group001" } },
    },
    // 其余走默认
    { agentId: "main", match: { channel: "timbot" } },
  ],
}
```

peer 匹配优先级高于 accountId 匹配。更多路由规则见 [OpenClaw Multi-Agent 文档](https://docs.openclaw.ai/concepts/multi-agent)。

### 完整配置示例

```json5
{
  agents: {
    list: [
      {
        id: "main",
        default: true,
        name: "AI 助手",
        workspace: "~/.openclaw/workspace",
      },
      {
        id: "translator",
        name: "翻译官",
        workspace: "~/.openclaw/workspace-translator",
      },
      {
        id: "coder",
        name: "代码助手",
        workspace: "~/.openclaw/workspace-coder",
        model: "anthropic/claude-sonnet-4-5",
      },
    ],
  },

  bindings: [
    { agentId: "main",       match: { channel: "timbot", accountId: "default" } },
    { agentId: "translator", match: { channel: "timbot", accountId: "translator" } },
    { agentId: "coder",      match: { channel: "timbot", accountId: "coder" } },
  ],

  channels: {
    timbot: {
      sdkAppId: "1600012345",
      secretKey: "your-secret-key",
      token: "webhook-token",
      webhookPath: "/timbot",
      streamingMode: "tim_stream",
      fallbackPolicy: "final_text",
      dm: { policy: "open", allowFrom: ["*"] },
      defaultAccount: "default",
      accounts: {
        default: {
          botAccount: "@RBT#001",
        },
        translator: {
          botAccount: "@RBT#002",
        },
        coder: {
          botAccount: "@RBT#003",
        },
      },
    },
  },
}
```

### 调试

```bash
# 前台运行，观察路由日志
openclaw gateway run --verbose --force

# 模拟向 @RBT#002 发消息
TS=$(date +%s) && RAND=$RANDOM
curl -sS 'http://127.0.0.1:18789/timbot' \
  -H 'content-type: application/json' \
  --data-binary "{
    \"CallbackCommand\":\"Bot.OnC2CMessage\",
    \"From_Account\":\"test_user\",
    \"To_Account\":\"@RBT#002\",
    \"MsgTime\":$TS,
    \"MsgRandom\":$RAND,
    \"MsgKey\":\"test_${TS}_${RAND}\",
    \"MsgBody\":[{\"MsgType\":\"TIMTextElem\",\"MsgContent\":{\"Text\":\"翻译：hello world\"}}]
  }"
```

日志中应出现 `agentId=translator`，说明路由生效。

### 注意事项

- 每个 sdkAppId 最多 20 个 `@RBT#` 机器人账号
- `@RBT#` 机器人发送 C2C 消息不校验好友关系，但用户端会话列表需要机器人先主动发一条消息或通过 `friend_add` API 强制添加
- 体验版每日限 1000 条消息（所有机器人共享），生产环境需升级
- 当前 onboarding 向导不支持多账号交互配置，需手动编辑配置文件
- Agent 的 auth profile 是隔离的，如需共享 provider 凭证，将 `auth-profiles.json` 复制到对应 Agent 的 `agentDir`

## 常用命令速查

### Gateway 前台运行 + 日志

```bash
# 前台运行 Gateway，并强制占用端口（开发调试推荐）
openclaw gateway run --verbose --force

# 如需本地开发模式（自动创建本地 workspace / 配置）
openclaw gateway run --verbose --force --dev

# 通过 OpenClaw 提供的 gateway:watch（在上游 OpenClaw 仓库中）
# 观察 WebSocket 全量流量 + 原始流式事件，并同时输出到终端和本地文件
pnpm gateway:watch --force --verbose --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl --ws-log full 2>&1 | tee /tmp/openclaw-timbot-stream.log
```

如果 `raw-stream.jsonl` 里只有 `assistant_message_end`，没有 `assistant_text_stream` / `text_delta`，说明问题在上游模型或 provider 没有产出 partial，而不是 `timbot.streamingMode` 没生效。

### 配置 / 切换大模型 Provider

```bash
# 交互式配置（推荐，一次性完成 Provider + 模型 + 凭证）
openclaw configure

# 为某个 Provider 配置认证（示例：openai）
openclaw models auth login --provider openai
# 或粘贴已有 token
openclaw models auth paste-token --provider openai

# 将默认模型切换到某个 Provider 的指定模型
openclaw models set openai/gpt-4.1

# 查看当前默认模型与认证状态
openclaw models status
```
