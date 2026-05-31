import React from "react";
import { RoomState, Player, GameMeta, PlayerAction } from "@haven/shared";
import { Profile } from "../hooks/useProfiles";
import { ConsoleHomeView } from "./ConsoleHomeView";
import { GameStage } from "./GameStage";
import { getSocket } from "../hooks/useSocket";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  profile: Profile;
  games: GameMeta[];
}

export function TVView({ roomState, myPlayer, profile, games }: Props) {
  const { room } = roomState;
  const socket = getSocket();

  if (room.phase === "lobby") {
    return (
      <ConsoleHomeView
        roomState={roomState}
        myPlayer={myPlayer}
        profile={profile}
        games={games}
        isHost={myPlayer.isHost}
        onLaunch={(gameId) => {
          socket.emit("game:select", gameId);
          socket.emit("game:start");
        }}
      />
    );
  }

  return (
    <GameStage
      roomState={roomState}
      myPlayer={myPlayer}
      onAction={(a: PlayerAction) => socket.emit("player:action", a)}
      onRematch={() => socket.emit("game:rematch")}
      onBackToLobby={() => socket.emit("game:back-to-lobby")}
    />
  );
}
