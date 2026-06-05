#!/bin/bash
# Haven — PR1 spike runner (cage + Chromium + Bluetooth gamepad)
#
# Proves the load-bearing assumptions of Haven Mode on the ACTUAL Pi before any
# identity / pairing / boot-target work is built on them:
#
#   GPU      Chromium gets hardware acceleration under cage (not llvmpipe).
#   GAMEPAD  a paired Bluetooth controller shows up in navigator.getGamepads()
#            and its buttons register — read this off the TV (gamepad-check.html).
#   AUDIO    a button press plays a tone over HDMI.
#   SESSION  a seat / user D-Bus / audio sink exist in the mode you launched from
#            (this script captures those OS-side facts; the page can't).
#
# NON-DESTRUCTIVE: this does NOT change the boot target or install any service.
# Run it from a bare TTY (Ctrl+Alt+F3, log in) to test the real "no desktop"
# condition, or from a terminal in the desktop for a quick smoke test. Flipping
# the Pi to multi-user.target permanently is PR2 work, gated on this passing.
#
# Usage (on the Pi):
#   bash spike/run-spike.sh            # run the spike (assumes deps installed)
#   bash spike/run-spike.sh --install  # apt-install cage, chromium, bluez first
#   bash spike/run-spike.sh --facts    # only capture/print OS facts, don't launch

set -euo pipefail

SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${HAVEN_SPIKE_PORT:-8722}"
RESULTS="$SPIKE_DIR/results-$(date +%Y%m%d-%H%M%S).txt"

DO_INSTALL=0
FACTS_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --install) DO_INSTALL=1 ;;
    --facts)   FACTS_ONLY=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

echo ""
echo "  Haven PR1 spike — cage + Chromium + Bluetooth gamepad"
echo "  results -> $RESULTS"
echo ""

# ── Optional dependency install ───────────────────────────────────────────────
if [[ "$DO_INSTALL" == "1" ]]; then
  echo "[install] cage, chromium, bluez, mesa utils..."
  sudo apt-get update
  # Chromium package name varies across Raspberry Pi OS releases; try both.
  sudo apt-get install -y cage bluez mesa-utils \
    && (sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium)
fi

# ── Resolve the Chromium binary ────────────────────────────────────────────────
if command -v chromium-browser &>/dev/null; then CHROMIUM=chromium-browser
elif command -v chromium &>/dev/null;        then CHROMIUM=chromium
else CHROMIUM=""; fi

# ── Capture OS-side facts (the page cannot see these) ──────────────────────────
# These answer the outside-voice concern: multi-user.target can remove the user
# session that bluez pairing + audio quietly depend on. We record what's actually
# present in whatever mode you launched from.
{
  echo "===== Haven PR1 spike facts — $(date) ====="
  echo
  echo "## Host"
  uname -a || true
  ( . /etc/os-release 2>/dev/null && echo "OS: ${PRETTY_NAME:-unknown}" ) || true
  echo "Pi model: $(tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo unknown)"
  echo
  echo "## Session / seat (is there a user session bus + seat here?)"
  echo "XDG_SESSION_TYPE=${XDG_SESSION_TYPE:-<unset>}"
  echo "XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-<unset>}"
  echo "WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-<unset>}  DISPLAY=${DISPLAY:-<unset>}"
  echo "DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-<unset>}"
  loginctl 2>/dev/null || echo "loginctl: unavailable"
  echo "lingering enabled for $USER: $(loginctl show-user "$USER" -p Linger 2>/dev/null || echo unknown)"
  echo
  echo "## Tools present"
  echo "cage:     $(command -v cage || echo MISSING)"
  echo "chromium: ${CHROMIUM:-MISSING}"
  echo "bluez:    $(command -v bluetoothctl || echo MISSING)"
  echo
  echo "## Bluetooth"
  # timeout-guarded: bluetoothctl blocks indefinitely when no adapter / system
  # bus is responsive, which would otherwise freeze the whole spike.
  timeout 5 bluetoothctl --version 2>/dev/null || echo "bluetoothctl: unavailable / timed out"
  timeout 5 bluetoothctl devices 2>/dev/null || echo "(no paired devices listed / timed out / no session)"
  echo
  echo "## Audio sinks (HDMI?)"
  if command -v pactl &>/dev/null; then timeout 5 pactl list short sinks 2>/dev/null || echo "pactl: no server reachable / timed out"
  elif command -v aplay &>/dev/null; then timeout 5 aplay -l 2>/dev/null || echo "aplay: none / timed out"
  else echo "no pactl/aplay"; fi
  echo
  echo "## GPU / DRI"
  ls -l /dev/dri 2>/dev/null || echo "/dev/dri: none"
  if command -v glxinfo &>/dev/null; then timeout 10 glxinfo 2>/dev/null | grep -iE "opengl renderer|direct rendering" || true
  else echo "glxinfo: not installed (apt-get install mesa-utils for a CLI GPU check)"; fi
} | tee "$RESULTS"

echo ""
if [[ -z "$CHROMIUM" ]]; then
  echo "  ! Chromium not found. Re-run with --install (or install it manually)." >&2
  [[ "$FACTS_ONLY" == "1" ]] && exit 0 || exit 1
fi
if ! command -v cage &>/dev/null; then
  echo "  ! cage not found. Re-run with --install." >&2
  [[ "$FACTS_ONLY" == "1" ]] && exit 0 || exit 1
fi

if [[ "$FACTS_ONLY" == "1" ]]; then
  echo "  --facts: stopping before launch."
  exit 0
fi

# ── Serve the test page + launch cage-Chromium ────────────────────────────────
# Served over http://localhost so WebAudio/Gamepad behave like the real app
# (which is served by the Python server), not file://.
echo "[serve] http://localhost:$PORT/gamepad-check.html"
python3 -m http.server "$PORT" --directory "$SPIKE_DIR" >/dev/null 2>&1 &
HTTP_PID=$!
cleanup() { kill "$HTTP_PID" 2>/dev/null || true; }
trap cleanup EXIT

sleep 1

echo "[launch] cage -- $CHROMIUM (Wayland kiosk)"
echo "         Press a button on a paired controller. Quit cage with the"
echo "         power/back combo or switch VTs; results saved to $RESULTS."
echo ""

# Minimal flags on purpose: we want to observe DEFAULT GPU behavior, not force it.
# --ozone-platform=wayland is required so Chromium talks to cage's compositor.
cage -- "$CHROMIUM" \
  --ozone-platform=wayland \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  "http://localhost:$PORT/gamepad-check.html" || true

echo ""
echo "  Spike session ended. Record the on-TV verdict in $RESULTS (GPU color,"
echo "  gamepad buttons lit, tone heard) alongside the captured OS facts."
