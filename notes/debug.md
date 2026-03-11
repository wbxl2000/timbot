## 调试

```bash
# 简单前台运行 Gateway（看网关自身日志）
openclaw gateway run --verbose --force

# 如果需要观察 WebSocket 全量流量 + 原始流式事件，
# 推荐在 OpenClaw 主仓库里使用提供的 gateway:watch 脚本：
pnpm gateway:watch --force --verbose --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl --ws-log full 2>&1 | tee /tmp/openclaw-timbot-stream.log
```

如果 `raw-stream.jsonl` 中只有 `assistant_message_end`，没有 `assistant_text_stream` / `text_delta`，可以直接判定为上游模型或 provider 没有产出 partial；这时 `timbot` 的 `text_modify` / `custom_modify` / `tim_stream` 都不会出现真正的中间流式更新。


## 配置

```bash
openclaw config set channels.timbot.sdkAppId "1600126417"
openclaw config set channels.timbot.secretKey ""
openclaw config set channels.timbot.token ""
```

## 发送消息

```bash
TS=$(date +%s)
RAND=$RANDOM

curl -sS 'http://127.0.0.1:18789/timbot' \
  -H 'content-type: application/json' \
  --data-binary "{
    \"CallbackCommand\":\"Bot.OnC2CMessage\",
    \"From_Account\":\"qer5\",
    \"To_Account\":\"@RBT#001\",
    \"MsgTime\":$TS,
    \"MsgRandom\":$RAND,
    \"MsgKey\":\"local_${TS}_${RAND}\",
    \"MsgBody\":[
      {
        \"MsgType\":\"TIMTextElem\",
        \"MsgContent\":{\"Text\":\"生成十种语言的快速排序的代码，每段都要加至少300 字的讲解\"}
      }
    ]
  }"
```
