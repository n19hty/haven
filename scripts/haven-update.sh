#!/bin/bash
# Haven — pull + rebuild + restart, with automatic rollback on failure.
#
# Run this over SSH whenever you've pushed changes you want the device to pick
# up (nothing auto-updates on its own):
#
#     ssh pi@haven 'cd ~/haven && bash scripts/haven-update.sh'
#
# It records the running commit, pulls the latest, rebuilds, restarts the server
# and reloads the kiosk, then health-checks the server. If the new build doesn't
# come back healthy, it rolls back to the previous commit and rebuilds — so the
# console keeps running the last good version even if you push something broken.

set -uo pipefail

HAVEN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HAVEN_DIR"
PORT="${PORT:-3001}"
BRANCH="${HAVEN_BRANCH:-main}"
LAST_GOOD="$HAVEN_DIR/.haven-last-good"
PREV_GOOD="$HAVEN_DIR/.haven-last-good.prev"

_commit() { git rev-parse HEAD; }

_health() {
  # Server answers on the port within 30s.
  for _ in $(seq 1 30); do
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && { exec 3>&- 3<&- 2>/dev/null; return 0; }
    sleep 1
  done
  return 1
}

_build_restart() {
  echo "  installing deps + building..."
  rm -rf node_modules packages/*/node_modules
  npm install --no-package-lock --legacy-peer-deps || return 1
  NODE_OPTIONS="--max-old-space-size=512" npm run build || return 1
  # Server picks up new Python + serves the new dist.
  sudo systemctl restart haven || return 1
  # Reload the kiosk so Chromium shows the new client (kiosk.sh relaunches it).
  pkill -x cage 2>/dev/null || true
  _health
}

PREV="$(_commit)"
echo "[update] running commit: $PREV"

git fetch origin "$BRANCH" || { echo "[update] git fetch failed."; exit 1; }
git checkout "$BRANCH" 2>/dev/null || true
if ! git merge --ff-only "origin/$BRANCH"; then
  echo "[update] cannot fast-forward (local changes on the device?). Aborting." >&2
  exit 1
fi

NEW="$(_commit)"
if [ "$NEW" = "$PREV" ]; then
  echo "[update] already at the latest commit; rebuilding anyway."
fi

echo "[update] building $NEW ..."
if _build_restart; then
  echo "$PREV" > "$PREV_GOOD"
  echo "$NEW"  > "$LAST_GOOD"
  echo "[update] ✓ healthy on $NEW"
else
  echo "[update] ✗ $NEW did not come up healthy — rolling back to $PREV" >&2
  git reset --hard "$PREV"
  if _build_restart; then
    echo "[update] ✓ rolled back to $PREV (healthy). Fix the code and push, then re-run." >&2
  else
    echo "[update] !! rollback to $PREV is ALSO unhealthy — needs manual attention." >&2
  fi
  exit 1
fi
