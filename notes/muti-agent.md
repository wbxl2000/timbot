 你的分析很到位，我来补充几个关键判断和建议。

  方案评估

  方案 A：多机器人账号 → 多 agent

  优势：
  - 与飞书/Telegram 模式一致，概念清晰
  - 每个 agent 有独立的机器人身份，用户感知明确
  - 腾讯 IM REST API 支持 account_import 创建账号

  劣势：
  - 你说"绑定好友关系不确定，目前手动在前端添加"——这是关键障碍。如果好友关系不能 API 自动化，每加一个 agent 都要手动操作，产品化体验很差
  - 每个机器人账号需要独立的 botAccount，webhook 回调里要按 To_Account 区分
  - 你当前 onboarding 是单账号覆盖式，改多账号向导工作量不小

  方案 B：单机器人 + peer 路由 → 多 agent

  优势：
  - 运行时路由你已经基本具备（From_Account → resolveAgentRoute）
  - 不需要管理多个机器人账号和好友关系
  - 对现有用户 C2C 业务零侵入——机器人只有一个，路由逻辑在 OpenClaw 侧
  - 最小改动原则

  劣势：
  - 用户看到的始终是同一个机器人头像/名称，需要前端做 UI 层区分
  - "谁在跟我说话"的身份感弱于多机器人方案

  核心问题

  你提到的一个点很关键：

  用户可能本身就有 C2C 业务，openclaw AI 机器人只是附属业务

  这决定了方案 B 更合适。方案 A 要求用户为每个 agent 注册独立的机器人账号，这对"附属业务"来说太重了。

  但有个前提要先确认

⏺ User answered Claude's questions:
  ⎿  · 你的 demos/web 前端里，multi-agent 的交互形态是怎样的？是像飞书那样用户在不同
     的机器人会话间切换，还是在同一个会话里通过某种方式（比如
     tab、@提及、命令前缀）选择不同 agent？ → 不同会话切换

⏺ 明白了，是飞书模式——每个 agent 是独立的会话对象。

  这个交互形态对方案选择有决定性影响，我重新梳理一下。

  结论：方案 A（多机器人账号）是正确选择

  你选不同会话切换，那每个 agent 必须是一个独立的聊天对象。在腾讯 IM 的模型里，C2C 会话的另一端就是一个账号。所以：

  - 一个 agent = 一个 botAccount
  - 用户的会话列表里看到多个机器人，各自有名称和头像
  - 点进哪个机器人就是跟哪个 agent 对话

  方案 B（单机器人 + peer 路由）在这个交互形态下不可行——单机器人只会在会话列表里出现一次，做不到"不同会话切换"。

  方案设计

  整体架构

  用户会话列表:
    🤖 AI助手 (agent: default)     →  botAccount: @RBT#001
    🤖 翻译官 (agent: translator)  →  botAccount: @RBT#002
    🤖 代码助手 (agent: coder)     →  botAccount: @RBT#003

  Webhook 回调 → timbot 按 To_Account 识别是哪个 bot
             → 映射到 agentId
             → resolveAgentRoute 路由到对应 agent

  需要解决的三个关键问题

  1. 机器人账号管理

  腾讯 IM 支持 v4/im_open_login_svc/account_import API 创建账号，可以设置昵称和头像。这一步可以自动化。

  但好友关系你说"不确定能不能 API 添加"——这里有两条路：
  - 如果机器人账号是 @RBT# 前缀的，腾讯 IM 可能自动处理好友关系（需要确认）
  - 如果不行，可以用 v4/sns/friend_add API 单向加好友，或者让用户主动发起会话（C2C 不一定需要好友关系，取决于你的 IM 应用配置）

  2. 配置结构

  当前 accounts 模型已经支持多账号，但每个账号是独立的 sdkAppId + secretKey，这是给"多个 IM 应用"设计的。你的场景是同一个 IM 应用下多个机器人账号，所以需要调整：

  {
    "channels": {
      "timbot": {
        "sdkAppId": 12345678,
        "secretKey": "xxx",
        "token": "webhook-token",
        // 多机器人配置
        "bots": {
          "default": {
            "botAccount": "@RBT#001",
            "identifier": "administrator",  // 可选，默认继承顶层
            "agentId": "default"             // 绑定到哪个 agent
          },
          "translator": {
            "botAccount": "@RBT#002",
            "agentId": "translator"
          },
          "coder": {
            "botAccount": "@RBT#003",
            "agentId": "coder"
          }
        },
        "defaultBot": "default"
      }
    }
  }

  这样同一个 sdkAppId 下共享密钥，每个 bot 只需要指定 botAccount 和 agentId。

  3. Webhook 路由

  当前 webhook 收到消息时，To_Account 就是目标机器人。路由逻辑：

  webhook 收到消息
    → To_Account = "@RBT#002"
    → 查 bots 配置，找到 botAccount === "@RBT#002" 的条目
    → 拿到 agentId = "translator"
    → resolveAgentRoute({ agentId: "translator", ... })

  demos/web 前端需要的改动

  - 会话列表需要展示多个机器人（目前应该只有一个固定的）
  - 每个机器人独立的会话历史
  - 可能需要一个"添加机器人"或"机器人列表"的入口

  需要你确认的问题

  在出详细设计之前，有几个点需要确认：

⏺ User answered Claude's questions:
  ⎿  · 腾讯 IM C2C 消息是否需要好友关系？你前端"手动添加"指的是加好友还是只是在 UI
     上添加会话？ → 需要好友关系
     · 新的机器人/agent
     的创建时机是怎样的？是预先在配置里定义好，还是需要运行时动态创建？ → 两者都要
     · 机器人账号类型是用 @RBT# 前缀的标准机器人账号，还是普通账号？ → @RBT#
     机器人账号

⏺ 好消息——搜索结果显示 @RBT# 机器人账号发送 C2C 消息不校验好友关系。这大幅简化了方案。

  最终方案设计

  核心发现

  - @RBT# 机器人发消息不需要好友关系，无视黑名单也能发
  - 但每个 sdkAppId 最多 20 个机器人账号——这是硬限制
  - 机器人账号可通过 account_import API 创建，设置昵称和头像
  - 好友关系方面：机器人主动发消息不需要好友，但用户端要能看到会话，可能需要机器人先主动发一条消息，或者用 friend_add + ForceAddFlags: 1 强制加好友

  架构设计

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

  timbot 插件侧改动点

  1. 配置结构（新增 bots 字段）

  {
    "sdkAppId": 12345678,
    "secretKey": "xxx",
    "token": "webhook-token",
    "bots": {
      "default": {
        "botAccount": "@RBT#001",
        "agentId": "default",
        "nickname": "AI助手",     // 用于 account_import 设置昵称
        "faceUrl": "https://..."  // 头像
      },
      "translator": {
        "botAccount": "@RBT#002",
        "agentId": "translator",
        "nickname": "翻译官"
      }
    },
    "defaultBot": "default"
  }

  与现有 accounts 的关系：accounts 是多 IM 应用场景（不同 sdkAppId），bots 是同一 IM 应用下的多机器人。两者可以共存，但大部分用户只会用 bots。

  2. Webhook 路由改造

  当前逻辑是按 SdkAppid + To_Account 匹配 account，改为：

  webhook 请求
    → To_Account = "@RBT#002"
    → 遍历 bots，找到 botAccount === "@RBT#002" 的条目
    → 拿到 agentId = "translator"，botId = "translator"
    → resolveAgentRoute({ accountId: "translator", agentId: "translator", ... })

  3. 机器人账号生命周期管理

  新增功能：
  - account_import 创建机器人账号（设置昵称、头像）
  - friend_add + ForceAddFlags: 1 强制加好友（让用户会话列表出现该机器人）
  - 插件启动时校验 bots 配置的账号是否已导入

  4. 动态添加机器人的 API

  既然你要支持运行时动态添加，需要暴露一个接口（可以是 OpenClaw 的 gateway 扩展或独立 HTTP 路由），流程：

  创建 agent（OpenClaw 侧）
    → 调用 timbot 接口：创建 bot
      → account_import 注册 @RBT#xxx
      → 写入 bots 配置
      → 可选：friend_add 给指定用户
    → 更新 bindings

  demos/web 前端改动点

  - 会话列表从固定单机器人 → 动态获取机器人列表
  - 每个机器人独立会话，独立消息历史
  - 可能需要一个"发现/添加机器人"的入口
  - 机器人列表可以从 timbot 的配置接口获取

  限制和风险
  限制: 每个 sdkAppId 最多 20 个 @RBT# 账号
  影响: 最多 20 个 agent
  应对: 对大部分场景够用；超出需要多 sdkAppId 或混用普通账号
  ────────────────────────────────────────
  限制: 体验版日限 1000 条消息
  影响: 开发测试足够，生产需升级
  应对: 文档提示
  ────────────────────────────────────────
  限制: 机器人账号不支持特殊字符
  影响: botAccount 命名受限
  应对: 用 @RBT#agent_xxx 格式
  ────────────────────────────────────────
  限制: 好友关系可能影响用户会话列表展示
  影响: 用户可能看不到机器人
  应对: 机器人主动发一条欢迎消息，或 friend_add 强制添加
  与你之前分析的对比

  你之前的分析里提到的 setup.applyAccountConfig / resolveAccountId / resolveBindingAccountId 这些确实需要做，但核心思路从"多 IM 应用 account"变成了"同一 IM 应用下的多 bot"，配置更简单，不需要每个 bot 各自配 sdkAppId/secretKey。

  ---
  你觉得这个方案方向对吗？有几个点可以进一步讨论：
  1. bots 和现有 accounts 的关系——是替换还是并存
  2. 动态创建 bot 的接口形态——是 HTTP API 还是走 OpenClaw 的配置系统
  3. 用户侧如何"发现"新的机器人——是推送还是拉取