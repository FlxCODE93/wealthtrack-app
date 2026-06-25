/* ────────────────────────────────────────────────────────────────────
   Simulation patrimoniale — OR / MÉTAUX PRÉCIEUX.

   Valeur refuge peu corrélée aux actions. Modèle d'accumulation : capital
   initial + versements mensuels, croissance au rendement de l'or, net des
   frais de stockage annuels. Réutilise le design system (Card, Field, Stat,
   makeInputStyle, makeChartTip) et les helpers d'accumulation (fv /
   fvBandSeries) pour une cohérence parfaite avec les autres actifs.
   ──────────────────────────────────────────────────────────────────── */
import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Coins, TrendingUp, Wallet, Info } from "lucide-react";
import { Card, Stat, Field, makeInputStyle, makeChartTip } from "./ui.jsx";
import { eur } from "./theme.js";
import { useT } from "./ThemeProvider.jsx";
import { fv, fvBandSeries, RATE_GOLD } from "./finance.js";
import NumInput from "./NumInput.jsx";

// Accent doré premium, en accord avec la charte sombre/haut de gamme.
const GOLD       = "#f59e0b";
const GOLD_DEEP  = "#d97706";

export default function Or({ patrimoine }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);
  const startYear = new Date().getFullYear();

  /* ── État (même structure que les autres simulateurs) ── */
  const [initial, setInitial]   = useState(5000);
  const [monthly, setMonthly]   = useState(150);
  const [rate, setRate]         = useState(+(RATE_GOLD * 100).toFixed(1)); // rendement annuel estimé (%)
  const [storageFee, setStorageFee] = useState(0.5);                       // frais de stockage (%/an)
  const [horizon, setHorizon]   = useState(20);

  /* ── Calculs ── */
  const netRate = Math.max(-0.05, (rate - storageFee) / 100); // rendement net des frais de stockage
  const scenario = useMemo(() => ({
    pess: Math.max(-0.05, netRate - 0.03),
    base: netRate,
    opt:  netRate + 0.04,
  }), [netRate]);

  const series = useMemo(
    () => fvBandSeries(initial, monthly, scenario, horizon, startYear),
    [initial, monthly, scenario, horizon, startYear]
  );

  const capitalFinal = useMemo(() => Math.round(fv(initial, monthly, netRate, horizon)), [initial, monthly, netRate, horizon]);
  const totalVerse   = Math.round(initial + monthly * 12 * horizon);
  const gain         = capitalFinal - totalVerse;
  const gainPct      = totalVerse > 0 ? Math.round((gain / totalVerse) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-2.5" style={{ background: `${GOLD}1f`, border: `1px solid ${GOLD}55` }}>
          <Coins size={22} style={{ color: GOLD }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>Or — Métaux précieux</h1>
          <p className="text-sm" style={{ color: T.muted }}>
            Valeur refuge : projetez l'accumulation d'or physique, net des frais de stockage.
          </p>
        </div>
      </div>

      {/* Paramètres */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Capital de départ (€)">
            <NumInput min={0} value={initial} style={inputStyle}
              onChange={(n) => setInitial(n)} />
          </Field>
          <Field label="Versement mensuel (€)">
            <NumInput min={0} value={monthly} style={inputStyle}
              onChange={(n) => setMonthly(n)} />
          </Field>
          <Field label="Horizon (années)">
            <NumInput min={1} max={60} value={horizon} style={inputStyle}
              onChange={(n) => setHorizon(n)} />
          </Field>
          <Field label="Rendement annuel estimé (%)">
            <NumInput step={0.1} value={rate} style={inputStyle}
              onChange={(n) => setRate(n)} />
          </Field>
          <Field label="Frais de stockage / an (%)">
            <NumInput step={0.1} min={0} value={storageFee} style={inputStyle}
              onChange={(n) => setStorageFee(n)} />
          </Field>
          <Field label="Rendement net retenu">
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", color: GOLD, fontWeight: 700 }}>
              {(netRate * 100).toFixed(1)} % / an
            </div>
          </Field>
        </div>
      </Card>

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={`Capital à ${startYear + horizon}`} value={eur(capitalFinal)} color={GOLD} icon={Coins} />
        <Stat label="Total versé" value={eur(totalVerse)} color={T.muted} icon={Wallet} />
        <Stat label="Plus-value estimée" value={eur(gain)} color={gain >= 0 ? T.green : T.red} icon={TrendingUp} />
        <Stat label="Performance" value={`${gainPct >= 0 ? "+" : ""}${gainPct} %`} color={gain >= 0 ? T.green : T.red} />
      </div>

      {/* Projection */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} style={{ color: GOLD }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Projection de votre or</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: T.muted }}>
          Trajectoire centrale et bande d'incertitude (scénarios prudent → favorable).
        </p>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={GOLD} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="goldBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={GOLD} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: T.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: T.border }} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                tick={{ fill: T.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip {...chartTip} formatter={(v, n) => [eur(v), n === "capital" ? "Or (net)" : n === "apports" ? "Versé" : n]} />
              {/* Bande d'incertitude pess → opt */}
              <Area type="monotone" dataKey="range" stroke="none" fill="url(#goldBand)" isAnimationActive={false} />
              {/* Versements cumulés (référence) */}
              <Area type="monotone" dataKey="apports" stroke={T.muted} strokeDasharray="4 4" strokeWidth={1.5} fill="none" />
              {/* Trajectoire centrale */}
              <Area type="monotone" dataKey="capital" stroke={GOLD_DEEP} strokeWidth={2.5} fill="url(#goldFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Note pédagogique */}
      <Card style={{ background: `${GOLD}0d`, border: `1px solid ${GOLD}33` }}>
        <div className="flex gap-3">
          <Info size={18} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
          <p className="text-sm" style={{ color: T.muted, lineHeight: 1.6 }}>
            L'or est une <span style={{ color: T.text, fontWeight: 600 }}>valeur refuge</span> peu corrélée aux actions :
            il protège en période de crise mais ne verse aucun revenu (ni dividende, ni loyer). Les
            <span style={{ color: T.text, fontWeight: 600 }}> frais de stockage</span> (coffre, assurance) réduisent le
            rendement net. Hypothèse à titre indicatif, à ne pas considérer comme un conseil en investissement.
          </p>
        </div>
      </Card>
    </div>
  );
}
