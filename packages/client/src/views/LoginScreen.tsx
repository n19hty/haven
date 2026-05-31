import React, { useState } from "react";
import { useProfiles, Profile } from "../hooks/useProfiles";
import { Character, CharacterConfig, DEFAULT_CHARACTER } from "../components/Character";
import { CharacterCreator } from "../components/CharacterCreator";
import { SkyBackground } from "../components/SkyBackground";

interface Props {
  onLogin: (profile: Profile) => void;
}

type Screen = "pick" | "create" | "edit";

export function LoginScreen({ onLogin }: Props) {
  const { profiles, addProfile, updateProfile, removeProfile } = useProfiles();
  const [selected, setSelected]   = useState<string | null>(profiles[0]?.id ?? null);
  const [screen, setScreen]       = useState<Screen>("pick");
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [newName, setNewName]     = useState("");
  const [newChar, setNewChar]     = useState<CharacterConfig>(DEFAULT_CHARACTER);
  const [managing, setManaging]   = useState(false);

  function handleCreate() {
    if (!newName.trim()) return;
    const p = addProfile(newName.trim(), newChar);
    setSelected(p.id);
    setScreen("pick");
    setNewName(""); setNewChar(DEFAULT_CHARACTER);
  }

  function handleEdit() {
    if (!editTarget) return;
    updateProfile(editTarget, { character: newChar, name: newName || undefined });
    setScreen("pick"); setEditTarget(null);
  }

  function startEdit(profile: Profile) {
    setEditTarget(profile.id);
    setNewName(profile.name);
    setNewChar(profile.character);
    setScreen("edit");
  }

  function handleContinue() {
    const p = profiles.find((x) => x.id === selected);
    if (p) onLogin(p);
  }

  // ── CREATE / EDIT screen ────────────────────────────────────────────────────
  if (screen === "create" || screen === "edit") {
    const isEdit = screen === "edit";
    return (
      <div style={{
        minHeight: "100dvh", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "flex-start",
        padding: "32px 20px 24px",
        fontFamily: "'Inter', sans-serif",
        animation: "fadeIn 0.3s ease-out",
        overflowY: "auto",
      }}>
        <SkyBackground />
        {/* Back */}
        <button
          onClick={() => { setScreen("pick"); setEditTarget(null); }}
          style={{
            alignSelf: "flex-start", marginBottom: 24, position: "relative", zIndex: 1,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-mid)", fontSize: 14, display: "flex",
            alignItems: "center", gap: 6, fontFamily: "'Nunito', sans-serif",
          }}
        >
          ← Back
        </button>

        <h2 className="nunito" style={{
          fontSize: 28, fontWeight: 900, marginBottom: 6, position: "relative", zIndex: 1,
          color: "var(--text)", textAlign: "center",
        }}>
          {isEdit ? "Edit Character" : "Create Your Character"}
        </h2>
        <p style={{ color: "var(--text-mid)", fontSize: 14, marginBottom: 28, textAlign: "center", position: "relative", zIndex: 1 }}>
          {isEdit ? "Update how you look in Haven." : "Choose how you'll appear across Haven."}
        </p>

        <div className="glass" style={{ width: "100%", maxWidth: 600, padding: 28, position: "relative", zIndex: 1 }}>
          <CharacterCreator config={newChar} onChange={setNewChar} />

          <div style={{
            borderTop: "1px solid var(--border)",
            marginTop: 20, paddingTop: 20,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <label className="mono" style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 2 }}>
              DISPLAY NAME
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.slice(0, 16))}
              onKeyDown={(e) => e.key === "Enter" && (isEdit ? handleEdit() : handleCreate())}
              placeholder="Your name"
              maxLength={16}
              autoFocus={!isEdit}
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
              onClick={isEdit ? handleEdit : handleCreate}
              style={{ padding: "14px", fontSize: 16, marginTop: 4, opacity: newName.trim() ? 1 : 0.45 }}
            >
              {isEdit ? "Save Changes" : "Create Character ✓"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PROFILE PICK screen ─────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
      animation: "fadeIn 0.4s ease-out",
    }}>
      <SkyBackground />

      {/* Logo */}
      <div style={{ marginBottom: 36, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="nunito" style={{
          fontSize: 40, fontWeight: 900, color: "#EEF4FF",
          letterSpacing: -1,
          textShadow: "0 0 36px rgba(255,255,255,0.55)",
          animation: "glow 4s ease-in-out infinite",
        }}>
          haven
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--sky-light)", letterSpacing: 3, marginTop: 4, opacity: 0.7 }}>
          ABOVE THE CLOUDS
        </div>
      </div>

      <h2 className="nunito" style={{
        fontSize: 22, fontWeight: 800, marginBottom: 6, color: "var(--text)", position: "relative", zIndex: 1,
      }}>
        Who's playing?
      </h2>
      <p style={{
        color: "var(--text-mid)", fontSize: 14, marginBottom: 36, position: "relative", zIndex: 1,
      }}>
        Select your profile or create a new one.
      </p>

      {/* Profile grid */}
      <div style={{
        display: "flex", gap: 16, flexWrap: "wrap",
        justifyContent: "center", maxWidth: 680, position: "relative", zIndex: 1,
      }}>
        {profiles.map((p, i) => {
          const isSelected = p.id === selected;
          return (
            <div
              key={p.id}
              onClick={() => !managing ? setSelected(p.id) : removeProfile(p.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 10, cursor: "pointer", position: "relative",
                animation: `cardIn 0.35s ease-out ${i * 0.07}s both`,
              }}
            >
              {/* Delete X */}
              {managing && (
                <div style={{
                  position: "absolute", top: -6, right: -6, zIndex: 10,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#EF4444", color: "#fff",
                  fontSize: 12, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
                }}>×</div>
              )}

              {/* Character card */}
              <div style={{
                width: 110, height: 140,
                borderRadius: 20,
                background: isSelected
                  ? `radial-gradient(circle at 50% 35%, ${p.color}25 0%, rgba(18,14,46,0.8) 80%)`
                  : "rgba(255,255,255,0.03)",
                border: `2px solid ${isSelected ? p.color : "var(--border)"}`,
                boxShadow: isSelected ? `0 0 30px ${p.color}30, 0 8px 30px rgba(0,0,0,0.4)` : "0 4px 20px rgba(0,0,0,0.3)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 4,
                transform: isSelected ? "scale(1.06)" : "scale(1)",
                transition: "all 0.2s ease",
                overflow: "hidden",
                position: "relative",
              }}>
                <Character config={p.character} size={90} />
                {/* Edit button */}
                {!managing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      width: 24, height: 24, borderRadius: "50%",
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="Edit character"
                  >✎</button>
                )}
              </div>

              <div style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700, fontSize: 14,
                color: isSelected ? "var(--text)" : "var(--text-mid)",
                transition: "all 0.2s",
              }}>
                {p.name}
              </div>

              {isSelected && (
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: p.color, boxShadow: `0 0 10px ${p.color}`,
                  animation: "dotPulse 1.5s ease-in-out infinite",
                }} />
              )}
            </div>
          );
        })}

        {/* Create new */}
        {!managing && (
          <div
            onClick={() => { setNewName(""); setNewChar(DEFAULT_CHARACTER); setScreen("create"); }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 10, cursor: "pointer",
              animation: `cardIn 0.35s ease-out ${profiles.length * 0.07}s both`,
            }}
          >
            <div style={{
              width: 110, height: 140,
              borderRadius: 20,
              background: "rgba(255,255,255,0.02)",
              border: "2px dashed rgba(255,255,255,0.2)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 8, color: "var(--text-dim)",
              transition: "all 0.18s",
            }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.5)";
                (e.currentTarget as HTMLElement).style.color = "var(--sky-light)";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
              }}
            >
              <span style={{ fontSize: 32, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 11, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>New</span>
            </div>
            <span style={{ fontSize: 14, fontFamily: "'Nunito',sans-serif", fontWeight: 700, color: "var(--text-dim)" }}>
              Add Player
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        marginTop: 40, display: "flex", gap: 12, position: "relative", zIndex: 1,
        alignItems: "center", flexWrap: "wrap", justifyContent: "center",
      }}>
        {selected && !managing && (
          <button
            className="btn btn-sky"
            style={{ padding: "14px 44px", fontSize: 17 }}
            onClick={handleContinue}
          >
            Let's Play →
          </button>
        )}
        {profiles.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{
              padding: "14px 20px", fontSize: 14,
              borderColor: managing ? "rgba(239,68,68,0.4)" : undefined,
              color: managing ? "#F87171" : undefined,
            }}
            onClick={() => setManaging(!managing)}
          >
            {managing ? "Done" : "Manage"}
          </button>
        )}
      </div>
    </div>
  );
}
