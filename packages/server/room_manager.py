"""Room / lobby / game-session state — Python port of RoomManager.ts.

All state is in-process (same as the original Node server). Dicts use the
exact camelCase keys the client expects on the wire: ``avatarColor``,
``isHost``, ``isAI``, ``gameId``, ``gameState``, etc.

Identity model (Haven Mode):

    One socket can own MANY local players. Phones are one-player-per-socket as
    before, but the TV's single socket owns the host player AND every Bluetooth
    controller read by the browser's Gamepad API. So the mapping is

        socket_id -> [player_id, ...]          (socket_to_players)

    and every in-game action carries the acting player_id, validated against the
    set the socket owns (the spoof guard). A socket still belongs to one room.
"""

from __future__ import annotations

import random
import string
from dataclasses import dataclass, field
from typing import Any, Optional

from game_loader import GamePlugin, get_game

# Mirrors AVATAR_COLORS in packages/shared/src/index.ts and the COLORS list in
# packages/client/src/hooks/useProfiles.ts — keep all three in sync.
AVATAR_COLORS = [
    "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
    "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
]

# Code alphabet excludes easily-confused letters (I, O) — matches the TS set.
_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

MAX_PLAYERS = 8


@dataclass
class _InternalRoom:
    room: dict
    game_state: Any = None
    scores: dict[str, int] = field(default_factory=dict)
    winner: Optional[str] = None
    # socket_id -> list of player_ids that socket owns (1 for a phone, N for the
    # TV once controllers register).
    socket_to_players: dict[str, list[str]] = field(default_factory=dict)
    ai_player_ids: set[str] = field(default_factory=set)
    # The roster snapshotted when the current game started; used to abort a game
    # that loses a participant mid-match (so a controller disconnect can't hang
    # the turn).
    game_player_ids: list[str] = field(default_factory=list)


_rooms: dict[str, _InternalRoom] = {}
_socket_to_room: dict[str, str] = {}


def _generate_code() -> str:
    code = "".join(random.choice(_CODE_CHARS) for _ in range(4))
    return _generate_code() if code in _rooms else code


def _generate_player_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def _pick_color(internal: _InternalRoom) -> str:
    used = {p["avatarColor"] for p in internal.room["players"]}
    for c in AVATAR_COLORS:
        if c not in used:
            return c
    return AVATAR_COLORS[0]


def _joinable_error(internal: _InternalRoom) -> Optional[str]:
    """Shared gate for adding a player to an existing room (phone join OR a local
    controller registering). Returns an error string, or None if joinable."""
    if internal.room["phase"] != "lobby":
        return "Game already in progress."
    if internal.ai_player_ids:
        return "This room is vs computer only."
    if len(internal.room["players"]) >= MAX_PLAYERS:
        return "Room is full."
    return None


def _add_player(internal: _InternalRoom, name: str, is_host: bool = False) -> dict:
    """Create a player, append it to the room, and seed its score."""
    player = {
        "id": _generate_player_id(),
        "name": name,
        "avatarColor": _pick_color(internal),
        "isHost": is_host,
    }
    internal.room["players"].append(player)
    internal.scores[player["id"]] = 0
    return player


def _owns(internal: _InternalRoom, socket_id: str, player_id: str) -> bool:
    return player_id in internal.socket_to_players.get(socket_id, [])


def _abort_game_if_roster_broken(internal: _InternalRoom) -> None:
    """If the in-progress game lost one of its participants (a controller
    disconnected, the host's socket dropped), the game can't continue — reset to
    the lobby so the turn doesn't hang. Per-game graceful handling (e.g. declare
    the remaining player the winner) is a future enhancement; this is the
    platform-level anti-hang guarantee."""
    if internal.room["phase"] != "playing":
        return
    current_ids = {p["id"] for p in internal.room["players"]}
    if any(pid not in current_ids for pid in internal.game_player_ids):
        internal.room["phase"] = "lobby"
        internal.room["gameId"] = None
        internal.game_state = None
        internal.winner = None
        internal.game_player_ids = []


def _reassign_host(internal: _InternalRoom) -> None:
    """Ensure a human host exists; promote the first human if the host is gone."""
    if any(p["isHost"] for p in internal.room["players"]):
        return
    for p in internal.room["players"]:
        if not p.get("isAI"):
            p["isHost"] = True
            break


def _apply_ai_moves(internal: _InternalRoom, game: GamePlugin) -> None:
    while True:
        winner = game.get_winner(internal.game_state)
        if winner:
            internal.winner = winner
            internal.room["phase"] = "results"
            if winner != "__draw__":
                internal.scores[winner] = internal.scores.get(winner, 0) + 1
            return
        if not game.get_current_player or not game.get_ai_move:
            return
        current = game.get_current_player(internal.game_state)
        if not current or current not in internal.ai_player_ids:
            return
        ai_action = game.get_ai_move(internal.game_state, current)
        if not ai_action:
            return
        internal.game_state = game.handle_action(internal.game_state, current, ai_action)


def create_room(socket_id: str, player_name: str, vs_ai: bool) -> dict:
    code = _generate_code()
    room = {"code": code, "players": [], "gameId": None, "phase": "lobby"}
    internal = _InternalRoom(room=room)
    player = _add_player(internal, player_name, is_host=True)
    internal.socket_to_players[socket_id] = [player["id"]]

    if vs_ai:
        ai_player = _add_player(internal, "Computer")
        ai_player["isAI"] = True
        internal.ai_player_ids.add(ai_player["id"])

    _rooms[code] = internal
    _socket_to_room[socket_id] = code
    return {"room": room, "player": player}


def join_room(socket_id: str, code: str, player_name: str) -> dict:
    """Returns {"room", "player"} on success or {"error": str} on failure."""
    code = code.upper()
    internal = _rooms.get(code)
    if not internal:
        return {"error": "Room not found."}
    err = _joinable_error(internal)
    if err:
        return {"error": err}

    player = _add_player(internal, player_name)
    internal.socket_to_players.setdefault(socket_id, []).append(player["id"])
    _socket_to_room[socket_id] = code
    return {"room": internal.room, "player": player}


def register_local_player(socket_id: str, player_name: str) -> dict:
    """Add another local player (a Bluetooth controller) to the room the socket
    is already in — the TV-side equivalent of join_room, with no room code.
    Returns {"room", "player"} or {"error": str}."""
    code = _socket_to_room.get(socket_id)
    if not code:
        return {"error": "Not in a room."}
    internal = _rooms.get(code)
    if not internal:
        return {"error": "Room not found."}
    err = _joinable_error(internal)
    if err:
        return {"error": err}

    player = _add_player(internal, player_name)
    internal.socket_to_players.setdefault(socket_id, []).append(player["id"])
    return {"room": internal.room, "player": player}


def _remove_players(internal: _InternalRoom, code: str, player_ids: list[str]) -> Optional[str]:
    """Drop the given players from the room and run the post-removal bookkeeping
    (abort a broken game, reassign host, delete an empty room). Returns the room
    code if the room still exists, else None."""
    if player_ids:
        drop = set(player_ids)
        internal.room["players"] = [
            p for p in internal.room["players"] if p["id"] not in drop
        ]

    # No humans left → tear the room down.
    if not [p for p in internal.room["players"] if not p.get("isAI")]:
        _rooms.pop(code, None)
        return None

    _abort_game_if_roster_broken(internal)
    _reassign_host(internal)
    return code


def leave_room(socket_id: str) -> Optional[str]:
    """Remove every player owned by this socket (full disconnect / leave)."""
    code = _socket_to_room.pop(socket_id, None)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal:
        return None
    player_ids = internal.socket_to_players.pop(socket_id, [])
    return _remove_players(internal, code, player_ids)


def remove_player(socket_id: str, player_id: str) -> Optional[str]:
    """Remove a single local player (one controller leaving), leaving the
    socket's other players intact."""
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal or not _owns(internal, socket_id, player_id):
        return None
    owned = internal.socket_to_players.get(socket_id, [])
    if player_id in owned:
        owned.remove(player_id)
    if not owned:
        internal.socket_to_players.pop(socket_id, None)
    return _remove_players(internal, code, [player_id])


def _require_host(internal: _InternalRoom, socket_id: str) -> bool:
    """True if any player this socket owns is the host."""
    owned = set(internal.socket_to_players.get(socket_id, []))
    return any(p["id"] in owned and p["isHost"] for p in internal.room["players"])


def select_game(socket_id: str, game_id: str) -> Optional[str]:
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal or not _require_host(internal, socket_id):
        return None
    internal.room["gameId"] = game_id
    return code


def _start_or_rematch(socket_id: str) -> Optional[str]:
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal or not internal.room["gameId"]:
        return None
    if not _require_host(internal, socket_id):
        return None
    game = get_game(internal.room["gameId"])
    if not game:
        return None

    player_ids = [p["id"] for p in internal.room["players"]]
    internal.game_state = game.create_initial_state(player_ids)
    internal.game_player_ids = player_ids
    internal.room["phase"] = "playing"
    internal.winner = None
    _apply_ai_moves(internal, game)  # in case AI moves first
    return code


def start_game(socket_id: str) -> Optional[str]:
    return _start_or_rematch(socket_id)


def rematch(socket_id: str) -> Optional[str]:
    return _start_or_rematch(socket_id)


def handle_player_action(socket_id: str, player_id: Optional[str], action: dict) -> Optional[str]:
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal or internal.room["phase"] != "playing" or not internal.room["gameId"]:
        return None

    owned = internal.socket_to_players.get(socket_id, [])
    # Backward-compatible default: a one-player socket (a phone) may omit the
    # player_id. Otherwise the player_id MUST be one this socket owns — a socket
    # cannot act for a player it doesn't control (spoof guard).
    if not player_id and len(owned) == 1:
        player_id = owned[0]
    if not player_id or player_id not in owned:
        return None

    game = get_game(internal.room["gameId"])
    if not game:
        return None

    internal.game_state = game.handle_action(internal.game_state, player_id, action)
    _apply_ai_moves(internal, game)
    return code


def back_to_lobby(socket_id: str) -> Optional[str]:
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal or not _require_host(internal, socket_id):
        return None
    internal.room["phase"] = "lobby"
    internal.room["gameId"] = None
    internal.game_state = None
    internal.winner = None
    internal.game_player_ids = []
    return code


def get_room_state(code: str) -> Optional[dict]:
    internal = _rooms.get(code)
    if not internal:
        return None
    return {
        "room": internal.room,
        "gameState": internal.game_state,
        "scores": internal.scores,
        "winner": internal.winner,
    }


def get_room_code(socket_id: str) -> Optional[str]:
    return _socket_to_room.get(socket_id)
