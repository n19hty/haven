"""Game plugin loader — Python port of the original GameLoader.ts.

Games live in the repo-root ``games/`` directory, one subfolder per game.
Each game ships a ``server.py`` module that exposes a module-level ``plugin``
object (or the callables directly). A plugin is anything with:

    meta                : dict   — GameMeta (id, name, description,
                                    minPlayers, maxPlayers, thumbnail?)
    create_initial_state(player_ids: list[str]) -> Any
    handle_action(state, player_id: str, action: dict) -> Any   # action = {type, payload?}
    get_winner(state) -> str | None      # playerId, "__draw__", or None
    get_current_player(state) -> str | None      # optional (AI support)
    get_ai_move(state, player_id: str) -> dict | None   # optional (AI support)

The loader is intentionally forgiving: a game that fails to import is logged
and skipped rather than taking down the whole server.
"""

from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

# games/ sits at the repo root, two levels up from this file
# (packages/server/game_loader.py -> repo root).
GAMES_DIR = Path(__file__).resolve().parents[2] / "games"


@dataclass
class GamePlugin:
    """Normalised view of a game module, mirroring the TS GamePlugin interface."""

    meta: dict
    create_initial_state: Callable[[list[str]], Any]
    handle_action: Callable[[Any, str, dict], Any]
    get_winner: Callable[[Any], Optional[str]]
    get_current_player: Optional[Callable[[Any], Optional[str]]] = None
    get_ai_move: Optional[Callable[[Any, str], Optional[dict]]] = None


_registry: dict[str, GamePlugin] = {}


def _coerce_plugin(module: Any) -> GamePlugin:
    """Accept either a module exposing a ``plugin`` object or one whose
    top-level attributes are the plugin functions."""
    src = getattr(module, "plugin", module)

    def attr(name: str):
        # support both attribute access (objects/modules) and dict-style plugins
        if isinstance(src, dict):
            return src.get(name)
        return getattr(src, name, None)

    return GamePlugin(
        meta=attr("meta"),
        create_initial_state=attr("create_initial_state"),
        handle_action=attr("handle_action"),
        get_winner=attr("get_winner"),
        get_current_player=attr("get_current_player"),
        get_ai_move=attr("get_ai_move"),
    )


def load_games() -> None:
    if not GAMES_DIR.exists():
        return

    for entry in sorted(GAMES_DIR.iterdir()):
        if not entry.is_dir():
            continue
        plugin_file = entry / "server.py"
        if not plugin_file.exists():
            continue

        mod_name = f"haven_game_{entry.name}"
        try:
            spec = importlib.util.spec_from_file_location(mod_name, plugin_file)
            if spec is None or spec.loader is None:
                continue
            module = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = module
            spec.loader.exec_module(module)

            plugin = _coerce_plugin(module)
            if not plugin.meta or "id" not in plugin.meta:
                print(f"[games] skipped {entry.name}: missing meta.id")
                continue
            _registry[plugin.meta["id"]] = plugin
            print(f"[games] loaded: {plugin.meta.get('name', plugin.meta['id'])}")
        except Exception as e:  # noqa: BLE001 — never let one game break startup
            print(f"[games] failed to load {entry.name}: {e}")


def get_game(game_id: str) -> Optional[GamePlugin]:
    return _registry.get(game_id)


def list_games() -> list[dict]:
    return [g.meta for g in _registry.values()]
