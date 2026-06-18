/* ────────────────────────────────────────────────────────────────────
   Atomes UI partagés (extraits d'App.jsx).
   Présentation pure : dépendent uniquement de useT() + props.
   ──────────────────────────────────────────────────────────────────── */
import React from "react";
import { useT } from "./ThemeProvider.jsx";

export function Card({ children, style, className = "" }) {
  const T = useT();
  return (
    <div
      className={"rounded-2xl p-5 " + className}
      style={{ background: T.card, border: `1px solid ${T.border}`, ...style }}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value, color, icon: Icon }) {
  const T = useT();
  return (
    <Card className="flex-1" style={{ minWidth: 160 }}>
      <div className="flex items-start justify-between">
        <span className="text-sm" style={{ color: T.muted }}>{label}</span>
        {Icon && <Icon size={18} style={{ color }} />}
      </div>
      <div className="text-2xl font-bold mt-3" style={{ color }}>{value}</div>
    </Card>
  );
}

export function Badge({ tone = "neutral", icon: Icon, label }) {
  const T = useT();
  const palette = {
    green:   { bg: "rgba(0,200,150,0.12)",  color: T.green },
    red:     { bg: "rgba(255,92,122,0.12)", color: T.red },
    neutral: { bg: "rgba(255,255,255,0.05)", color: T.muted },
  };
  const { bg, color } = palette[tone] || palette.neutral;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
      style={{ background: bg, color }}>
      {Icon && <Icon size={12} />}{label}
    </span>
  );
}

export function KpiCard({ label, value, valueColor, sub, flashRef }) {
  const T = useT();
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      {flashRef && (
        <div ref={flashRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit" }} />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div className="text-sm mb-3" style={{ color: T.muted }}>{label}</div>
        <div className="text-3xl font-bold mb-2 truncate" style={{ color: valueColor || T.text }}>{value}</div>
        <div className="flex items-center gap-1.5 text-xs flex-wrap">{sub}</div>
      </div>
    </Card>
  );
}

export function Pill({ children, active, onClick }) {
  const T = useT();
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-xl text-sm font-medium transition"
      style={{
        background: active ? T.blue : "rgba(255,255,255,0.04)",
        color: active ? "#fff" : T.muted,
        border: `1px solid ${active ? T.blue : T.border}`,
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, compact = false }) {
  const T = useT();
  return (
    <div className={compact ? "flex flex-col self-start" : "flex flex-col h-full"}>
      <label className={`block text-sm mb-2 ${compact ? "" : "flex-grow"}`} style={{ color: T.muted }}>{label}</label>
      {children}
    </div>
  );
}

export function MiniStat({ label, value, color }) {
  const T = useT();
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
      <div className="text-sm" style={{ color: T.muted }}>{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color: color || T.text }}>{value}</div>
    </div>
  );
}

export const makeChartTip = (T) => ({
  contentStyle: {
    background: T.panel, border: `1px solid ${T.border}`,
    borderRadius: 12, color: T.text,
  },
  labelStyle: { color: T.muted },
});

// Étiquette % au centre des segments d'un donut Recharts
export const renderDonutPctLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.01) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export const makeInputStyle = (T) => ({
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${T.border}`,
  color: T.text,
  borderRadius: 12,
  padding: "10px 14px",
  width: "100%",
});
