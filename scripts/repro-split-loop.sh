#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="/Users/qilongyu/code/timbot"
LOG_FILE="${TIMBOT_REPRO_LOG:-/Users/qilongyu/code/split.txt}"
TMP_DIR="${TIMBOT_REPRO_TMP:-$ROOT_DIR/.tmp}"
PID_FILE="$TMP_DIR/repro-gateway.pid"
SOURCE_CONFIG="${OPENCLAW_CONFIG_PATH:-/Users/qilongyu/.openclaw/openclaw.json}"
REPRO_CONFIG="$TMP_DIR/openclaw-repro.json"
DEFAULT_PROMPT="不要管之前干了什么，继续完成这个任务：生成十种语言的快速排序的代码，每段都要加至少300 字的讲解或者表格"

mkdir -p "$TMP_DIR"

usage() {
  cat <<'EOF'
Usage:
  scripts/repro-split-loop.sh start
  scripts/repro-split-loop.sh trigger [prompt]
  scripts/repro-split-loop.sh stop
  scripts/repro-split-loop.sh restart

Environment:
  TIMBOT_REPRO_LOG   Override log file path. Default: /Users/qilongyu/code/split.txt
  TIMBOT_REPRO_TMP   Override temp directory. Default: /Users/qilongyu/code/timbot/.tmp
EOF
}

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

start_gateway() {
  if is_running; then
    echo "gateway already running: pid=$(cat "$PID_FILE")"
    return 0
  fi

  node - <<'EOF' "$SOURCE_CONFIG" "$REPRO_CONFIG"
const fs = require("node:fs");

const sourcePath = process.argv[2];
const targetPath = process.argv[3];
const config = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (config.commands && typeof config.commands === "object") {
  delete config.commands.ownerDisplay;
}
fs.writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`);
EOF

  : > "$LOG_FILE"
  (
    cd "$ROOT_DIR"
    exec env OPENCLAW_CONFIG_PATH="$REPRO_CONFIG" pnpm openclaw gateway run --verbose --force >>"$LOG_FILE" 2>&1
  ) &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  for _ in $(seq 1 60); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "gateway exited early; check $LOG_FILE" >&2
      return 1
    fi
    if rg -q "webhook registered|gateway listening|ready" "$LOG_FILE" 2>/dev/null; then
      echo "gateway started: pid=$pid log=$LOG_FILE"
      return 0
    fi
    sleep 0.5
  done

  echo "gateway started without readiness marker yet: pid=$pid log=$LOG_FILE"
}

trigger_message() {
  local prompt="${1:-$DEFAULT_PROMPT}"
  local ts rand payload_file
  ts="$(date +%s)"
  rand="${RANDOM}${RANDOM}"
  payload_file="$TMP_DIR/repro-payload.json"

  cat >"$payload_file" <<EOF
{
  "CallbackCommand": "Bot.OnC2CMessage",
  "From_Account": "qer5",
  "To_Account": "@RBT#001",
  "MsgTime": $ts,
  "MsgRandom": $rand,
  "MsgKey": "local_${ts}_${rand}",
  "MsgBody": [
    {
      "MsgType": "TIMTextElem",
      "MsgContent": {
        "Text": $(node -p "JSON.stringify(process.argv[1])" "$prompt")
      }
    }
  ]
}
EOF

  curl -sS "http://127.0.0.1:18789/timbot" \
    -H "content-type: application/json" \
    --data-binary "@$payload_file"
  echo
}

stop_gateway() {
  if ! is_running; then
    echo "gateway not running"
    rm -f "$PID_FILE"
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill -INT "$pid"
  for _ in $(seq 1 40); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "gateway stopped: pid=$pid"
      return 0
    fi
    sleep 0.25
  done

  echo "gateway did not exit after SIGINT; sending SIGKILL" >&2
  kill -KILL "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
}

case "${1:-}" in
  start)
    start_gateway
    ;;
  trigger)
    shift || true
    trigger_message "${1:-$DEFAULT_PROMPT}"
    ;;
  stop)
    stop_gateway
    ;;
  restart)
    stop_gateway || true
    start_gateway
    ;;
  *)
    usage
    exit 1
    ;;
esac
