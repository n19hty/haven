import React, { useEffect, useState } from "react";

// Device admin panel, reachable from any phone on the LAN at
//   http://<haven-ip>:3001/?admin=1
// Lets you update + restart the console (or roll back) without a controller.
interface Status {
  commit?: string | null;
  branch?: string | null;
  message?: string | null;
}

export function AdminView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }
  useEffect(refresh, []);

  async function run(action: "update" | "rollback") {
    if (action === "rollback" && !window.confirm("Roll back to the previous version?")) return;
    setBusy(
      action === "update"
        ? "Updating… the console will rebuild and restart. This takes 1–3 minutes; it will reconnect on its own."
        : "Rolling back… rebuilding and restarting.",
    );
    try {
      await fetch(`/api/${action}`, { method: "POST" });
    } catch {
      /* the server may drop while restarting — expected */
    }
    // Re-poll a bit later once it's likely back.
    setTimeout(refresh, 8000);
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "#070B1E", color: "#EEF4FF",
      fontFamily: "system-ui, sans-serif", padding: "32px 20px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
    }}>
      <div style={{ fontSize: 26, fontWeight: 900 }}>Haven — Admin</div>

      <div style={{
        width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
        padding: 16, fontSize: 14, lineHeight: 1.6,
      }}>
        <div>commit: <b>{status?.commit ?? "…"}</b> <span style={{ opacity: 0.6 }}>({status?.branch ?? "?"})</span></div>
        <div style={{ opacity: 0.8, marginTop: 4 }}>{status?.message ?? ""}</div>
      </div>

      <button onClick={() => run("update")} disabled={!!busy} style={btn("#38BDF8", "#04091C")}>
        Update &amp; restart
      </button>
      <button onClick={() => run("rollback")} disabled={!!busy} style={btn("transparent", "#FCA5A5", "#EF4444")}>
        Roll back to previous
      </button>
      <button onClick={refresh} style={{ ...btn("transparent", "#9FB3C8", "#33415540"), fontSize: 14, padding: "10px 18px" }}>
        Refresh
      </button>

      {busy && (
        <div style={{
          width: "100%", maxWidth: 420, marginTop: 4,
          color: "#FDE68A", fontSize: 14, textAlign: "center",
        }}>
          {busy}
        </div>
      )}
    </div>
  );
}

function btn(bg: string, fg: string, border?: string): React.CSSProperties {
  return {
    width: "100%", maxWidth: 420, padding: "16px",
    borderRadius: 100, fontSize: 17, fontWeight: 800, cursor: "pointer",
    background: bg, color: fg,
    border: border ? `1px solid ${border}` : "none",
  };
}
