import React from "react";
import { RoomState, Player } from "@haven/shared";
import { Profile } from "../hooks/useProfiles";
import { ConsoleHomeView } from "./ConsoleHomeView";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  profile: Profile;
}

export function TVView({ roomState, myPlayer, profile }: Props) {
  return <ConsoleHomeView roomState={roomState} myPlayer={myPlayer} profile={profile} />;
}
