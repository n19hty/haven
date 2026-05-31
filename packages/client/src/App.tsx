import React, { useEffect, useRef } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { useSocket, getSocket } from "./hooks/useSocket";
import { TVView } from "./views/TVView";
import { PhoneView } from "./views/PhoneView";
import { EntryView } from "./views/EntryView";
import { BootAnimation } from "./views/BootAnimation";
import { LoginScreen } from "./views/LoginScreen";
import { Profile } from "./hooks/useProfiles";
import { RoomState, Player } from "@haven/shared";

let activeProfile: Profile | null = null;

export function App() {
  const store       = useGameStore();
  const hosted      = useRef(false);
  const joinCode    = new URLSearchParams(window.location.search).get("join");
  const isPhoneMode = !!joinCode;

  useSocket({
    "room:state": (s: RoomState) => store.setRoomState(s),
    "room:error": (m: string)    => store.setError(m),
  });

  useEffect(() => {
    if (isPhoneMode) store.setMode("entry");
  }, []); // eslint-disable-line

  function handleLogin(profile: Profile) {
    if (hosted.current) return;
    hosted.current = true;
    activeProfile = profile;
    getSocket().emit("room:create", profile.name, false, (_r, player: Player) => {
      store.setMyPlayer(player);
      store.setMode("tv");
    });
  }

  // ── Phone ──────────────────────────────────────────────────────────────────
  if (isPhoneMode) {
    if (store.mode === "entry") {
      return (
        <>
          {store.error && <Err msg={store.error} onClose={() => store.setError(null)} />}
          <EntryView
            defaultCode={joinCode!}
            onJoined={(_r, player) => { store.setMyPlayer(player); store.setMode("phone"); }}
            onError={store.setError}
          />
        </>
      );
    }
    if (store.roomState && store.myPlayer) {
      return (
        <>
          {store.error && <Err msg={store.error} onClose={() => store.setError(null)} />}
          <PhoneView roomState={store.roomState} myPlayer={store.myPlayer} />
        </>
      );
    }
    return <Loading />;
  }

  // ── TV / console ───────────────────────────────────────────────────────────
  if (store.mode === "boot")  return <BootAnimation onComplete={() => store.setMode("login")} />;
  if (store.mode === "login") return <LoginScreen onLogin={handleLogin} />;
  if (!store.roomState || !store.myPlayer || !activeProfile) return <Loading />;

  return (
    <>
      {store.error && <Err msg={store.error} onClose={() => store.setError(null)} />}
      <TVView roomState={store.roomState} myPlayer={store.myPlayer} profile={activeProfile} />
    </>
  );
}

function Loading() {
  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "var(--sky-deep)",
    }}>
      <div className="nunito" style={{
        fontSize: 32, fontWeight: 900, color: "#EEF4FF",
        textShadow: "0 0 30px rgba(255,255,255,0.5)",
        animation: "glow 4s ease-in-out infinite",
      }}>
        haven
      </div>
    </div>
  );
}

function Err({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: "#1F0A0A", color: "#FCA5A5",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 100, padding: "10px 20px",
      fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
      zIndex: 1000, display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 20px rgba(239,68,68,0.2)",
      whiteSpace: "nowrap",
    }}>
      {msg}
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#FCA5A5", cursor: "pointer", fontSize: 16 }}
      >×</button>
    </div>
  );
}
