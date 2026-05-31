import React, { useState } from "react";
import { getSocket } from "../hooks/useSocket";
import { Player, Room } from "@haven/shared";
import { SkyBackground } from "../components/SkyBackground";

interface Props {
  defaultCode: string;
  onJoined: (room: Room, player: Player) => void;
  onError: (msg: string) => void;
}

export function EntryView({ defaultCode, onJoined, onError }: Props) {
  const [name, setName]       = useState("");
  const [code, setCode]       = useState(defaultCode.toUpperCase());
  const [loading, setLoading] = useState(false);

  function handleJoin() {
    if (!name.trim()) return onError("Enter your name.");
    if (!code.trim()) return onError("Enter a room code.");
    setLoading(true);
    getSocket().emit("room:join", code.trim().toUpperCase(), name.trim(), (room, player) => {
      setLoading(false);
      onJoined(room, player);
    });
  }

  return (
    <div style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 20px", fontFamily: "'Inter', sans-serif",
      overflow: "hidden", animation: "fadeIn 0.35s ease-out",
    }}>
      <SkyBackground />

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="nunito" style={{
            fontSize: 46, fontWeight: 900, color: "#EEF4FF",
            letterSpacing: -1, lineHeight: 1, marginBottom: 6,
            textShadow: "0 0 36px rgba(255,255,255,0.55)",
            animation: "glow 4s ease-in-out infinite",
          }}>haven</div>
          <div className="nunito" style={{ fontSize: 14, color: "var(--sky-light)", opacity: 0.8 }}>
            Join the game
          </div>
        </div>

        <div className="glass" style={{ borderRadius: 24, padding: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Name */}
            <div>
              <label className="nunito" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                YOUR NAME
              </label>
              <input
                style={{
                  width: "100%", padding: "13px 16px", fontSize: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 14, color: "var(--text)",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                  outline: "none", transition: "border-color 0.15s",
                }}
                placeholder="Enter your name"
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--sky)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = ""; }}
                autoFocus
              />
            </div>

            {/* Room code */}
            <div>
              <label className="nunito" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                ROOM CODE
              </label>
              <input
                style={{
                  width: "100%", padding: "13px 16px",
                  fontSize: 32, fontWeight: 900, letterSpacing: 10,
                  textAlign: "center", textTransform: "uppercase",
                  background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 14, color: "var(--sky-light)",
                  fontFamily: "'Nunito', sans-serif",
                  textShadow: "0 0 16px rgba(255,255,255,0.4)",
                  outline: "none", transition: "border-color 0.15s",
                }}
                placeholder="CODE"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--sky)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = ""; }}
              />
            </div>

            <button
              className="btn btn-sky"
              style={{ padding: "15px", fontSize: 17, marginTop: 4, opacity: loading ? 0.5 : 1 }}
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? "Connecting…" : "Join Game →"}
            </button>
          </div>
        </div>

        <p className="nunito" style={{
          textAlign: "center", color: "var(--text-dim)",
          marginTop: 20, fontSize: 13,
        }}>
          Scan the QR code on the TV to auto-fill the room code.
        </p>
      </div>
    </div>
  );
}
