import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ComposedChart,
} from "recharts";
import { C } from "./theme.js";
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

/* ─────────────────────────────────────────────────────────────── */
/* Tooltip personnalisé — fintech-friendly                          */
/* ─────────────────────────────────────────────────────────────── */

const CustomTooltip = ({ active, payload, label, format = (v) => v }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="wt-glass rounded-lg p-3 shadow-lg border border-white/10">
      {label && (
        <p className="text-xs font-semibold text-white/70 mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {format(entry.value)}
        </p>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────── */
/* ChartShell — titre + bouton plein écran (modal) commun à tous    */
/* les graphiques. Le `children` est rendu dans un ResponsiveContainer */
/* à hauteur fixe en vue normale, et 70vh en plein écran.           */
/* ─────────────────────────────────────────────────────────────── */

function ChartShell({ title, ariaLabel, height = 280, children }) {
  const [full, setFull] = useState(false);
  const body = (h) => (
    <div style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
  return (
    <div role="figure" aria-label={ariaLabel || title} style={{ position: "relative" }}>
      {title && <h3 className="text-headline mb-4">{title}</h3>}
      <button
        onClick={() => setFull(true)}
        aria-label="Agrandir le graphique en plein écran"
        style={{ position: "absolute", top: title ? 0 : -2, right: 0, zIndex: 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: 6, cursor: "pointer", color: "rgba(255,255,255,0.6)", lineHeight: 0 }}
      >
        <Maximize2 size={15} />
      </button>
      {body(height)}
      {full && createPortal(
        <div
          onClick={() => setFull(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#0b1120", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "48px 16px 16px", width: "100%", maxWidth: 1000, position: "relative" }}
          >
            {title && <h3 style={{ position: "absolute", top: 16, left: 20, color: "#f8fafc", fontWeight: 700, fontSize: 16, margin: 0 }}>{title}</h3>}
            <button onClick={() => setFull(false)} aria-label="Fermer" style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <X size={20} />
            </button>
            {body("70vh")}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Line Chart — fintech primary (growth, trends)                    */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechLineChart = ({
  data,
  lines = [],
  format = (v) => v,
  title,
  ariaLabel,
  xKey = "name",
  margin = { top: 8, right: 60, left: 0, bottom: 0 },
}) => (
  <ChartShell title={title} ariaLabel={ariaLabel}>
    <LineChart data={data} margin={margin}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} />
      <YAxis stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} tickFormatter={format} />
      <Tooltip content={<CustomTooltip format={format} />} />
      {lines.map((lineConfig, idx) => (
        <Line
          key={idx}
          type="monotone"
          dataKey={lineConfig.dataKey}
          stroke={lineConfig.stroke || C.amber}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name={lineConfig.name || lineConfig.dataKey}
        />
      ))}
    </LineChart>
  </ChartShell>
);

/* ─────────────────────────────────────────────────────────────── */
/* Area Chart — composition, stacked values                         */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechAreaChart = ({
  data,
  areas = [],
  format = (v) => v,
  title,
  ariaLabel,
  stacked = true,
  xKey = "name",
  margin = { top: 8, right: 60, left: 0, bottom: 0 },
}) => (
  <ChartShell title={title} ariaLabel={ariaLabel}>
    <AreaChart data={data} margin={margin}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} />
      <YAxis stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} tickFormatter={format} />
      <Tooltip content={<CustomTooltip format={format} />} />
      {areas.map((areaConfig, idx) => (
        <Area
          key={idx}
          type="monotone"
          dataKey={areaConfig.dataKey}
          fill={areaConfig.fill || C.violet}
          fillOpacity={0.3}
          stroke={areaConfig.stroke || C.violet}
          strokeWidth={2}
          isAnimationActive={false}
          stackId={stacked ? "area" : undefined}
          name={areaConfig.name || areaConfig.dataKey}
        />
      ))}
    </AreaChart>
  </ChartShell>
);

/* ─────────────────────────────────────────────────────────────── */
/* Bar Chart — comparisons, discrete values                         */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechBarChart = ({
  data,
  bars = [],
  format = (v) => v,
  title,
  ariaLabel,
  xKey = "name",
  margin = { top: 8, right: 16, left: 0, bottom: 0 },
}) => (
  <ChartShell title={title} ariaLabel={ariaLabel}>
    <BarChart data={data} margin={margin}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} />
      <YAxis stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} tickFormatter={format} />
      <Tooltip content={<CustomTooltip format={format} />} />
      {bars.map((barConfig, idx) => (
        <Bar
          key={idx}
          dataKey={barConfig.dataKey}
          fill={barConfig.fill || C.amber}
          isAnimationActive={false}
          name={barConfig.name || barConfig.dataKey}
          radius={[6, 6, 0, 0]}
        />
      ))}
    </BarChart>
  </ChartShell>
);

/* ─────────────────────────────────────────────────────────────── */
/* Scatter Chart — risk/return correlation                          */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechScatterChart = ({
  data,
  xKey = "x",
  yKey = "y",
  format = (v) => v,
  title,
  ariaLabel,
  color = C.cyan,
}) => (
  <ChartShell title={title} ariaLabel={ariaLabel}>
    <ScatterChart margin={{ top: 8, right: 60, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} tickFormatter={format} />
      <YAxis dataKey={yKey} stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} tickFormatter={format} />
      <Tooltip content={<CustomTooltip format={format} />} />
      <Scatter name="Data" data={data} fill={color} isAnimationActive={false} />
    </ScatterChart>
  </ChartShell>
);

/* ─────────────────────────────────────────────────────────────── */
/* Composed Chart — multi-axis comparison (bars + lines)            */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechComposedChart = ({
  data,
  bars = [],
  lines = [],
  format = (v) => v,
  title,
  ariaLabel,
  xKey = "name",
  margin = { top: 8, right: 60, left: 0, bottom: 0 },
}) => (
  <ChartShell title={title} ariaLabel={ariaLabel}>
    <ComposedChart data={data} margin={margin}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} />
      <YAxis stroke="rgba(255,255,255,0.4)" style={{ fontSize: "12px" }} tickFormatter={format} />
      <Tooltip content={<CustomTooltip format={format} />} />
      {bars.map((barConfig, idx) => (
        <Bar
          key={`bar-${idx}`}
          dataKey={barConfig.dataKey}
          fill={barConfig.fill || C.amber}
          isAnimationActive={false}
          name={barConfig.name || barConfig.dataKey}
          radius={[6, 6, 0, 0]}
        />
      ))}
      {lines.map((lineConfig, idx) => (
        <Line
          key={`line-${idx}`}
          type="monotone"
          dataKey={lineConfig.dataKey}
          stroke={lineConfig.stroke || C.cyan}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name={lineConfig.name || lineConfig.dataKey}
        />
      ))}
    </ComposedChart>
  </ChartShell>
);
