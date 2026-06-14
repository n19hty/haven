#!/bin/bash
# Haven — Bluetooth controller pairing.
# Launched in the background via systemd-run by POST /api/bt/scan.
# Put the controller in pairing mode before this script starts.
# Scans for up to 30 seconds, then pairs, trusts, and connects the first
# gamepad-class device it finds.

set -uo pipefail

SCAN_SECS=30

rfkill unblock bluetooth 2>/dev/null || true
bluetoothctl power on           2>/dev/null || true
# NoInputNoOutput agent auto-accepts pairing with no PIN — correct for gamepads.
bluetoothctl agent NoInputNoOutput 2>/dev/null || true
bluetoothctl default-agent        2>/dev/null || true
bluetoothctl scan on              2>/dev/null || true

FOUND_MAC=""
DEADLINE=$((SECONDS + SCAN_SECS))

while [[ $SECONDS -lt $DEADLINE && -z "$FOUND_MAC" ]]; do
  while IFS= read -r line; do
    MAC=$(echo "$line" | awk '{print $2}')
    # Skip anything that doesn't look like a MAC address.
    [[ $MAC =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]] || continue
    NAME=$(echo "$line" | cut -d' ' -f3-)
    INFO=$(bluetoothctl info "$MAC" 2>/dev/null)
    # Match on the HID gamepad device class or well-known controller names.
    if echo "$INFO" | grep -qE "Icon: input-gamepad|UUID: Human Interface Device" || \
       echo "$NAME" | grep -qiE "Xbox|Wireless Controller|DualShock|DualSense|Pro Controller|Gamepad"; then
      FOUND_MAC="$MAC"
      break
    fi
  done < <(bluetoothctl devices 2>/dev/null)
  sleep 1
done

bluetoothctl scan off 2>/dev/null || true

if [[ -z "$FOUND_MAC" ]]; then
  echo "[bt-pair] no controller found after ${SCAN_SECS}s — make sure it's in pairing mode" >&2
  exit 1
fi

echo "[bt-pair] found $FOUND_MAC, pairing..."
bluetoothctl pair    "$FOUND_MAC" 2>/dev/null || true
bluetoothctl trust   "$FOUND_MAC"
bluetoothctl connect "$FOUND_MAC" 2>/dev/null || true
echo "[bt-pair] done: $FOUND_MAC"
