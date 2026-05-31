"""Tic-Tac-Toe — a Haven game plugin.

State shape (JSON-serializable, pushed to clients as ``gameState``):

    {
        "board":  [playerId | None] * 9,   # row-major, indices 0..8
        "marks":  {playerId: "X" | "O"},   # who is X / O
        "order":  [playerId_X, playerId_O],
        "turn":   playerId,                # whose move it is
        "line":   [i, j, k] | None,        # winning line, set on a win
    }

An action is ``{"type": "place", "payload": {"index": 0..8}}``.
"""

# The eight winning lines (rows, columns, diagonals).
LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),   # rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),   # columns
    (0, 4, 8), (2, 4, 6),              # diagonals
]

meta = {
    "id": "tic-tac-toe",
    "name": "Tic-Tac-Toe",
    "description": "Classic 3-in-a-row. First to a line wins.",
    "minPlayers": 2,
    "maxPlayers": 2,
    "thumbnail": "❌⭕",
}


def create_initial_state(player_ids):
    # Only the first two players take part; X always moves first.
    order = list(player_ids[:2])
    while len(order) < 2:  # defensive: pad if somehow short-handed
        order.append(order[-1] if order else "p?")
    return {
        "board": [None] * 9,
        "marks": {order[0]: "X", order[1]: "O"},
        "order": order,
        "turn": order[0],
        "line": None,
    }


def _winning_line(board, player_id):
    for line in LINES:
        if all(board[i] == player_id for i in line):
            return list(line)
    return None


def handle_action(state, player_id, action):
    if action.get("type") != "place":
        return state
    if state["turn"] != player_id or state["line"] is not None:
        return state

    idx = (action.get("payload") or {}).get("index")
    if not isinstance(idx, int) or not (0 <= idx < 9) or state["board"][idx] is not None:
        return state

    state["board"][idx] = player_id

    line = _winning_line(state["board"], player_id)
    if line is not None:
        state["line"] = line  # get_winner reports the result; turn stays put
    else:
        # Hand the turn to the other player.
        other = [p for p in state["order"] if p != player_id]
        state["turn"] = other[0] if other else player_id
    return state


def get_winner(state):
    # A stored winning line means that player won.
    if state["line"] is not None:
        return state["board"][state["line"][0]]
    if all(cell is not None for cell in state["board"]):
        return "__draw__"
    return None


def get_current_player(state):
    return state["turn"]


def get_ai_move(state, player_id):
    """Heuristic AI: win > block > center > corner > any. Good enough to be a
    fair opponent and effectively unbeatable when it moves optimally."""
    board = state["board"]
    me = player_id
    opponent = next((p for p in state["order"] if p != me), None)
    empty = [i for i in range(9) if board[i] is None]
    if not empty:
        return None

    def completes(pid):
        for line in LINES:
            cells = [board[i] for i in line]
            if cells.count(pid) == 2 and cells.count(None) == 1:
                return line[cells.index(None)]
        return None

    win = completes(me)
    if win is not None:
        return {"type": "place", "payload": {"index": win}}

    block = completes(opponent)
    if block is not None:
        return {"type": "place", "payload": {"index": block}}

    if 4 in empty:
        return {"type": "place", "payload": {"index": 4}}

    for corner in (0, 2, 6, 8):
        if corner in empty:
            return {"type": "place", "payload": {"index": corner}}

    return {"type": "place", "payload": {"index": empty[0]}}
