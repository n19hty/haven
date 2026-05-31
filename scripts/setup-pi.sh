#!/bin/bash
# Haven — Raspberry Pi Setup Script
# Tested on Raspberry Pi OS (64-bit) / Raspberry Pi 4 and 5
# Run from inside an existing checkout as: bash scripts/setup-pi.sh
# (For a fresh Pi with nothing installed, use scripts/bootstrap-pi.sh instead.)

set -e

HAVEN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PI_USER="${SUDO_USER:-$(whoami)}"

echo ""
echo "  ██╗  ██╗ █████╗ ██╗   ██╗███████╗███╗   ██╗"
echo "  ██║  ██║██╔══██╗██║   ██║██╔════╝████╗  ██║"
echo "  ███████║███████║██║   ██║█████╗  ██╔██╗ ██║"
echo "  ██╔══██║██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║"
echo "  ██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║"
echo "  ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝"
echo ""
echo "  Gaming OS Setup — Raspberry Pi"
echo ""

# ── Node.js ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]]; then
  echo "[1/5] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "[1/5] Node.js $(node -v) already installed."
fi

# ── Dependencies ─────────────────────────────────────────────────────────────
echo "[2/5] Installing dependencies..."
cd "$HAVEN_DIR"
npm install

# ── Build ─────────────────────────────────────────────────────────────────────
echo "[3/5] Building Haven..."
npm run build

# ── Serve static files from Express ──────────────────────────────────────────
# Patch server to serve the built client
echo "[3/5] Patching server to serve client build..."
SERVER_FILE="$HAVEN_DIR/packages/server/src/index.ts"
if ! grep -q "express.static" "$SERVER_FILE"; then
  # Add path import and static serve after cors
  sed -i 's/import cors from "cors";/import cors from "cors";\nimport path from "path";/' "$SERVER_FILE"
  sed -i 's/app.use(express.json());/app.use(express.json());\napp.use(express.static(path.join(__dirname, "..\/..\/client\/dist")));/' "$SERVER_FILE"
  cd "$HAVEN_DIR" && npm run build
fi

# ── systemd service ───────────────────────────────────────────────────────────
echo "[4/5] Installing systemd service..."
HAVEN_SERVICE_PATH="/etc/systemd/system/haven.service"
sudo tee "$HAVEN_SERVICE_PATH" > /dev/null <<SERVICE
[Unit]
Description=Haven Gaming Server
After=network.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$HAVEN_DIR
ExecStart=/usr/bin/node packages/server/dist/server/src/index.js
Restart=always
RestartSec=3
Environment=PORT=3001
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable haven
sudo systemctl restart haven
echo "  Server service installed and started."

# ── Kiosk autostart ───────────────────────────────────────────────────────────
echo "[5/5] Setting up kiosk mode autostart..."
AUTOSTART_DIR="/home/$PI_USER/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
cp "$HAVEN_DIR/scripts/haven-kiosk.desktop" "$AUTOSTART_DIR/"
echo "  Kiosk autostart installed."

echo ""
echo "✓ Haven setup complete!"
echo ""
echo "  Server:  http://$(hostname -I | awk '{print $1}'):3001"
echo "  Status:  systemctl status haven"
echo "  Logs:    journalctl -u haven -f"
echo ""
echo "  Reboot to launch in kiosk mode: sudo reboot"
echo ""
