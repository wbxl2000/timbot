## 调试

```bash
# 简单前台运行 Gateway（看网关自身日志）
openclaw gateway run --verbose --force

# 如果需要观察 WebSocket 全量流量 + 原始流式事件，
# 推荐在 OpenClaw 主仓库里使用提供的 gateway:watch 脚本：
pnpm gateway:watch --force --verbose --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl --ws-log full 2>&1 | tee /tmp/openclaw-timbot-stream.log
```