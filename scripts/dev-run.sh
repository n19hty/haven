#!/bin/bash
# Haven — one-command dev/test launcher for the Pi.
#
# Does the whole cleanup dance so you can iterate fast:
#   1. frees port 3001  — stops the haven systemd service + any stray app.py
#   2. (optional) rebuilds the client
#   3. starts the server with logs you can tail
#   4. frees the GPU    — stops the display manager
#   5. launches the app full-screen in cage
# Ctrl+C (or quitting cage) restores the display manager AND the haven service,
# so the Pi goes back to its normal appliance state. Nothing is left half-running.
#
# Run from a TTY on the Pi (Ctrl+Alt+F3, log in):
#   bash scripts/dev-run.sh            # cleanup + serve + kiosk
#   bash scripts/dev-run.sh --build    # rebuild the client first
#   bash scripts/dev-run.sh --no-kiosk # just the server (open the URL elsewhere)
#   bash scripts/dev-run.sh --keep-dm  # don't touch the display manager

set -euo pipefail

HAVEN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3001}"
PY="$HAVEN_DIR/packages/server/.venv/bin/python"
LOG="/tmp/haven-test.log"

DO_BUILD=0
KIOSK=1
TOUCH_DM=1
for a in "$@"; do
  case "$a" in
    --build)    DO_BUILD=1 ;;
    --no-kiosk) KIOSK=0 ;;
    --keep-dm)  TOUCH_DM=0 ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done

CHROMIUM=""
command -v chromium-browser &>/dev/null && CHROMIUM=chromium-browser
[ -z "$CHROMIUM" ] && command -v chromium &>/dev/null && CHROMIUM=chromium

# ── State we restore on exit ──────────────────────────────────────────────────
WAS_SERVICE=0
STOPPED_DM=""
SERVER_PID=""
restore() {
  echo ""
  echo "[cleanup] stopping test server..."
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    # uvicorn drains open socket.io connections gracefully; don't wait on it.
    for _ in 1 2 3; do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 1; done
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
  pkill -f "$HAVEN_DIR/packages/server/app.py" 2>/dev/null || true
  if [ -n "$STOPPED_DM" ]; then
    echo "[cleanup] restarting display manager '$STOPPED_DM'..."
    sudo systemctl start "$STOPPED_DM" 2>/dev/null || true
  fi
  if [ "$WAS_SERVICE" = "1" ]; then
    echo "[cleanup] restarting haven service..."
    sudo systemctl start haven 2>/dev/null || true
  fi
}
trap restore EXIT

# ── 1. Free port 3001 ─────────────────────────────────────────────────────────
echo "[1/4] Freeing port $PORT..."
if systemctl is-active --quiet haven 2>/dev/null; then
  sudo systemctl stop haven && WAS_SERVICE=1 && echo "  stopped haven service (will restore on exit)"
fi
pkill -f "app.py" 2>/dev/null || true
# Same-user stray processes (the service is handled by systemctl stop above).
command -v fuser &>/dev/null && fuser -k "${PORT}/tcp" 2>/dev/null || true
sleep 1

# ── 2. Build (optional) ───────────────────────────────────────────────────────
if [ "$DO_BUILD" = "1" ]; then
  echo "[2/4] Building client..."
  ( cd "$HAVEN_DIR" && NODE_OPTIONS="--max-old-space-size=512" npm run build )
else
  echo "[2/4] Skipping build (pass --build to rebuild the client)."
fi

# ── 3. Start the server ───────────────────────────────────────────────────────
if [ ! -x "$PY" ]; then
  echo "ERROR: server venv missing at $PY — run 'bash scripts/setup-pi.sh' first." >&2
  exit 1
fi
echo "[3/4] Starting server on :$PORT (logs -> $LOG)..."
# Run python directly (no subshell) so SERVER_PID is the actual process and a
# kill on exit frees the port. app.py is cwd-independent: Python puts its own
# dir on sys.path and the code resolves paths from __file__.
PORT="$PORT" "$PY" "$HAVEN_DIR/packages/server/app.py" >"$LOG" 2>&1 &
SERVER_PID=$!
# Wait for the port to accept connections (bash /dev/tcp — no curl dependency).
for _ in $(seq 1 30); do
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && { exec 3>&- 3<&- 2>/dev/null; break; }
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  server exited early — last log lines:" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
  sleep 1
done
echo "  server ready at http://localhost:$PORT   (tail -f $LOG for logs)"

if [ "$KIOSK" = "0" ]; then
  echo "[4/4] --no-kiosk: server is up. Open http://<pi-ip>:$PORT elsewhere. Ctrl+C to stop."
  tail -f "$LOG"
  exit 0
fi

# ── 4. Free the GPU + launch cage ─────────────────────────────────────────────
if [ "$TOUCH_DM" = "1" ]; then
  for dm in lightdm gdm3 gdm sddm greetd; do
    if systemctl is-active --quiet "$dm" 2>/dev/null; then
      echo "[gpu] stopping '$dm' to free the GPU (restored on exit)..."
      sudo systemctl stop "$dm" && STOPPED_DM="$dm"
      break
    fi
  done
fi

if [ -z "$CHROMIUM" ]; then
  echo "ERROR: chromium not found (tried chromium-browser, chromium)." >&2
  exit 1
fi
echo "[4/4] Launching cage -> http://localhost:$PORT ..."
echo "  Quit: switch to another TTY (Ctrl+Alt+F2) and 'pkill -f cage', or Ctrl+C here."
cage -- "$CHROMIUM" \
  --ozone-platform=wayland \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  "http://localhost:$PORT" || true
