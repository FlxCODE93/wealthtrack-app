import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { ResponsiveContainer } from "recharts";
import { useT } from "./ThemeProvider.jsx";

/* ─────────────────────────────────────────────────────────────── */
/* ExpandableChart — wrapper plein écran réutilisable pour tout      */
/* graphique recharts BRUT (children = l'élément chart sans          */
/* ResponsiveContainer, fourni ici). Utilisable dans tous les fichiers. */
/* ─────────────────────────────────────────────────────────────── */
export function ExpandableChart({ children, height = 280, title, controls, legend }) {
  const T = useT();
  const [full, setFull] = useState(false);
  const body = (h) => (
    <div style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setFull(true)} aria-label="Agrandir le graphique en plein écran"
        style={{ position: "absolute", top: -2, right: 0, zIndex: 2, background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.muted, lineHeight: 0 }}>
        <Maximize2 size={15} />
      </button>
      {body(height)}
      {full && createPortal(
        <div onClick={() => setFull(false)} className="wt-fade-in"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px", width: "100%", maxWidth: 1000, position: "relative" }}>
            {/* Fullscreen header: title | controls | close */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              {title && <h3 style={{ color: T.text, fontWeight: 700, fontSize: 16, margin: 0, flexShrink: 0 }}>{title}</h3>}
              {controls && <div style={{ flex: 1 }}>{controls}</div>}
              <button onClick={() => setFull(false)} aria-label="Fermer" style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={20} />
              </button>
            </div>
            {body("65vh")}
            {legend && <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>{legend}</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


