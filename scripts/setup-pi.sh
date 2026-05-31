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

# ── Node.js (build-time only — the client is a Vite/React app) ────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]]; then
  echo "[1/7] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "[1/7] Node.js $(node -v) already installed."
fi

# ── Python (runtime — the server is FastAPI + python-socketio) ────────────────
echo "[2/7] Installing Python 3 + venv..."
sudo apt-get install -y python3 python3-venv python3-pip

# ── Ensure enough swap so the client build doesn't get OOM-killed ─────────────
# `tsc && vite build` can exhaust RAM on 1–2 GB Pis; the build then dies with a
# bare "command failed" (no TS error), which is exactly what bit us. Make sure
# there's at least ~1 GB of swap before building.
ensure_swap() {
  local have_kb want_kb=1048576  # 1 GiB
  have_kb=$(free -k | awk '/^Swap:/ {print $2}')
  if [[ "${have_kb:-0}" -ge "$want_kb" ]]; then
    echo "  Swap OK ($((have_kb / 1024)) MiB)."
    return
  fi
  echo "  Low swap — adding a 1 GiB swapfile at /swapfile..."
  if [[ ! -f /swapfile ]]; then
    sudo fallocate -l 1G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile 2>/dev/null || true
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
}

# ── Node dependencies + client build ──────────────────────────────────────────
echo "[3/7] Installing client dependencies..."
cd "$HAVEN_DIR"
# The committed package-lock.json is generated on an x86_64 dev machine, so it
# pins x64-only optional deps (e.g. @rollup/rollup-linux-x64-gnu). On the Pi's
# arm64 CPU npm then fails to install the matching arm64 binary (npm/cli#4828).
# Resolve fresh from package.json instead — and ignore the lockfile so we don't
# leave it dirty (which would break the `git pull --ff-only` update path).
rm -rf node_modules packages/*/node_modules
npm install --no-package-lock

echo "[4/7] Building the client (this can take a few minutes on a Pi)..."
ensure_swap
# Cap V8's heap so the build fails gracefully instead of dragging the whole Pi
# into swap-death; combined with the swapfile above this keeps `vite build` happy.
NODE_OPTIONS="--max-old-space-size=512" npm run build

# ── Python server environment ─────────────────────────────────────────────────
# The Python server serves the built client itself, so there's no Node runtime
# and no Express static-patching step anymore.
echo "[5/7] Setting up the Python server environment..."
python3 -m venv "$HAVEN_DIR/packages/server/.venv"
"$HAVEN_DIR/packages/server/.venv/bin/pip" install --upgrade pip
"$HAVEN_DIR/packages/server/.venv/bin/pip" install -r "$HAVEN_DIR/packages/server/requirements.txt"

# ── systemd service ───────────────────────────────────────────────────────────
echo "[6/7] Installing systemd service..."
HAVEN_SERVICE_PATH="/etc/systemd/system/haven.service"
sudo tee "$HAVEN_SERVICE_PATH" > /dev/null <<SERVICE
[Unit]
Description=Haven Gaming Server
After=network.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$HAVEN_DIR/packages/server
ExecStart=$HAVEN_DIR/packages/server/.venv/bin/python app.py
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
echo "[7/7] Setting up kiosk mode autostart..."
AUTOSTART_DIR="/home/$PI_USER/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
# Generate the autostart entry pointing at *this* checkout, so it works
# regardless of the user/home or where Haven was cloned.
tee "$AUTOSTART_DIR/haven-kiosk.desktop" > /dev/null <<DESKTOP
[Desktop Entry]
Type=Application
Name=Haven Kiosk
Exec=$HAVEN_DIR/scripts/kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
DESKTOP
chmod +x "$HAVEN_DIR/scripts/kiosk.sh"
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
