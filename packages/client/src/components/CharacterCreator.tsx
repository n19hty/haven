import React from "react";
import { Character, CharacterConfig, DEFAULT_CHARACTER, lighten, darken } from "./Character";

interface Props {
  config: CharacterConfig;
  onChange: (c: CharacterConfig) => void;
}

// ─── Options ──────────────────────────────────────────────────────────────────
export const SKIN_TONES   = ["#FDDBB4","#F1C27D","#D4956A","#C07B42","#7B4E2A","#3C1F0E"];
export const HAIR_COLORS  = ["#1A0F0A","#5C3317","#A0522D","#D4A843","#F0E68C","#DEDEDE","#FF6B9D","#60A5FA","#A78BFA"];
export const EYE_COLORS   = ["#1E40AF","#065F46","#92400E","#7C3AED","#831843","#374151"];
export const OUTFIT_COLORS= ["#8B5CF6","#3B82F6","#10B981","#F59E0B","#EF4444","#EC4899","#06B6D4","#1F2937"];
export const HAIR_STYLES  = ["Short","Wavy","Spiky","Curly","Buns","Classic"];
export const OUTFIT_STYLES= ["Tee","Hoodie","Jacket"];
export const ACCESSORIES  = ["None","Glasses","Cap","Halo ✨"];
export const EXPRESSIONS  = ["Happy 😊","Cool 😎","Excited 🤩"];

// ─── Swatch row ───────────────────────────────────────────────────────────────
function Swatches({
  label, colors, active, onPick,
}: {
  label: string; colors: string[]; active: string; onPick: (c: string) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mono" style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {colors.map((c) => (
          <button
            key={c}
            className={`swatch${c === active ? " active" : ""}`}
            style={{ background: c }}
            onClick={() => onPick(c)}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Pill selector row ────────────────────────────────────────────────────────
function Pills({
  label, options, active, onPick,
}: {
  label: string; options: string[]; active: number; onPick: (i: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mono" style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            style={{
              padding: "5px 13px", borderRadius: 100,
              border: `1.5px solid ${i === active ? "var(--sky)" : "var(--border)"}`,
              background: i === active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
              color: i === active ? "var(--sky-light)" : "var(--text-mid)",
              fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600,
              cursor: "pointer", transition: "all 0.12s",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Creator component ────────────────────────────────────────────────────────
export function CharacterCreator({ config, onChange }: Props) {
  const set = <K extends keyof CharacterConfig>(key: K, val: CharacterConfig[K]) =>
    onChange({ ...config, [key]: val });

  return (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* Preview */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 160, height: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.16) 0%, transparent 70%)",
          borderRadius: 24,
          border: "1px solid var(--border)",
        }}>
          <Character config={config} size={130} animate />
        </div>
        <button
          className="btn-ghost"
          style={{ fontSize: 12, padding: "6px 16px" }}
          onClick={() => onChange(DEFAULT_CHARACTER)}
        >
          Reset
        </button>
      </div>

      {/* Options */}
      <div style={{ flex: 1, minWidth: 260 }}>
        <Swatches label="SKIN" colors={SKIN_TONES} active={config.skin} onPick={(c) => set("skin", c)} />
        <Pills label="HAIR STYLE" options={HAIR_STYLES} active={config.hairStyle} onPick={(i) => set("hairStyle", i)} />
        <Swatches label="HAIR COLOR" colors={HAIR_COLORS} active={config.hairColor} onPick={(c) => set("hairColor", c)} />
        <Swatches label="OUTFIT COLOR" colors={OUTFIT_COLORS} active={config.outfitColor} onPick={(c) => set("outfitColor", c)} />
        <Pills label="OUTFIT STYLE" options={OUTFIT_STYLES} active={config.outfitStyle} onPick={(i) => set("outfitStyle", i)} />
        <Swatches label="EYE COLOR" colors={EYE_COLORS} active={config.eyeColor} onPick={(c) => set("eyeColor", c)} />
        <Pills label="ACCESSORIES" options={ACCESSORIES} active={config.accessory} onPick={(i) => set("accessory", i)} />
        <Pills label="EXPRESSION" options={EXPRESSIONS} active={config.expression} onPick={(i) => set("expression", i)} />
      </div>
    </div>
  );
}
