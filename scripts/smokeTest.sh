#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-$(( ( RANDOM % 10000 ) + 40000 ))}"
LOG_FILE="/tmp/ai-image-automation-smoke.log"

cd "$ROOT_DIR"
PORT="$PORT" node src/index.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 20); do
  if curl --noproxy '*' -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl --noproxy '*' -fsS "http://127.0.0.1:${PORT}/health"
curl --noproxy '*' -fsS -X POST "http://127.0.0.1:${PORT}/build-prompt" \
  -H 'content-type: application/json' \
  -d '{"subject":"robot barista","scene":"busy morning cafe","preset":"cinematic"}'
