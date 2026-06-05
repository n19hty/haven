"""Pytest setup for the Haven server.

Puts packages/server on the import path (so `import room_manager` works
regardless of pytest's import mode) and resets the in-process room state
between tests so each one starts from a clean slate.
"""

import pathlib
import sys

import pytest

# packages/server (the dir above tests/) on sys.path.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import room_manager as rm  # noqa: E402
from game_loader import _registry, load_games  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_state():
    """Clean room state before and after every test; ensure games are loaded."""
    rm._rooms.clear()
    rm._socket_to_room.clear()
    if not _registry:
        load_games()  # loads games/tic-tac-toe/server.py from the repo
    yield
    rm._rooms.clear()
    rm._socket_to_room.clear()
