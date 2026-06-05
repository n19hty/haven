import React, { useEffect, useState } from "react";

// Temporary debug overlay (enable with ?debug=1). Reads the Gamepad API
// directly — bypassing useGamepads/useLocalControllers — so we can tell whether
// Chromium exposes the pad to THIS page at all, independent of our wiring. The
// spike page proved cage-Chromium can read the pad; this confirms the real app
// can too (or not). Remove before landing PR2.
export function GamepadDebug() {
  const [lines, setLines] = useState<string>("(waiting)");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.getGamepads) {
      setLines("navigator.getGamepads is UNAVAILABLE");
      return;
    }
    let raf = 0;
    const loop = () => {
      const out: string[] = [];
      for (const gp of navigator.getGamepads()) {
        if (!gp) continue;
        const pressed = gp.buttons
          .map((b, i) => (b.pressed || b.value > 0.5 ? i : -1))
          .filter((i) => i >= 0);
        const axes = gp.axes.map((a) => a.toFixed(2)).join(", ");
        out.push(`#${gp.index} ${gp.id.slice(0, 28)}\n   buttons[${pressed.join(",")}]  axes[${axes}]`);
      }
      setLines(out.length ? out.join("\n") : "no pad seen — press a button on a controller");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 99999,
        maxWidth: "70vw",
        background: "rgba(0,0,0,0.82)",
        color: "#9effa1",
        font: "12px ui-monospace, Menlo, monospace",
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #2a8a2a",
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {"🎮 GAMEPAD DEBUG\n"}
      {lines}
    </div>
  );
}
