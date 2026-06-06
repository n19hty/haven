#!/bin/bash
# Haven — manually roll back to the previous deployed commit and rebuild.
#
#     ssh pi@haven 'cd ~/haven && bash scripts/haven-rollback.sh'
#
# Uses the commit recorded by haven-update.sh before the last successful update.

set -uo pipefail

HAVEN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HAVEN_DIR"
PREV_GOOD="$HAVEN_DIR/.haven-last-good.prev"

if [ ! -f "$PREV_GOOD" ]; then
  echo "[rollback] no previous deploy recorded (.haven-last-good.prev missing)." >&2
  exit 1
fi
TARGET="$(cat "$PREV_GOOD")"
echo "[rollback] resetting to $TARGET ..."

git reset --hard "$TARGET"
rm -rf node_modules packages/*/node_modules
npm install --no-package-lock --legacy-peer-deps
NODE_OPTIONS="--max-old-space-size=512" npm run build
sudo systemctl restart haven
pkill -x cage 2>/dev/null || true
echo "[rollback] ✓ back on $TARGET"
