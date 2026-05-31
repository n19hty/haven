import React from "react";

// ─── Config type ──────────────────────────────────────────────────────────────
export interface CharacterConfig {
  skin: string;         // hex
  hairColor: string;    // hex
  hairStyle: number;    // 0-5
  outfitColor: string;  // hex
  outfitStyle: number;  // 0-2
  eyeColor: string;     // hex
  accessory: number;    // 0-3
  expression: number;   // 0-2
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  skin: "#FDDBB4",
  hairColor: "#2C1810",
  hairStyle: 0,
  outfitColor: "#8B5CF6",
  outfitStyle: 0,
  eyeColor: "#3B82F6",
  accessory: 0,
  expression: 0,
};

// ─── Color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r,g,b].map(x => Math.min(255,Math.max(0,Math.round(x))).toString(16).padStart(2,"0")).join("");
}
export function lighten(hex: string, a: number) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r+(255-r)*a, g+(255-g)*a, b+(255-b)*a);
}
export function darken(hex: string, a: number) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r*(1-a), g*(1-a), b*(1-a));
}

// ─── Hair styles ──────────────────────────────────────────────────────────────
function Hair({ style, color }: { style: number; color: string }) {
  const d = darken(color, 0.15);
  const l = lighten(color, 0.12);

  if (style === 0) return ( // Short smooth
    <path d="M22 52 Q21 22 60 20 Q99 22 98 52 Q90 34 60 32 Q30 34 22 52Z" fill={color} />
  );
  if (style === 1) return ( // Long & wavy
    <g>
      <path d="M22 52 Q21 22 60 20 Q99 22 98 52 Q90 34 60 32 Q30 34 22 52Z" fill={color} />
      <path d="M20 50 Q12 70 15 95 Q17 106 24 104 Q20 88 22 68Z" fill={d} />
      <path d="M100 50 Q108 70 105 95 Q103 106 96 104 Q100 88 98 68Z" fill={d} />
    </g>
  );
  if (style === 2) return ( // Spiky
    <g fill={color}>
      <path d="M24 50 Q24 26 60 22 Q96 26 96 50 Q88 35 60 33 Q32 35 24 50Z" />
      <polygon points="40,33 35,8 48,31" />
      <polygon points="60,28 60,4 70,28" />
      <polygon points="80,33 85,8 72,31" />
    </g>
  );
  if (style === 3) return ( // Curly afro
    <g>
      <circle cx="60" cy="36" r="26" fill={color} />
      <circle cx="37" cy="44" r="10" fill={l} />
      <circle cx="83" cy="44" r="10" fill={l} />
      <circle cx="60" cy="22" r="10" fill={l} />
    </g>
  );
  if (style === 4) return ( // Twin buns
    <g>
      <path d="M24 52 Q24 28 60 26 Q96 28 96 52 Q88 38 60 36 Q32 38 24 52Z" fill={color} />
      <circle cx="34" cy="24" r="12" fill={color} />
      <circle cx="86" cy="24" r="12" fill={color} />
    </g>
  );
  // Style 5: Classic side part
  return (
    <g>
      <path d="M24 52 Q22 22 60 20 Q98 22 98 52 Q90 35 60 33 Q30 35 24 52Z" fill={color} />
      <path d="M24 48 Q26 30 40 26" stroke={d} strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  );
}

// ─── Accessories ──────────────────────────────────────────────────────────────
function Accessory({ type, hairColor }: { type: number; hairColor: string }) {
  if (type === 0) return null;
  if (type === 1) return ( // Round glasses
    <g fill="none" stroke="rgba(30,20,60,0.5)" strokeWidth="2">
      <circle cx="46" cy="54" r="10" />
      <circle cx="74" cy="54" r="10" />
      <line x1="56" y1="54" x2="64" y2="54" />
      <line x1="20" y1="54" x2="36" y2="54" />
      <line x1="84" y1="54" x2="100" y2="54" />
    </g>
  );
  if (type === 2) return ( // Cap
    <g>
      <path d="M22 44 Q22 12 60 10 Q98 12 98 44 Q88 28 60 26 Q32 28 22 44Z" fill={darken(hairColor,0.1)} />
      <rect x="14" y="42" width="92" height="10" rx="5" fill={darken(hairColor,0.15)} />
      {/* Bill */}
      <path d="M14 52 Q10 62 22 58 Q28 52 50 52" fill={darken(hairColor,0.2)} />
    </g>
  );
  // Type 3: Halo (utopian!)
  return (
    <g>
      <ellipse cx="60" cy="12" rx="24" ry="6" fill="none" stroke="#FDE68A" strokeWidth="3.5" opacity="0.9" />
      <ellipse cx="60" cy="12" rx="24" ry="6" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.5" />
    </g>
  );
}

// ─── Expression ───────────────────────────────────────────────────────────────
function Eyes({ expression, eyeColor }: { expression: number; eyeColor: string }) {
  const scaleY = expression === 1 ? 0.6 : 1; // cool = half-squint
  return (
    <g>
      {/* Whites */}
      <ellipse cx="46" cy="55" rx="9" ry={9 * scaleY} fill="white" />
      <ellipse cx="74" cy="55" rx="9" ry={9 * scaleY} fill="white" />
      {/* Iris */}
      <circle cx="46" cy="56" r="6" fill={eyeColor} />
      <circle cx="74" cy="56" r="6" fill={eyeColor} />
      {/* Pupil */}
      <circle cx="46" cy="56" r="3" fill="#0B0618" />
      <circle cx="74" cy="56" r="3" fill="#0B0618" />
      {/* Shine */}
      <circle cx="43" cy="52" r="2" fill="white" />
      <circle cx="71" cy="52" r="2" fill="white" />
      {/* Eyelashes / brow shape */}
      {expression === 2 && ( // Excited: raised brows
        <g stroke="#4A3020" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M39 44 Q46 40 53 43" />
          <path d="M67 44 Q74 40 81 43" />
        </g>
      )}
    </g>
  );
}

function Mouth({ expression }: { expression: number }) {
  if (expression === 0) return ( // Happy smile
    <path d="M47 68 Q60 78 73 68" stroke="#7A3A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  );
  if (expression === 1) return ( // Cool smirk
    <path d="M51 68 Q60 73 70 66" stroke="#7A3A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  );
  // Excited: big open smile
  return (
    <g>
      <path d="M46 67 Q60 82 74 67" stroke="#7A3A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="74" rx="8" ry="5" fill="#E07060" opacity="0.7" />
    </g>
  );
}

// ─── Main character SVG ───────────────────────────────────────────────────────
export function Character({
  config,
  size = 120,
  animate = false,
}: {
  config: CharacterConfig;
  size?: number;
  animate?: boolean;
}) {
  const id = `c${config.skin.slice(1,5)}${config.outfitColor.slice(1,5)}`;

  const skinLight  = lighten(config.skin, 0.18);
  const skinDark   = darken(config.skin, 0.08);
  const outfitDark = darken(config.outfitColor, 0.18);

  // Foot color: dark outfit variant or dark skin
  const footColor  = darken(config.outfitColor, 0.28);

  return (
    <svg
      width={size}
      height={size * 1.28}
      viewBox="0 0 120 154"
      style={{
        filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.45))",
        animation: animate ? "float 3.2s ease-in-out infinite, glow 3.2s ease-in-out infinite" : undefined,
        overflow: "visible",
      }}
    >
      <defs>
        <radialGradient id={`sk-${id}`} cx="38%" cy="32%" r="62%">
          <stop offset="0%"   stopColor={skinLight} />
          <stop offset="100%" stopColor={skinDark}  />
        </radialGradient>
        <radialGradient id={`ot-${id}`} cx="35%" cy="28%" r="65%">
          <stop offset="0%"   stopColor={lighten(config.outfitColor, 0.22)} />
          <stop offset="100%" stopColor={outfitDark} />
        </radialGradient>
        <radialGradient id={`sh-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.2)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="60" cy="150" rx="36" ry="8" fill={`url(#sh-${id})`} />

      {/* ── Body / Outfit ── */}
      {/* Torso */}
      <rect x="36" y="92" width="48" height="46" rx="18" fill={`url(#ot-${id})`} />
      {/* Left arm */}
      <rect x="16" y="95" width="22" height="34" rx="11" fill={`url(#ot-${id})`} />
      {/* Right arm */}
      <rect x="82" y="95" width="22" height="34" rx="11" fill={`url(#ot-${id})`} />
      {/* Feet */}
      <ellipse cx="48" cy="142" rx="15" ry="9" fill={footColor} />
      <ellipse cx="72" cy="142" rx="15" ry="9" fill={footColor} />

      {/* Outfit detail: collar */}
      {config.outfitStyle === 0 && (
        <path d="M50 97 Q60 104 70 97" stroke={outfitDark} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* Hoodie pocket */}
      {config.outfitStyle === 1 && (
        <rect x="50" y="115" width="20" height="14" rx="6" fill={darken(config.outfitColor, 0.1)} />
      )}
      {/* Jacket lapels */}
      {config.outfitStyle === 2 && (
        <g stroke={outfitDark} strokeWidth="2" fill="none">
          <path d="M54 95 L48 110" strokeLinecap="round" />
          <path d="M66 95 L72 110" strokeLinecap="round" />
        </g>
      )}

      {/* ── Neck ── */}
      <rect x="52" y="80" width="16" height="14" rx="7" fill={`url(#sk-${id})`} />

      {/* ── Head ── */}
      <circle cx="60" cy="52" r="32" fill={`url(#sk-${id})`} />
      {/* Chin detail */}
      <ellipse cx="60" cy="80" rx="14" ry="8" fill={darken(config.skin, 0.05)} />
      {/* Cheeks */}
      <circle cx="34" cy="62" r="7" fill="#F87171" opacity="0.28" />
      <circle cx="86" cy="62" r="7" fill="#F87171" opacity="0.28" />

      {/* ── Hair (behind head in z-order needs to come before for side locks) ── */}
      <Hair style={config.hairStyle} color={config.hairColor} />

      {/* ── Face ── */}
      <Eyes expression={config.expression} eyeColor={config.eyeColor} />
      <Mouth expression={config.expression} />

      {/* Head specular highlight */}
      <ellipse cx="48" cy="38" rx="10" ry="6" fill="white" opacity="0.14" transform="rotate(-20,48,38)" />

      {/* ── Accessory ── */}
      <Accessory type={config.accessory} hairColor={config.hairColor} />
    </svg>
  );
}
