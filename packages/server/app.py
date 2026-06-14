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

import asyncio
import os
import socket
import subprocess
import time
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


# ── Device admin (status / update / rollback) ──────────────────────────────────
# Repo root is two levels up from this file; scripts/ lives there.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS = _REPO_ROOT / "scripts"


def _git(*args: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(_REPO_ROOT), *args], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return None


def _run_detached(script: str) -> bool:
    """Launch a maintenance script in its OWN systemd scope so it survives the
    haven.service restart it triggers (a plain child would be killed when the
    server stops). Requires passwordless sudo for systemd-run (default on Pi OS)."""
    path = _SCRIPTS / script
    if not path.exists():
        return False
    unit = f"haven-{script.replace('.sh', '')}"
    try:
        subprocess.Popen(
            ["sudo", "-n", "systemd-run", "--collect", "--unit", unit,
             "/bin/bash", str(path)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[admin] failed to launch {script}: {e}")
        return False


@api.get("/api/status")
async def status():
    return {
        "commit": _git("rev-parse", "--short", "HEAD"),
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        "message": _git("log", "-1", "--pretty=%s"),
        "host": _lan_ip(),
        "port": int(os.environ.get("PORT", "3001")),
    }


@api.post("/api/update")
async def update():
    # Pull main, rebuild, restart, health-check, auto-rollback on failure.
    return {"started": _run_detached("haven-update.sh")}


@api.post("/api/rollback")
async def rollback():
    return {"started": _run_detached("haven-rollback.sh")}


# Cache the last fetch result so rapid polls don't hammer git.
_update_cache: dict = {}
_UPDATE_CACHE_TTL = 1800  # 30 minutes


@api.get("/api/check-update")
async def check_update():
    """Fetch origin/main and report whether a newer commit is available.

    git fetch is a blocking network call so we run it in a thread to avoid
    stalling the event loop. Results are cached for 30 minutes."""
    now = time.time()
    if _update_cache.get("ts", 0) + _UPDATE_CACHE_TTL > now:
        return _update_cache["result"]

    def _do_check() -> dict:
        try:
            subprocess.run(
                ["git", "-C", str(_REPO_ROOT), "fetch", "origin", "main", "--quiet"],
                timeout=15, stderr=subprocess.DEVNULL, check=False,
            )
        except Exception:
            pass  # no network — return cached or upToDate
        local  = _git("rev-parse", "HEAD")
        remote = _git("rev-parse", "origin/main")
        msg    = _git("log", "-1", "--pretty=%s", "origin/main")
        if local and remote:
            return {
                "upToDate":      local == remote,
                "currentCommit": local[:7],
                "latestCommit":  remote[:7],
                "latestMessage": msg,
            }
        return {"upToDate": True, "error": "git unavailable"}

    result = await asyncio.to_thread(_do_check)
    _update_cache["ts"]     = time.time()
    _update_cache["result"] = result
    return result


_STATUS_FILE = _REPO_ROOT / ".haven-update-status"


@api.get("/api/update-status")
async def update_status():
    """Read the current update stage written by haven-update.sh."""
    import json
    try:
        if _STATUS_FILE.exists():
            return json.loads(_STATUS_FILE.read_text())
    except Exception:
        pass
    return {"stage": "idle", "progress": 0}


@api.post("/api/bt/scan")
async def bt_scan():
    """Start a 30-second Bluetooth scan window to pair a new controller."""
    return {"started": _run_detached("haven-bt-pair.sh")}


@api.get("/api/bt/devices")
async def bt_devices():
    """List Bluetooth devices known to this machine."""
    try:
        out = subprocess.check_output(
            ["bluetoothctl", "devices"], text=True, stderr=subprocess.DEVNULL, timeout=5
        )
        return {"devices": [ln.strip() for ln in out.splitlines() if ln.strip()]}
    except Exception:
        return {"devices": []}


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
