import React, { useCallback, useRef } from "react";
import { RoomState, Player, GameMeta, PlayerAction } from "@haven/shared";
import { ConsoleHomeView } from "./ConsoleHomeView";
import { GameStage } from "./GameStage";
import { getSocket } from "../hooks/useSocket";
import { useLocalControllers } from "../hooks/useLocalControllers";
import { ControllerEvent, ControllerInput } from "../games/registry";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  games: GameMeta[];
}

export function TVView({ roomState, myPlayer, games }: Props) {
  const { room } = roomState;
  const socket = getSocket();

  // Bluetooth controllers register as players and stream input. We fan their
  // events out to whichever game component subscribes via controllerInput.
  const listenersRef = useRef(new Set<(e: ControllerEvent) => void>());
  const controllerCount = useLocalControllers(myPlayer.id, (e) =>
    listenersRef.current.forEach((l) => l(e)),
  );
  const controllerInput = useCallback<ControllerInput>((handler) => {
    listenersRef.current.add(handler);
    return () => listenersRef.current.delete(handler);
  }, []);

  if (room.phase === "lobby") {
    return (
      <ConsoleHomeView
        roomState={roomState}
        myPlayer={myPlayer}
        games={games}
        isHost={myPlayer.isHost}
        controllerInput={controllerInput}
        controllerCount={controllerCount}
        onLaunch={(gameId) => {
          socket.emit("game:select", gameId);
          socket.emit("game:start", room.players.length === 1);
        }}
      />
    );
  }

  const gameTitle = games.find((g) => g.id === room.gameId)?.name ?? room.gameId ?? "Game";

  return (
    <GameStage
      roomState={roomState}
      myPlayer={myPlayer}
      gameTitle={gameTitle}
      controllerInput={controllerInput}
      onAction={(a: PlayerAction, playerId?: string) =>
        socket.emit("player:action", a, playerId)
      }
      onRematch={() => socket.emit("game:rematch")}
      onBackToLobby={() => socket.emit("game:back-to-lobby")}
    />
  );
}
