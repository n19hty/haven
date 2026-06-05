"""Tic-Tac-Toe plugin — pure game logic and turn order."""

import importlib.util
import pathlib

# Load the plugin module directly (same file the loader picks up).
_PLUGIN = pathlib.Path(__file__).resolve().parents[3] / "games" / "tic-tac-toe" / "server.py"
_spec = importlib.util.spec_from_file_location("ttt_under_test", _PLUGIN)
ttt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ttt)

PLACE = lambda i: {"type": "place", "payload": {"index": i}}  # noqa: E731


def test_initial_state_x_first():
    st = ttt.create_initial_state(["a", "b"])
    assert st["board"] == [None] * 9
    assert st["marks"] == {"a": "X", "b": "O"}
    assert st["order"] == ["a", "b"]
    assert st["turn"] == "a"
    assert st["line"] is None


def test_place_and_turn_handoff():
    st = ttt.create_initial_state(["a", "b"])
    st = ttt.handle_action(st, "a", PLACE(4))
    assert st["board"][4] == "a"
    assert st["turn"] == "b"
    assert ttt.get_current_player(st) == "b"


def test_out_of_turn_ignored():
    st = ttt.create_initial_state(["a", "b"])
    st = ttt.handle_action(st, "b", PLACE(0))  # not b's turn
    assert st["board"] == [None] * 9
    assert st["turn"] == "a"


def test_occupied_cell_ignored():
    st = ttt.create_initial_state(["a", "b"])
    st = ttt.handle_action(st, "a", PLACE(0))
    st = ttt.handle_action(st, "b", PLACE(0))  # occupied
    assert st["board"][0] == "a"
    assert st["turn"] == "b"  # turn did not pass


def test_out_of_range_index_ignored():
    st = ttt.create_initial_state(["a", "b"])
    for bad in (-1, 9, 99, "x", None):
        st = ttt.handle_action(st, "a", {"type": "place", "payload": {"index": bad}})
    assert st["board"] == [None] * 9


def test_win_detected_on_row():
    st = ttt.create_initial_state(["a", "b"])
    for pid, idx in [("a", 0), ("b", 3), ("a", 1), ("b", 4), ("a", 2)]:
        st = ttt.handle_action(st, pid, PLACE(idx))
    assert st["line"] == [0, 1, 2]
    assert ttt.get_winner(st) == "a"


def test_win_detected_on_diagonal():
    st = ttt.create_initial_state(["a", "b"])
    for pid, idx in [("a", 0), ("b", 1), ("a", 4), ("b", 2), ("a", 8)]:
        st = ttt.handle_action(st, pid, PLACE(idx))
    assert ttt.get_winner(st) == "a"


def test_draw():
    st = ttt.create_initial_state(["a", "b"])
    # a b a / a b b / b a a  -> full board, no line
    seq = [("a", 0), ("b", 1), ("a", 2),
           ("b", 4), ("a", 3), ("b", 5),
           ("a", 7), ("b", 6), ("a", 8)]
    for pid, idx in seq:
        st = ttt.handle_action(st, pid, PLACE(idx))
    assert ttt.get_winner(st) == "__draw__"


def test_ai_takes_winning_move():
    st = ttt.create_initial_state(["ai", "b"])
    st["board"][0] = "ai"
    st["board"][1] = "ai"  # ai can win at 2
    assert ttt.get_ai_move(st, "ai") == PLACE(2)


def test_ai_blocks_opponent():
    st = ttt.create_initial_state(["ai", "b"])
    st["board"][0] = "b"
    st["board"][1] = "b"  # must block at 2
    assert ttt.get_ai_move(st, "ai") == PLACE(2)


def test_ai_prefers_center_when_open():
    st = ttt.create_initial_state(["ai", "b"])
    st["board"][0] = "b"
    assert ttt.get_ai_move(st, "ai") == PLACE(4)
