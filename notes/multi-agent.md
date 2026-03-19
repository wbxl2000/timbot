# Multi-Agent 方案设计

## 方案选型

### 方案 A：多机器人账号 → 多 agent（采用）

优势：
- 与飞书/Telegram 模式一致，概念清晰
- 每个 agent 有独立的机器人身份，用户感知明确
- 腾讯 IM REST API 支持 account_import 创建账号
- 交互形态为"不同会话切换"，一个 agent = 一个 botAccount = 一个独立会话对象

劣势：
- 每个机器人账号需要独立的 botAccount，webhook 回调里要按 To_Account 区分
- 当前 onboarding 是单账号覆盖式，改多账号向导工作量不小

### 方案 B：单机器人 + peer 路由 → 多 agent（放弃）

优势：
- 运行时路由已基本具备（From_Account → resolveAgentRoute）
- 不需要管理多个机器人账号和好友关系
- 对现有用户 C2C 业务零侵入

劣势：
- 单机器人只会在会话列表出现一次，做不到"不同会话切换"
- 用户身份感弱

放弃原因：前端交互选择飞书模式（不同会话切换），单机器人方案不可行。

### 选型决策点

OpenClaw 插件体系分两层：
- **插件层**：负责把入站消息的 accountId/peer 标准化后交给 `resolveAgentRoute(...)`
- **OpenClaw 核心层**：负责 agent 创建、bindings 写入、重启生效

timbot 当前已有的基础：
- 账号模型已有（`src/accounts.ts`）
- 运行时会把 accountId 带进路由（`src/monitor.ts`）
- 缺的是：多账号 onboarding、`setup.applyAccountConfig` / `resolveAccountId` / `resolveBindingAccountId` 适配

## 核心发现

- `@RBT#` 机器人发消息**不需要好友关系**，无视黑名单
- 每个 sdkAppId **最多 20 个**机器人账号（硬限制）
- 机器人账号可通过 `account_import` API 创建，设置昵称和头像
- 用户端要能看到会话，可能需要机器人先主动发一条消息，或通过 `friend_add` + `ForceAddFlags: 1` 强制加好友

## 架构设计

```
┌─────────────────────────────────────────────────┐
│  OpenClaw 配置                                    │
│                                                   │
│  agents.list:                                     │
│    - id: default   (默认助手)                      │
│    - id: translator (翻译官)                       │
│    - id: coder     (代码助手)                      │
│                                                   │
│  channels.timbot:                                 │
│    sdkAppId / secretKey / token (共享)             │
│    bots:                                          │
│      default:    { botAccount: @RBT#001, agentId: default }     │
│      translator: { botAccount: @RBT#002, agentId: translator }  │
│      coder:      { botAccount: @RBT#003, agentId: coder }       │
│                                                   │
│  bindings: (由 timbot 自动生成或用户手配)            │
│    - agentId: translator                          │
│      match: { channel: timbot, account: translator }│
└─────────────────────────────────────────────────┘

                    ↕ Webhook / REST API

┌─────────────────────────────────────────────────┐
│  腾讯 IM                                         │
│  @RBT#001 ← → 用户A (聊默认助手)                  │
│  @RBT#002 ← → 用户A (聊翻译官)                    │
│  @RBT#003 ← → 用户A (聊代码助手)                  │
└─────────────────────────────────────────────────┘
```

## timbot 插件侧改动点

### 1. 配置结构（新增 bots 字段）

```json
{
  "sdkAppId": 12345678,
  "secretKey": "xxx",
  "token": "webhook-token",
  "bots": {
    "default": {
      "botAccount": "@RBT#001",
      "agentId": "default",
      "nickname": "AI助手",
      "faceUrl": "https://..."
    },
    "translator": {
      "botAccount": "@RBT#002",
      "agentId": "translator",
      "nickname": "翻译官"
    }
  },
  "defaultBot": "default"
}
```

与现有 `accounts` 的关系：`accounts` 是多 IM 应用场景（不同 sdkAppId），`bots` 是同一 IM 应用下的多机器人。两者可以共存，但大部分用户只会用 `bots`。

### 2. Webhook 路由改造

当前逻辑是按 SdkAppid + To_Account 匹配 account，改为：

```
webhook 请求
  → To_Account = "@RBT#002"
  → 遍历 bots，找到 botAccount === "@RBT#002" 的条目
  → 拿到 agentId = "translator"，botId = "translator"
  → resolveAgentRoute({ accountId: "translator", agentId: "translator", ... })
```

### 3. 机器人账号生命周期管理

- `account_import` 创建机器人账号（设置昵称、头像）
- `friend_add` + `ForceAddFlags: 1` 强制加好友（让用户会话列表出现该机器人）
- 插件启动时校验 bots 配置的账号是否已导入

### 4. 动态添加机器人的 API

```
创建 agent（OpenClaw 侧）
  → 调用 timbot 接口：创建 bot
    → account_import 注册 @RBT#xxx
    → 写入 bots 配置
    → 可选：friend_add 给指定用户
  → 更新 bindings
```

## 前端改动点

- 会话列表从固定单机器人 → 动态获取机器人列表
- 每个机器人独立会话，独立消息历史
- 需要"发现/添加机器人"入口
- 机器人列表可从 timbot 配置接口获取

## 备选：按用户路由（peer 匹配）

如果只有一个机器人账号，但想把不同用户/群的消息路由到不同 Agent：

```json5
{
  bindings: [
    { agentId: "translator", match: { channel: "timbot", peer: { kind: "direct", id: "user_alice" } } },
    { agentId: "coder", match: { channel: "timbot", peer: { kind: "group", id: "@TGS#group001" } } },
    { agentId: "main", match: { channel: "timbot" } },
  ]
}
```

注意：
- 代码里传的 `kind: "dm"` 会被 OpenClaw 规范成 `direct`，配置里写 `direct`
- 建议打开 `session.dmScope: "per-channel-peer"`，否则所有 DM 会折叠到同一个主会话
- peer 匹配优先级高于 accountId 匹配

## 限制和风险

| 限制 | 影响 | 应对 |
|------|------|------|
| 每个 sdkAppId 最多 20 个 @RBT# 账号 | 最多 20 个 agent | 大部分场景够用；超出需多 sdkAppId 或混用普通账号 |
| 体验版日限 1000 条消息 | 开发测试足够，生产需升级 | 文档提示 |
| 机器人账号不支持特殊字符 | botAccount 命名受限 | 用 @RBT#agent_xxx 格式 |
| 好友关系可能影响用户会话列表展示 | 用户可能看不到机器人 | 机器人主动发欢迎消息，或 friend_add 强制添加 |

## 待讨论

1. bots 和现有 accounts 的关系——是替换还是并存
2. 动态创建 bot 的接口形态——是 HTTP API 还是走 OpenClaw 的配置系统
3. 用户侧如何"发现"新的机器人——是推送还是拉取
