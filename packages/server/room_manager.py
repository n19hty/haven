"""Room / lobby / game-session state — Python port of RoomManager.ts.

All state is in-process (same as the original Node server). Dicts use the
exact camelCase keys the client expects on the wire: ``avatarColor``,
``isHost``, ``isAI``, ``gameId``, ``gameState``, etc.
"""

from __future__ import annotations

import random
import string
from dataclasses import dataclass, field
from typing import Any, Optional

from game_loader import GamePlugin, get_game

# Mirrors AVATAR_COLORS in packages/shared/src/index.ts
AVATAR_COLORS = [
    "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
    "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
]

# Code alphabet excludes easily-confused letters (I, O) — matches the TS set.
_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"


@dataclass
class _InternalRoom:
    room: dict
    game_state: Any = None
    scores: dict[str, int] = field(default_factory=dict)
    winner: Optional[str] = None
    socket_to_player: dict[str, str] = field(default_factory=dict)
    ai_player_ids: set[str] = field(default_factory=set)


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
    player = {
        "id": _generate_player_id(),
        "name": player_name,
        "avatarColor": AVATAR_COLORS[0],
        "isHost": True,
    }
    room = {"code": code, "players": [player], "gameId": None, "phase": "lobby"}
    internal = _InternalRoom(
        room=room,
        scores={player["id"]: 0},
        socket_to_player={socket_id: player["id"]},
    )

    if vs_ai:
        ai_player = {
            "id": _generate_player_id(),
            "name": "Computer",
            "avatarColor": AVATAR_COLORS[1],
            "isHost": False,
            "isAI": True,
        }
        room["players"].append(ai_player)
        internal.scores[ai_player["id"]] = 0
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
    if internal.room["phase"] != "lobby":
        return {"error": "Game already in progress."}
    if internal.ai_player_ids:
        return {"error": "This room is vs computer only."}
    if len(internal.room["players"]) >= 8:
        return {"error": "Room is full."}

    player = {
        "id": _generate_player_id(),
        "name": player_name,
        "avatarColor": _pick_color(internal),
        "isHost": False,
    }
    internal.room["players"].append(player)
    internal.scores[player["id"]] = 0
    internal.socket_to_player[socket_id] = player["id"]
    _socket_to_room[socket_id] = code
    return {"room": internal.room, "player": player}


def leave_room(socket_id: str) -> Optional[str]:
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal:
        return None

    player_id = internal.socket_to_player.pop(socket_id, None)
    _socket_to_room.pop(socket_id, None)

    if player_id:
        internal.room["players"] = [
            p for p in internal.room["players"] if p["id"] != player_id
        ]

    if not [p for p in internal.room["players"] if not p.get("isAI")]:
        _rooms.pop(code, None)
        return None

    # Pass host to next human player
    if player_id and not any(p["isHost"] for p in internal.room["players"]):
        for p in internal.room["players"]:
            if not p.get("isAI"):
                p["isHost"] = True
                break

    return code


def _require_host(internal: _InternalRoom, socket_id: str) -> bool:
    player_id = internal.socket_to_player.get(socket_id)
    return any(p["id"] == player_id and p["isHost"] for p in internal.room["players"])


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
    internal.room["phase"] = "playing"
    internal.winner = None
    _apply_ai_moves(internal, game)  # in case AI moves first
    return code


def start_game(socket_id: str) -> Optional[str]:
    return _start_or_rematch(socket_id)


def rematch(socket_id: str) -> Optional[str]:
    return _start_or_rematch(socket_id)


def handle_player_action(socket_id: str, action: dict) -> Optional[str]:
    code = _socket_to_room.get(socket_id)
    if not code:
        return None
    internal = _rooms.get(code)
    if not internal or internal.room["phase"] != "playing" or not internal.room["gameId"]:
        return None
    player_id = internal.socket_to_player.get(socket_id)
    if not player_id:
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
