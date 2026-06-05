"""Room manager — identity model, spoof guard, lobby lifecycle, zombie-turn.

These cover the Haven Mode change from 1-socket-1-player to 1-socket-N-players,
including the regressions for the existing phone path.
"""

import room_manager as rm

TV = "tv-sock"
PHONE = "phone-sock"
PLACE = lambda i: {"type": "place", "payload": {"index": i}}  # noqa: E731


# ── helpers ───────────────────────────────────────────────────────────────────
def _start_two_controller_game(vs_ai=False):
    """TV creates a room, a second controller registers on the same socket, and
    the host starts Tic-Tac-Toe. Returns (code, host, p2, order)."""
    res = rm.create_room(TV, "Alice", vs_ai)
    host = res["player"]
    p2 = rm.register_local_player(TV, "Bob")["player"]
    rm.select_game(TV, "tic-tac-toe")
    rm.start_game(TV)
    state = rm.get_room_state(res["room"]["code"])["gameState"]
    return res["room"]["code"], host, p2, state["order"]


# ── identity: one socket, many players ────────────────────────────────────────
def test_create_room_owns_one_player():
    res = rm.create_room(TV, "Alice", False)
    internal = rm._rooms[res["room"]["code"]]
    assert internal.socket_to_players[TV] == [res["player"]["id"]]
    assert res["player"]["isHost"] is True


def test_register_local_player_adds_to_same_socket():
    res = rm.create_room(TV, "Alice", False)
    p2 = rm.register_local_player(TV, "Bob")["player"]
    internal = rm._rooms[res["room"]["code"]]
    assert internal.socket_to_players[TV] == [res["player"]["id"], p2["id"]]
    assert len(internal.room["players"]) == 2
    assert p2["isHost"] is False
    assert p2["avatarColor"] != res["player"]["avatarColor"]  # distinct colors


def test_register_local_player_requires_a_room():
    assert rm.register_local_player("nobody", "Bob") == {"error": "Not in a room."}


def test_register_local_player_rejected_mid_game():
    code, *_ = _start_two_controller_game()
    assert rm.register_local_player(TV, "Carol") == {"error": "Game already in progress."}


def test_register_local_player_rejected_when_vs_ai():
    rm.create_room(TV, "Alice", True)
    assert rm.register_local_player(TV, "Bob") == {"error": "This room is vs computer only."}


def test_register_local_player_room_full():
    rm.create_room(TV, "Alice", False)
    for i in range(7):  # 1 host + 7 = 8 (MAX_PLAYERS)
        assert "player" in rm.register_local_player(TV, f"p{i}")
    assert rm.register_local_player(TV, "overflow") == {"error": "Room is full."}


# ── spoof guard ───────────────────────────────────────────────────────────────
def test_action_rejected_for_unowned_player():
    code, host, p2, order = _start_two_controller_game()
    # The phone socket owns nobody; it cannot act for the host.
    assert rm.handle_player_action(PHONE, host["id"], PLACE(0)) is None
    board = rm.get_room_state(code)["gameState"]["board"]
    assert board == [None] * 9  # nothing happened


def test_action_rejected_for_player_on_wrong_socket():
    code, host, p2, order = _start_two_controller_game()
    # Even a real, in-room player id is rejected from a socket that doesn't own it.
    rm.join_room(PHONE, code, "Mallory")  # but room is mid-game -> phone not added
    # host belongs to TV, not PHONE:
    assert rm.handle_player_action(PHONE, host["id"], PLACE(0)) is None


# ── backward-compatible phone path (regression) ───────────────────────────────
def test_phone_action_resolves_sole_player_without_id():
    rm.create_room(TV, "Alice", False)
    code = rm.get_room_code(TV)
    phone_player = rm.join_room(PHONE, code, "Bob")["player"]
    rm.select_game(TV, "tic-tac-toe")
    rm.start_game(TV)
    state = rm.get_room_state(code)["gameState"]
    x_id = state["order"][0]
    x_sock = TV if x_id != phone_player["id"] else PHONE
    # Emit with NO explicit player_id — server must resolve the socket's sole player.
    assert rm.handle_player_action(x_sock, None, PLACE(4)) == code
    assert rm.get_room_state(code)["gameState"]["board"][4] == x_id


# ── two controllers play a full game ──────────────────────────────────────────
def test_two_controllers_play_to_a_win():
    code, host, p2, order = _start_two_controller_game()
    x, o = order  # x moves first
    # X takes the top row 0,1,2; O answers in 3,4. X wins.
    moves = [(x, 0), (o, 3), (x, 1), (o, 4), (x, 2)]
    for pid, idx in moves:
        assert rm.handle_player_action(TV, pid, PLACE(idx)) == code
    st = rm.get_room_state(code)
    assert st["winner"] == x
    assert st["room"]["phase"] == "results"
    assert st["scores"][x] == 1


def test_out_of_turn_action_is_ignored_but_owned():
    code, host, p2, order = _start_two_controller_game()
    x, o = order
    # O tries to move first (owned, but not their turn) — board stays empty.
    rm.handle_player_action(TV, o, PLACE(0))
    assert rm.get_room_state(code)["gameState"]["board"] == [None] * 9


# ── leave / remove / host reassignment ────────────────────────────────────────
def test_remove_one_controller_keeps_the_others():
    res = rm.create_room(TV, "Alice", False)
    code = res["room"]["code"]
    p2 = rm.register_local_player(TV, "Bob")["player"]
    p3 = rm.register_local_player(TV, "Carol")["player"]
    assert rm.remove_player(TV, p2["id"]) == code
    internal = rm._rooms[code]
    assert internal.socket_to_players[TV] == [res["player"]["id"], p3["id"]]
    assert [p["id"] for p in internal.room["players"]] == [res["player"]["id"], p3["id"]]


def test_remove_player_rejects_unowned():
    res = rm.create_room(TV, "Alice", False)
    rm.join_room(PHONE, res["room"]["code"], "Bob")
    phone_pid = rm._rooms[res["room"]["code"]].socket_to_players[PHONE][0]
    # TV does not own the phone's player.
    assert rm.remove_player(TV, phone_pid) is None


def test_leave_room_drops_all_players_for_socket():
    res = rm.create_room(TV, "Alice", False)
    code = res["room"]["code"]
    rm.register_local_player(TV, "Bob")
    rm.join_room(PHONE, code, "Carol")  # a human on another socket keeps room alive
    assert rm.leave_room(TV) == code
    internal = rm._rooms[code]
    assert TV not in internal.socket_to_players
    assert [p["name"] for p in internal.room["players"]] == ["Carol"]


def test_room_torn_down_when_last_human_leaves():
    res = rm.create_room(TV, "Alice", False)
    code = res["room"]["code"]
    assert rm.leave_room(TV) is None
    assert code not in rm._rooms


def test_host_reassigned_when_host_leaves():
    res = rm.create_room(TV, "Alice", False)
    code = res["room"]["code"]
    phone_player = rm.join_room(PHONE, code, "Bob")["player"]
    rm.leave_room(TV)  # host gone
    internal = rm._rooms[code]
    survivor = internal.room["players"][0]
    assert survivor["id"] == phone_player["id"]
    assert survivor["isHost"] is True


# ── zombie-turn: a mid-game disconnect must not hang the game ──────────────────
def test_controller_disconnect_midgame_aborts_to_lobby():
    code, host, p2, order = _start_two_controller_game()
    assert rm.get_room_state(code)["room"]["phase"] == "playing"
    rm.remove_player(TV, p2["id"])  # a controller drops mid-match
    st = rm.get_room_state(code)
    assert st["room"]["phase"] == "lobby"
    assert st["gameState"] is None
    assert st["room"]["gameId"] is None


def test_host_only_can_start_game():
    res = rm.create_room(TV, "Alice", False)
    code = res["room"]["code"]
    rm.join_room(PHONE, code, "Bob")  # non-host socket
    rm.select_game(PHONE, "tic-tac-toe")   # ignored: not host
    assert rm._rooms[code].room["gameId"] is None
    assert rm.start_game(PHONE) is None     # ignored: not host
    assert rm._rooms[code].room["phase"] == "lobby"
