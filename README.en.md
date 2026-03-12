# Tencent Cloud IM Channel Plugin for OpenClaw

Maintainer: longyuqi@tencent.com

Tencent Cloud IM intelligent bot via webhooks + REST API.

For a full integration tutorial, see: **[Tencent Cloud Official Documentation](https://cloud.tencent.com/document/product/269/128326)**

## Install

### Option A: Install from npm
```bash
openclaw plugins install timbot
```

### Option B: Local development (link)
```bash
git clone <repo-url> && cd timbot
pnpm install && pnpm build
bash install-timbot.sh
```

## Configuration

All options are under `channels.timbot` in the OpenClaw config.

### Basic

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `sdkAppId` | Yes | Tencent Cloud IM SDK App ID | — |
| `secretKey` | Yes | Secret key for generating UserSig | — |
| `identifier` | No | Identity for API calls | `administrator` |
| `botAccount` | No | Bot account ID | `@RBT#001` |
| `apiDomain` | No | Tencent IM API domain | `console.tim.qq.com` |
| `token` | No | Callback token for signature verification | — |
| `webhookPath` | No | Webhook endpoint path | `/timbot` |
| `enabled` | No | Enable/disable this channel | `true` |

### Messaging & Streaming

| Option | Description | Default |
|--------|-------------|---------|
| `welcomeText` | Welcome message for new conversations | — |
| `typingText` | Placeholder text while the bot is generating (in non-streaming mode, sent as a placeholder message then modified; in streaming mode, used as CompatibleText) | `正在思考中...` |
| `streamingMode` | Streaming mode: `off` / `text_modify` / `custom_modify` / `tim_stream` | `off` |
| `fallbackPolicy` | Streaming fallback policy: `strict` (no fallback) / `final_text` (degrade to final text on failure) | `strict` |
| `overflowPolicy` | What to do when a streaming reply gets too large: `stop` (stop and send a notice) / `split` (continue by splitting into follow-up messages, default) | `split` |

### DM Policy

| Option | Description | Default |
|--------|-------------|---------|
| `dm.policy` | DM policy: `open` / `allowlist` / `pairing` / `disabled` | `open` |
| `dm.allowFrom` | Allowed sender list (`open` policy defaults to `["*"]`) | — |

### Multi-Account

| Option | Description |
|--------|-------------|
| `defaultAccount` | Default account ID |
| `accounts` | Multi-account config object; key is account ID, value contains all account-level options above |

In multi-account mode, top-level config serves as the base for all accounts. Account-level fields override the top-level config.

## FAQ

### How do I choose a streamingMode?

- **Not sure / just getting started** → `off` (default). Most stable; works on all clients.
- **Want a "typing" experience with official IM clients** → `text_modify`. Best compatibility across Web, Android, iOS, Mini Program, and Desktop — the message is continuously updated in place.
- **Custom frontend with your own rendering** → `custom_modify`. Has more control; delivers structured data via `TIMCustomElem` for your frontend to parse and render.
- **Want native Tencent Cloud streaming (`TIMStreamElem`)** → `tim_stream`. Make sure your client supports this message type, otherwise users will only see the CompatibleText.

Important: these three streaming modes only decide how TIM carries updates. They do not guarantee that the upstream model will emit text incrementally. The selected provider/model must produce partial text in OpenClaw (`onPartialReply`). If the upstream only returns a final answer at the end, TIM will behave like “placeholder message -> final replace” instead of showing text grow chunk by chunk.

### How do I quickly change streaming settings?

```bash
# Enable text_modify streaming
openclaw config set channels.timbot.streamingMode text_modify

# Enable custom_modify streaming
openclaw config set channels.timbot.streamingMode custom_modify

# Enable tim_stream streaming
openclaw config set channels.timbot.streamingMode tim_stream

# Disable streaming
openclaw config set channels.timbot.streamingMode off

# Set fallback policy to degrade to final text on failure
openclaw config set channels.timbot.fallbackPolicy final_text

# Stop and send a notice when streaming output gets too large
openclaw config set channels.timbot.overflowPolicy stop

# Continue by splitting long output into follow-up messages (default)
openclaw config set channels.timbot.overflowPolicy split

# Customize typing placeholder text
openclaw config set channels.timbot.typingText "Thinking, please wait..."
```
