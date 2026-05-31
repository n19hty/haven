# @haven/server (Python)

The Haven realtime server. FastAPI for HTTP (`/api/games` + serving the built
client) and [python-socketio](https://python-socketio.readthedocs.io/) for the
phone↔TV realtime channel.

## Run

```bash
cd packages/server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PORT=3001 python app.py            # or: uvicorn app:asgi --host 0.0.0.0 --port 3001
```

In development the client runs under Vite on `:3000` and proxies `/api` and
`/socket.io` to `:3001`, so you don't need a client build to work on the server.
In production `vite build` writes `packages/client/dist`, which this server
serves automatically at `/`.

## Files

- `app.py` — ASGI app: Socket.IO server, `/api/games`, static client serving, event handlers.
- `room_manager.py` — in-process room / lobby / game-session state.
- `game_loader.py` — discovers and loads game plugins from the repo `games/` dir.

## Writing a game plugin

Create `games/<your-game>/server.py` exposing these module-level callables
(or a `plugin` object/dict with the same attributes):

```python
meta = {
    "id": "tic-tac-toe",
    "name": "Tic-Tac-Toe",
    "description": "Classic 3-in-a-row.",
    "minPlayers": 2,
    "maxPlayers": 2,
    # "thumbnail": "..."  # optional
}

def create_initial_state(player_ids: list[str]):
    ...

def handle_action(state, player_id: str, action: dict):
    # action == {"type": str, "payload": Any}
    return state

def get_winner(state):
    # return a playerId, the sentinel "__draw__", or None if not over
    return None

# Optional — only needed for single-player (vs Computer) support:
def get_current_player(state) -> str | None: ...
def get_ai_move(state, player_id: str) -> dict | None: ...
```

State is whatever you return from `create_initial_state`; it is passed back to
every other function and serialized to clients as `gameState`. Keep it
JSON-serializable (dicts, lists, primitives).
