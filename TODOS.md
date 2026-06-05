# Haven — TODOs

Deferred work captured during reviews. Each item has enough context to pick up cold.

## Pi update path rebuilds the client every `git pull`
- **What:** `scripts/setup-pi.sh:62-74` runs `rm -rf node_modules && npm install
  --no-package-lock` and a 512MB-capped `vite build` on every update — minutes of
  CPU + swap thrash on a Pi.
- **Why:** Painful update DX. On gaming night you don't want a 5-minute rebuild to
  pick up a one-line change.
- **Fix direction:** Skip the rebuild when `package.json`/`package-lock` and
  `packages/client/src` are unchanged since the last build (hash or mtime check), or
  cache `node_modules`. Keep the arm64 fresh-resolve behavior (that fix exists for a
  reason — see commit 4ec8bfa).
- **Depends on / blocked by:** Nothing. Independent of Haven Mode.
- **Source:** /plan-eng-review 2026-06-05 (outside voice #6).

## Server broadcasts full RoomState per action (turn-based only)
- **What:** `broadcast()` emits the entire `RoomState` to the whole room on every
  action (`packages/server/app.py:56-59`).
- **Why:** Fine for turn-based games (Tic-Tac-Toe). A real-time game — the
  "Wall Never Stops" graffiti game already designed, or any action game — needs delta
  encoding, input buffering, and client-side prediction, not full-state JSON per event.
- **Fix direction:** Introduce per-game state-sync strategy: turn-based stays
  full-state; real-time games stream deltas. Don't build until a real-time game exists.
- **Depends on / blocked by:** A non-turn-based game actually being built.
- **Source:** /plan-eng-review 2026-06-05 (outside voice #7).
