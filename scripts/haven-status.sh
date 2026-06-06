#!/bin/bash
# Haven — device status at a glance, over SSH:
#     ssh pi@<haven-ip> 'cd ~/haven && bash scripts/haven-status.sh'

set -u

HAVEN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HAVEN_DIR"
PORT="${PORT:-3001}"

echo "Haven status"
echo "  commit:    $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
echo "  message:   $(git log -1 --pretty=%s)"
[ -f .haven-last-good ]      && echo "  last-good: $(cut -c1-7 < .haven-last-good)"
[ -f .haven-last-good.prev ] && echo "  prev-good: $(cut -c1-7 < .haven-last-good.prev)"

echo -n "  server:    "
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  exec 3>&- 3<&- 2>/dev/null; echo "UP on :$PORT"
else
  echo "DOWN"
fi
echo "  service:   $(systemctl is-active haven 2>/dev/null || echo unknown)"
echo -n "  kiosk:     "; pgrep -x cage >/dev/null && echo "running" || echo "not running"
echo "  ip:        $(hostname -I | awk '{print $1}')"

echo "  controllers (Bluetooth):"
_devs="$(timeout 5 bluetoothctl devices Connected 2>/dev/null)"
[ -z "$_devs" ] && _devs="$(timeout 5 bluetoothctl devices 2>/dev/null)"
if [ -n "$_devs" ]; then echo "$_devs" | sed 's/^/    /'; else echo "    (none connected)"; fi
