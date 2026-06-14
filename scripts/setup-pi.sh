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

# ── Python runtime + console-kiosk deps ───────────────────────────────────────
# cage = minimal Wayland kiosk compositor; bluez = Bluetooth controllers.
echo "[2/7] Installing Python 3 + console-kiosk deps (cage, chromium, bluez)..."
sudo apt-get install -y python3 python3-venv python3-pip cage bluez
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
  sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium || \
    echo "  ! Could not auto-install Chromium — install it manually."
fi

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
#
# --legacy-peer-deps: the Pi's Node 20 ships npm 10, which errors on loose peer
# deps (e.g. vitest's optional peers) that npm 9 resolves silently. The tree is
# healthy (vite dedupes cleanly); this just stops npm 10 from refusing to build.
rm -rf node_modules packages/*/node_modules
npm install --no-package-lock --legacy-peer-deps

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

# ── Console kiosk (no desktop) ─────────────────────────────────────────────────
echo "[7/7] Configuring console kiosk (boots straight into Haven, no desktop)..."
chmod +x "$HAVEN_DIR/scripts/kiosk.sh" \
         "$HAVEN_DIR/scripts/haven-update.sh" \
         "$HAVEN_DIR/scripts/haven-rollback.sh"

# Boot to a plain console — no display manager, no desktop. (Reversible:
# `sudo systemctl set-default graphical.target` brings a desktop back.)
sudo systemctl set-default multi-user.target

# Autologin the Pi user on tty1 so cage gets a seat (DRM + input) and a user
# session (PipeWire audio) — the pieces a bare multi-user boot otherwise lacks.
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf > /dev/null <<AUTOLOGIN
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $PI_USER --noclear %I \$TERM
AUTOLOGIN

# Keep the user's systemd/PipeWire instance alive without a desktop.
sudo loginctl enable-linger "$PI_USER" || true

# Launch the kiosk from the tty1 login shell ONLY — SSH sessions stay a normal
# shell so you can update/administer the box.
PROFILE="/home/$PI_USER/.bash_profile"
MARKER="# >>> haven kiosk >>>"
if ! grep -qF "$MARKER" "$PROFILE" 2>/dev/null; then
  cat >> "$PROFILE" <<PROFILE_BLOCK

$MARKER
[ -f "\$HOME/.profile" ] && . "\$HOME/.profile"
if [ "\$(tty)" = "/dev/tty1" ] && [ -z "\${WAYLAND_DISPLAY:-}" ]; then
  exec "$HAVEN_DIR/scripts/kiosk.sh"
fi
# <<< haven kiosk <<<
PROFILE_BLOCK
  chown "$PI_USER":"$PI_USER" "$PROFILE" 2>/dev/null || true
fi

# Drop the old desktop-autostart kiosk entry if a previous setup left one.
rm -f "/home/$PI_USER/.config/autostart/haven-kiosk.desktop" 2>/dev/null || true

# ── HDMI / display config for TV kiosk ────────────────────────────────────────
# Without these, a 4K TV causes Chromium to render at 3840×2160 CSS pixels (UI
# appears tiny) and TVs often overscan / crop the image. Forcing 1080p 60Hz is
# the safest default: all modern TVs accept it and the TV's upscaler fills the
# screen. Override hdmi_mode if you prefer 4K (mode 97 = 4K@30, 107 = 4K@60).
BOOT_CONFIG="/boot/firmware/config.txt"
if [ ! -f "$BOOT_CONFIG" ]; then
  BOOT_CONFIG="/boot/config.txt"  # fallback for older Pi OS layouts
fi
if [ -f "$BOOT_CONFIG" ]; then
  echo "  Configuring HDMI for TV kiosk (disable overscan, force 1080p)..."
  grep -q 'disable_overscan' "$BOOT_CONFIG" || \
    echo 'disable_overscan=1' | sudo tee -a "$BOOT_CONFIG" >/dev/null
  grep -q 'hdmi_group' "$BOOT_CONFIG" || \
    printf '\n# Haven: force 1080p 60Hz — prevents tiny UI on 4K TVs\nhdmi_group=1\nhdmi_mode=16\n' \
    | sudo tee -a "$BOOT_CONFIG" >/dev/null
  echo "  HDMI config written to $BOOT_CONFIG (takes effect on next reboot)."
fi

sudo systemctl daemon-reload
echo "  Console kiosk configured."

echo ""
echo "✓ Haven setup complete!"
echo ""
echo "  Server:   http://$(hostname -I | awk '{print $1}'):3001"
echo "  Status:   systemctl status haven"
echo "  Logs:     journalctl -u haven -f"
echo "  Update:   bash scripts/haven-update.sh    (pull + rebuild + auto-rollback)"
echo "  Rollback: bash scripts/haven-rollback.sh"
echo ""
echo "  Reboot to launch the console: sudo reboot"
echo ""
