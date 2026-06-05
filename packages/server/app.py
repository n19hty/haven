"""Haven server — Python port of packages/server/src/index.ts.

FastAPI handles the HTTP side (the /api/games endpoint and, in production,
serving the built client). python-socketio handles the realtime channel that
phones and the TV share. The two are composed into a single ASGI app that
uvicorn runs:

    uvicorn app:asgi --host 0.0.0.0 --port 3001

In development the client runs under Vite on :3000 and proxies /api and
/socket.io here, so the static mount is simply skipped when no build exists.
"""

from __future__ import annotations

import os
import socket
from pathlib import Path

import socketio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

import room_manager as rm
from game_loader import list_games, load_games

load_games()


def _lan_ip() -> str:
    """Best-effort LAN IP of this machine. Opens a UDP socket toward a public
    address (no packets are actually sent) so the OS picks the outbound
    interface — more reliable than gethostbyname on multi-homed hosts."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()

# ── Socket.IO ──────────────────────────────────────────────────────────────────
# socketio_path defaults to "socket.io", matching the client's io(..., {path:"/socket.io"}).
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# ── HTTP (FastAPI) ──────────────────────────────────────────────────────────────
api = FastAPI()


@api.get("/api/games")
async def get_games():
    return list_games()


@api.get("/api/server-info")
async def server_info():
    # The TV often loads the app via localhost, so it can't build a phone-reachable
    # join URL on its own. Report the LAN address the client should advertise.
    return {"host": _lan_ip(), "port": int(os.environ.get("PORT", "3001"))}


# Serve the built client in production. packages/client/dist is created by
# `vite build`; in dev it won't exist and we let Vite serve the UI instead.
_CLIENT_DIST = Path(__file__).resolve().parents[1] / "client" / "dist"
if _CLIENT_DIST.is_dir():
    # Mounted last so the /api route above still takes precedence. html=True
    # serves index.html at "/" — the SPA handles its own routing client-side.
    api.mount("/", StaticFiles(directory=str(_CLIENT_DIST), html=True), name="client")
else:
    print(f"[server] client build not found at {_CLIENT_DIST} — skipping static mount")

# Compose: Socket.IO intercepts /socket.io/*, everything else falls through to FastAPI.
asgi = socketio.ASGIApp(sio, other_asgi_app=api)


# ── Realtime handlers ────────────────────────────────────────────────────────────
async def broadcast(room_code: str) -> None:
    state = rm.get_room_state(room_code)
    if state:
        await sio.emit("room:state", state, room=room_code)


@sio.event
async def connect(sid, environ):
    print(f"[socket] connected: {sid}")


@sio.on("room:create")
async def room_create(sid, player_name, vs_ai):
    result = rm.create_room(sid, player_name, vs_ai)
    room, player = result["room"], result["player"]
    await sio.enter_room(sid, room["code"])
    await sio.emit("game:list", list_games(), to=sid)
    await broadcast(room["code"])
    # Returned tuple becomes the client's ack callback args: (room, player).
    return room, player


@sio.on("room:join")
async def room_join(sid, code, player_name):
    result = rm.join_room(sid, code, player_name)
    if "error" in result:
        await sio.emit("room:error", result["error"], to=sid)
        return None
    room, player = result["room"], result["player"]
    await sio.enter_room(sid, room["code"])
    await sio.emit("game:list", list_games(), to=sid)
    await broadcast(room["code"])
    return room, player


@sio.on("local:register")
async def local_register(sid, player_name):
    # A second+ local player (a Bluetooth controller) joining the TV's room.
    # The TV socket already owns the host; this adds another player to it.
    result = rm.register_local_player(sid, player_name)
    if "error" in result:
        await sio.emit("room:error", result["error"], to=sid)
        return None
    room, player = result["room"], result["player"]
    await broadcast(room["code"])
    return room, player


@sio.on("room:leave")
async def room_leave(sid):
    code = rm.leave_room(sid)
    if code:
        await broadcast(code)


@sio.on("player:leave")
async def player_leave(sid, player_id):
    # One local player (a controller) leaving, without dropping the whole socket.
    code = rm.remove_player(sid, player_id)
    if code:
        await broadcast(code)


@sio.on("game:select")
async def game_select(sid, game_id):
    code = rm.select_game(sid, game_id)
    if code:
        await broadcast(code)


@sio.on("game:start")
async def game_start(sid):
    code = rm.start_game(sid)
    if code:
        await broadcast(code)


@sio.on("game:rematch")
async def game_rematch(sid):
    code = rm.rematch(sid)
    if code:
        await broadcast(code)


@sio.on("game:back-to-lobby")
async def game_back_to_lobby(sid):
    code = rm.back_to_lobby(sid)
    if code:
        await broadcast(code)


@sio.on("player:action")
async def player_action(sid, action, player_id=None):
    # player_id is the acting local player. Phones (one player per socket) may
    # omit it; the TV passes the controller's id so the server can attribute the
    # action and reject ids the socket doesn't own.
    code = rm.handle_player_action(sid, player_id, action)
    if code:
        await broadcast(code)


@sio.event
async def disconnect(sid):
    print(f"[socket] disconnected: {sid}")
    code = rm.leave_room(sid)
    if code:
        await broadcast(code)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "3001"))
    uvicorn.run(asgi, host="0.0.0.0", port=port)
