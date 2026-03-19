# TODO: 用 administrator 代替 @RBT#001

## 问题

当前默认 `botAccount` 是 `@RBT#001`，需要调研是否可以直接使用 `administrator` 作为机器人账号来收发消息，从而简化配置。

## 待调研

- `administrator` 账号在 IM REST API 中发送消息时的行为是否与 `@RBT#001` 一致
- 接收回调（Bot.OnC2CMessage / Bot.OnGroupMessage）时 `To_Account` 的匹配逻辑
- 自身消息过滤（`isSelfInboundMessage`）是否需要适配
- 是否存在权限差异或副作用（如 admin 消息在客户端的展示、消息漫游等）
