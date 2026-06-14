#!/bin/bash
# Haven — console kiosk launcher (no desktop).
#
# Invoked from the tty1 autologin session (see setup-pi.sh). Runs the Haven UI
# full-screen in cage (a minimal Wayland kiosk compositor) pointed at the local
# server. Loops forever, so killing cage (e.g. `pkill -x cage` during an update)
# relaunches Chromium with the freshly built client.
#
# The tty1 autologin session gives cage a seat (DRM master + input) and a user
# PipeWire instance for audio — the session pieces a bare multi-user.target
# boot would otherwise lack.

set -u

HAVEN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3001}"

CHROMIUM=""
command -v chromium-browser &>/dev/null && CHROMIUM=chromium-browser
[ -z "$CHROMIUM" ] && command -v chromium &>/dev/null && CHROMIUM=chromium
if [ -z "$CHROMIUM" ]; then
  echo "haven kiosk: chromium not found (tried chromium-browser, chromium)." >&2
  exec bash  # drop to a shell rather than spinning
fi

# Wait for the server to answer before showing the UI (bash /dev/tcp, no curl).
for _ in $(seq 1 60); do
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && { exec 3>&- 3<&- 2>/dev/null; break; }
  sleep 1
done

while true; do
  cage -- "$CHROMIUM" \
    --ozone-platform=wayland \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --check-for-update-interval=31536000 \
    --disable-dev-shm-usage \
    --ignore-gpu-blocklist \
    --enable-gpu-rasterization \
    "http://localhost:$PORT" || true
  # cage exited (crash, or an update killed it) — relaunch with the new build.
  sleep 1
done
