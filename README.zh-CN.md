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
| `overflowPolicy` | 流式超限后的处理策略：`stop`（停止并提示）/ `split`（按长度分段续发，默认） | `split` |

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

# 长文本超限后直接停止并提示
openclaw config set channels.timbot.overflowPolicy stop

# 长文本超限后按长度继续分段发送（默认）
openclaw config set channels.timbot.overflowPolicy split

# 自定义占位文案
openclaw config set channels.timbot.typingText "思考中，请稍候..."
```

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
