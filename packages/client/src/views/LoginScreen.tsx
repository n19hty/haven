import React, { useState } from "react";
import { useProfiles, Profile, GUEST_PROFILE } from "../hooks/useProfiles";
import { Character, CharacterConfig, DEFAULT_CHARACTER } from "../components/Character";
import { CharacterCreator } from "../components/CharacterCreator";
import { SkyBackground } from "../components/SkyBackground";
import { useGamepads } from "../hooks/useGamepads";

interface Props {
  onLogin: (profile: Profile) => void;
}

type Screen = "pick" | "create";

export function LoginScreen({ onLogin }: Props) {
  const { profiles, addProfile } = useProfiles();
  const [screen, setScreen]  = useState<Screen>("pick");
  const [selected, setSelected] = useState<string>(profiles[0]?.id ?? "guest");
  const [newName, setNewName]   = useState("");
  const [newChar, setNewChar]   = useState<CharacterConfig>(DEFAULT_CHARACTER);

  const allIds = [...profiles.map((p) => p.id), "guest"];

  function handleContinue() {
    if (selected === "guest") { onLogin(GUEST_PROFILE); return; }
    const p = profiles.find((x) => x.id === selected);
    if (p) onLogin(p);
  }

  function handleCreate() {
    if (!newName.trim()) return;
    const p = addProfile(newName.trim(), newChar);
    onLogin(p);
  }

  useGamepads((e) => {
    if (screen === "create") {
      if (e.control === "back") { setScreen("pick"); setNewName(""); setNewChar(DEFAULT_CHARACTER); }
      return;
    }
    if (e.control === "confirm") { handleContinue(); return; }
    if (e.control === "left" || e.control === "right") {
      const idx  = Math.max(0, allIds.indexOf(selected));
      const next = e.control === "left"
        ? Math.max(0, idx - 1)
        : Math.min(allIds.length - 1, idx + 1);
      setSelected(allIds[next]);
    }
  });

  // ── CREATE screen ──────────────────────────────────────────────────────────
  if (screen === "create") {
    return (
      <div style={{
        minHeight: "100dvh", position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "32px 20px 40px",
        fontFamily: "'Inter', sans-serif",
        animation: "fadeIn 0.3s ease-out",
        overflowY: "auto",
      }}>
        <SkyBackground />
        <button
          onClick={() => { setScreen("pick"); setNewName(""); setNewChar(DEFAULT_CHARACTER); }}
          style={{
            alignSelf: "flex-start", marginBottom: 28, position: "relative", zIndex: 1,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-mid)", fontSize: 14,
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "'Nunito', sans-serif",
          }}
        >← Back</button>

        <h2 className="nunito" style={{
          fontSize: 28, fontWeight: 900, marginBottom: 6,
          position: "relative", zIndex: 1, color: "var(--text)", textAlign: "center",
        }}>
          Create Your Character
        </h2>
        <p style={{
          color: "var(--text-mid)", fontSize: 14, marginBottom: 28,
          textAlign: "center", position: "relative", zIndex: 1,
        }}>
          Choose how you'll appear in Haven.
        </p>

        <div className="glass" style={{
          width: "100%", maxWidth: 600, padding: 28,
          position: "relative", zIndex: 1,
        }}>
          <CharacterCreator config={newChar} onChange={setNewChar} />

          <div style={{
            borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 20,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <label className="mono" style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 2 }}>
              DISPLAY NAME
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 16))}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Your name"
              maxLength={16}
              autoFocus
              style={{
                width: "100%", padding: "12px 16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 12, color: "var(--text)",
                fontSize: 16, fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--sky)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = ""; }}
            />
            <button
              className="btn btn-sky"
              disabled={!newName.trim()}
              onClick={handleCreate}
              style={{ padding: "14px", fontSize: 16, marginTop: 4, opacity: newName.trim() ? 1 : 0.45 }}
            >
              Create &amp; Play ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PICK screen ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
      animation: "fadeIn 0.4s ease-out",
    }}>
      <SkyBackground />

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="nunito" style={{
          fontSize: 40, fontWeight: 900, color: "#EEF4FF",
          letterSpacing: -1,
          textShadow: "0 0 36px rgba(255,255,255,0.55)",
          animation: "glow 4s ease-in-out infinite",
        }}>haven</div>
        <div className="mono" style={{ fontSize: 9, color: "var(--sky-light)", letterSpacing: 3, marginTop: 4, opacity: 0.7 }}>
          WHO'S PLAYING?
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: "flex", gap: 16, flexWrap: "wrap",
        justifyContent: "center", maxWidth: 680,
        position: "relative", zIndex: 1,
      }}>
        {/* Saved profiles */}
        {profiles.map((p, i) => {
          const isSel = p.id === selected;
          return (
            <ProfileCard
              key={p.id}
              delay={i * 0.07}
              isSelected={isSel}
              color={p.color}
              label={p.name}
              onClick={() => setSelected(p.id)}
              onDoubleClick={() => { setSelected(p.id); onLogin(p); }}
            >
              <Character config={p.character} size={90} />
            </ProfileCard>
          );
        })}

        {/* Guest */}
        {(() => {
          const isSel = selected === "guest";
          return (
            <ProfileCard
              delay={profiles.length * 0.07}
              isSelected={isSel}
              color="#6B7280"
              label="Guest"
              dashed
              onClick={() => setSelected("guest")}
              onDoubleClick={handleContinue}
            >
              <Character config={DEFAULT_CHARACTER} size={90} />
            </ProfileCard>
          );
        })()}

        {/* Add new */}
        <div
          onClick={() => { setNewName(""); setNewChar(DEFAULT_CHARACTER); setScreen("create"); }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 10, cursor: "pointer",
            animation: `cardIn 0.35s ease-out ${(profiles.length + 1) * 0.07}s both`,
          }}
        >
          <div style={{
            width: 110, height: 140, borderRadius: 20,
            background: "rgba(255,255,255,0.02)",
            border: "2px dashed rgba(255,255,255,0.15)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 6, color: "var(--text-dim)", transition: "all 0.18s",
          }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.4)";
              (e.currentTarget as HTMLElement).style.color = "var(--sky-light)";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 11, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>New</span>
          </div>
          <span style={{
            fontSize: 13, fontFamily: "'Nunito',sans-serif",
            fontWeight: 700, color: "var(--text-dim)",
          }}>Add Profile</span>
        </div>
      </div>

      {/* Continue button */}
      <div style={{ marginTop: 44, position: "relative", zIndex: 1 }}>
        <button
          className="btn btn-sky"
          style={{ padding: "15px 52px", fontSize: 17 }}
          onClick={handleContinue}
        >
          {selected === "guest" ? "Play as Guest →" : "Let's Play →"}
        </button>
      </div>
    </div>
  );
}

// ── ProfileCard ────────────────────────────────────────────────────────────────
function ProfileCard({
  isSelected, color, label, dashed = false, delay, onClick, onDoubleClick, children,
}: {
  isSelected: boolean; color: string; label: string; dashed?: boolean;
  delay: number; onClick: () => void; onDoubleClick: () => void; children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 10, cursor: "pointer",
        animation: `cardIn 0.35s ease-out ${delay}s both`,
      }}
    >
      <div style={{
        width: 110, height: 140, borderRadius: 20,
        background: isSelected
          ? `radial-gradient(circle at 50% 35%, ${color}25 0%, rgba(18,14,46,0.8) 80%)`
          : "rgba(255,255,255,0.03)",
        border: `2px ${dashed && !isSelected ? "dashed" : "solid"} ${isSelected ? color : dashed ? "rgba(255,255,255,0.18)" : "var(--border)"}`,
        boxShadow: isSelected ? `0 0 32px ${color}30, 0 8px 30px rgba(0,0,0,0.4)` : "0 4px 20px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        paddingBottom: 4,
        transform: isSelected ? "scale(1.06)" : "scale(1)",
        transition: "all 0.2s ease", overflow: "hidden",
      }}>
        {children}
      </div>
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
        color: isSelected ? "var(--text)" : "var(--text-mid)", transition: "all 0.2s",
      }}>
        {label}
      </div>
      {isSelected && (
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: color, boxShadow: `0 0 10px ${color}`,
          animation: "dotPulse 1.5s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}
