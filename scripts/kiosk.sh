#!/bin/bash
# Haven — Kiosk launcher for Raspberry Pi
# Launches Chromium in full-screen kiosk mode

# Disable screen blanking and power saving
xset s off
xset -dpms
xset s noblank

# Hide the mouse cursor after 0.1 seconds of inactivity
unclutter -idle 0.1 -root &

# Wait for the Haven server to be ready (max 30s)
echo "Waiting for Haven server..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/games &>/dev/null; then
    echo "Server ready."
    break
  fi
  sleep 1
done

# The Chromium binary is named differently across Raspberry Pi OS releases.
if command -v chromium-browser &>/dev/null; then
  CHROMIUM=chromium-browser
elif command -v chromium &>/dev/null; then
  CHROMIUM=chromium
else
  echo "ERROR: Chromium not found (tried chromium-browser, chromium)." >&2
  exit 1
fi

# Launch Chromium in kiosk mode
"$CHROMIUM" \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --kiosk \
  --disable-features=TranslateUI \
  --check-for-update-interval=604800 \
  "http://localhost:3001"
