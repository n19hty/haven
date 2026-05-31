#!/bin/bash
# Haven — Fresh Raspberry Pi Bootstrap
# Takes a clean Raspberry Pi OS install, pulls Haven from GitHub, and gets it
# running as a kiosk gaming console.
#
# Usage (on the Pi):
#   curl -fsSL https://raw.githubusercontent.com/<you>/haven/main/scripts/bootstrap-pi.sh | bash -s -- <repo-url>
# or after copying this file over:
#   bash bootstrap-pi.sh https://github.com/<you>/haven.git
#
# The repo URL can also be supplied via the HAVEN_REPO env var. Install location
# defaults to ~/haven and can be overridden with HAVEN_DIR.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_URL="${1:-${HAVEN_REPO:-}}"
BRANCH="${HAVEN_BRANCH:-main}"
TARGET_DIR="${HAVEN_DIR:-$HOME/haven}"

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: no repository URL provided."
  echo ""
  echo "  Usage: bash bootstrap-pi.sh <github-repo-url>"
  echo "  e.g.   bash bootstrap-pi.sh https://github.com/youruser/haven.git"
  echo ""
  echo "  (or set the HAVEN_REPO environment variable)"
  exit 1
fi

echo ""
echo "  ██╗  ██╗ █████╗ ██╗   ██╗███████╗███╗   ██╗"
echo "  ██║  ██║██╔══██╗██║   ██║██╔════╝████╗  ██║"
echo "  ███████║███████║██║   ██║█████╗  ██╔██╗ ██║"
echo "  ██╔══██║██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║"
echo "  ██║  ██║██║  ██║ ╚████╔╝ ███████╗██║ ╚████║"
echo "  ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝"
echo ""
echo "  Bootstrap — Raspberry Pi"
echo "  Repo:   $REPO_URL ($BRANCH)"
echo "  Target: $TARGET_DIR"
echo ""

# ── System packages ───────────────────────────────────────────────────────────
# git for cloning, curl for the Node setup script, plus the kiosk runtime deps
# (Chromium browser + unclutter to hide the cursor) that a headless image lacks.
echo "[1/4] Installing system packages (git, curl, chromium, unclutter)..."
sudo apt-get update
sudo apt-get install -y git curl ca-certificates unclutter

# Chromium package name differs across Raspberry Pi OS releases.
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
  sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium || \
    echo "  ! Could not auto-install Chromium — install it manually for kiosk mode."
fi

# ── Clone / update the repo ───────────────────────────────────────────────────
if [[ -d "$TARGET_DIR/.git" ]]; then
  echo "[2/4] Existing checkout found — updating..."
  git -C "$TARGET_DIR" fetch --all --prune
  git -C "$TARGET_DIR" checkout "$BRANCH"
  git -C "$TARGET_DIR" pull --ff-only origin "$BRANCH"
else
  echo "[2/4] Cloning Haven into $TARGET_DIR..."
  rm -rf "$TARGET_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$TARGET_DIR"
fi

# ── Hand off to the in-repo setup script ──────────────────────────────────────
# setup-pi.sh installs Node 20, runs npm install + build, installs the systemd
# service (haven.service) and the kiosk autostart entry. Keeping it as the single
# source of truth means bootstrap and manual setups stay in sync.
echo "[3/4] Running in-repo setup (Node, build, service, kiosk)..."
cd "$TARGET_DIR"
bash scripts/setup-pi.sh

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "[4/4] ✓ Haven bootstrapped from GitHub."
echo ""
echo "  Update later with:  cd $TARGET_DIR && git pull && npm run build && sudo systemctl restart haven"
echo "  Reboot to launch the console in kiosk mode:  sudo reboot"
echo ""
