import React, { useState } from "react";
import { Info } from "lucide-react";
import { C } from "./theme.js";

/**
 * Petite icône d'aide affichant une définition au survol (ou au clic, écrans tactiles).
 * Usage : <InfoTooltip text="Définition du terme…" align="left|center|right" />
 */
export default function InfoTooltip({ text, align = "center" }) {
  const [open, setOpen] = useState(false);

  const alignStyle =
    align === "left"  ? { left: 0, transform: "none" } :
    align === "right" ? { right: 0, transform: "none" } :
                         { left: "50%", transform: "translateX(-50%)" };

  return (
    <span
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
    >
      <Info size={12} style={{ color: C.muted, cursor: "help" }} />
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", ...alignStyle,
            background: C.card, border: `1px solid ${C.border}`, color: C.text,
            fontSize: 11, fontWeight: 400, lineHeight: 1.5, padding: "8px 10px",
            borderRadius: 8, width: 220, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            textAlign: "left", whiteSpace: "normal", textTransform: "none", letterSpacing: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
