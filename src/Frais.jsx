import React, { useState, useMemo, useRef } from "react";
import { useT } from "./ThemeProvider.jsx";
import { useLocalStorage } from "./storage.js";
import { Field } from "./ui.jsx";
import { fv, RATE_ETF_WORLD } from "./finance.js";
import { Percent, AlertTriangle, Info, ChevronDown, ChevronUp, BookOpen, Wallet, ArrowRight } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

const eur = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(n) ? n : 0)) + " €";

const HORIZONS = [5, 10, 15, 20, 30];

const DEVICES = [
  {
    id: "etf_pea",
    name: "ETF PEA",
    label: "ETF World (PEA)",
    color: "#22c55e",
    fraisEntree: 0,
    fraisAnnuels: 0.25,
    entreeRange: "0 %",
    annuelsRange: "0,07–0,25 %",
    rendementBrut: RATE_ETF_WORLD * 100,
    type: "passif",
    avantages: ["Pas de frais d'entrée en courtage en ligne", "Enveloppe fiscale PEA avantageuse", "Liquidité immédiate"],
    inconvenients: ["Performance non garantie", "Risque de marché (~−35% en crise)"],
    note: "Frais annuels tout inclus très bas (souvent 0,07 à 0,25 %). Disponible chez la plupart des courtiers en ligne.",
  },
  {
    id: "av_uc",
    name: "AV Unités de Compte",
    label: "Assurance-Vie UC",
    color: "#3b82f6",
    fraisEntree: 0,
    fraisAnnuels: 1.4,
    entreeRange: "0–5 %",
    annuelsRange: "1,0–2,5 %",
    rendementBrut: RATE_ETF_WORLD * 100,
    type: "mixte",
    avantages: ["Fiscalité successorale avantageuse", "Gestion libre ou pilotée", "Arbitrages possibles"],
    inconvenients: ["Frais du contrat (0,5–1%) + frais des placements (0,5–1%)", "Double couche de frais vs un ETF acheté en direct"],
    note: "En 2025 : frais de contrat ~0,82 %/an + frais des supports UC ~1,60 %/an en moyenne. En ligne, on descend à 0,4–0,6 % de contrat. Comparez avant de souscrire.",
  },
  {
    id: "av_fonds_euro",
    name: "AV fonds €",
    label: "Assurance-Vie fonds euros",
    color: "#f59e0b",
    fraisEntree: 0,
    fraisAnnuels: 0.66,
    entreeRange: "0–3 %",
    annuelsRange: "0,5–0,9 %",
    rendementBrut: 2.6,
    type: "garanti",
    avantages: ["Capital garanti", "Liquidité sous 72h", "Pas de frais d'entrée en ligne"],
    inconvenients: ["Frais de gestion déduits avant revalorisation", "Frais d'enveloppe parfois élevés en banque traditionnelle"],
    note: "Frais de gestion du fonds euros ~0,66 %/an en moyenne (2025, France Assureurs), prélevés avant revalorisation. 0 % de frais d'entrée chez les contrats en ligne.",
  },
  {
    id: "per",
    name: "PER",
    label: "Plan d'Épargne Retraite",
    color: "#8b5cf6",
    fraisEntree: 0,
    fraisAnnuels: 1.5,
    entreeRange: "0–5 %",
    annuelsRange: "0,5–2,0 %",
    rendementBrut: 8.0,
    type: "retraite",
    avantages: ["Déduction fiscale à l'entrée (jusqu'à 30%)", "Épargne retraite structurée", "UC + fonds €"],
    inconvenients: ["Bloqué jusqu'à retraite (sauf cas exceptionnels)", "Frais élevés chez banques traditionnelles"],
    note: "L'avantage fiscal à l'entrée compense souvent les frais. En ligne, on trouve des PER à ~0,5 % de frais de contrat.",
  },
  {
    id: "opcvm",
    name: "OPCVM actif",
    label: "Fonds actifs (SICAV, FCP)",
    color: "#ef4444",
    fraisEntree: 2.0,
    fraisAnnuels: 2.0,
    entreeRange: "0–5 %",
    annuelsRange: "1,5–2,5 %",
    rendementBrut: RATE_ETF_WORLD * 100,
    type: "actif",
    avantages: ["Gestion professionnelle active", "Diversification automatique"],
    inconvenients: ["Frais d'entrée 0–5% + gestion 1,5–2,5%", "80% des fonds actifs sous-performent leur indice sur 10 ans (SPIVA)"],
    note: "Frais annuels moyens des fonds UC ~1,60 %/an en 2025, + entrée 0–5 %. Rarement compensés par la surperformance. Préférer les ETF.",
  },
  {
    id: "scpi",
    name: "SCPI",
    label: "SCPI (immobilier sans gestion)",
    color: "#f97316",
    fraisEntree: 10.0,
    fraisAnnuels: 1.0,
    entreeRange: "8–12 %",
    annuelsRange: "~1 %",
    rendementBrut: 4.9,
    type: "immo",
    avantages: ["Exposition immobilière sans gestion", "Pas de frais d'entrée sur certaines SCPI récentes", "Diversification géographique"],
    inconvenients: ["Frais d'entrée 8–12% (one-shot)", "Frais de gestion ~1%/an prélevés sur les loyers", "Liquidité faible (délai de revente)"],
    note: "Frais d'entrée souvent 8–12 % (one-shot), certaines SCPI à 0 %. Frais de gestion ~1 %/an. Les frais d'entrée demandent ~5 ans pour être amortis.",
  },
];

const GLOSSAIRE = [
  { term: "Frais d'entrée", def: "Prélevés une fois à la souscription (ex: 3% sur un versement de 10 000€ = 300€ perdus immédiatement). Négociables ou nuls en ligne." },
  { term: "Frais de gestion annuels", def: "Prélevés chaque année sur tout l'argent placé (ex : 1,5 % sur 50 000 € = 750 €/an). Année après année, 1,5 %/an efface environ 25 % du capital sur 20 ans." },
  { term: "TER (Total Expense Ratio)", def: "Le total des frais annuels d'un ETF ou d'un fonds, tout compris. Un TER de 0,25 %, c'est 2,50 € par an pour 1 000 € placés." },
  { term: "Frais d'enveloppe", def: "Les frais du contrat lui-même (assurance-vie, PER), en plus des frais des placements qu'il contient. Ils s'additionnent : 0,7 % de contrat + 0,7 % de placement = 1,4 % au total." },
  { term: "Commission sur les gains", def: "Des frais en plus quand le fonds dépasse son objectif (ex : 20 % des gains supplémentaires). Ils réduisent votre rendement justement les bonnes années." },
  { term: "Gestion libre", def: "Vous choisissez vous-même où va votre argent (ETF, fonds €…). Le moins cher, mais demande un peu d'implication." },
  { term: "Gestion pilotée", def: "Un robot ou un gérant décide à votre place selon votre profil. Plus simple, mais 0,3 à 0,9 % de frais en plus chaque année." },
  { term: "Unités de Compte (UC)", def: "Les placements d'une assurance-vie ou d'un PER dont la valeur peut monter ou baisser (actions, ETF…). Plus de potentiel, mais risque de perte." },
  { term: "Fonds euros", def: "Support garanti en capital dans une AV. Rendement faible (~2–3%). Idéal pour la partie sécurisée d'un contrat multi-support." },
  { term: "Effet de capitalisation des frais", def: "1€ de frais prélevé aujourd'hui coûte bien plus que 1€ futur — car ces 1€ n'a pas pu croître pendant des années." },
];

// Section structurée par l'espace négatif : un filet fin en haut, beaucoup d'air,
// aucun rectangle fermé. Titre typographique fort, sous-titre clair et fin.
function Section({ T, title, sub, action, first, children }) {
  return (
    <section style={{ borderTop: first ? "none" : `1px solid ${T.border}`, paddingTop: first ? 0 : 32 }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: sub ? 8 : 24 }}>
          {title && <h2 style={{ color: T.text, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>}
          {action}
        </div>
      )}
      {sub && <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.65, margin: "0 0 24px", maxWidth: 680 }}>{sub}</p>}
      {children}
    </section>
  );
}

function FeeImpactBar({ horizon, capital, feeRate }) {
  const T = useT();
  const rows = useMemo(() => {
    const items = DEVICES.map((d) => {
      const capitalNet = capital * (1 - d.fraisEntree / 100);
      const final = fv(capitalNet, 0, (d.rendementBrut - d.fraisAnnuels) / 100, horizon);
      return { name: d.label, final: Math.round(final), color: d.color };
    });
    items.sort((a, b) => b.final - a.final);
    const max = items[0]?.final || 1;
    return items.map(r => ({ ...r, pct: (r.final / max) * 100 }));
  }, [capital, horizon, feeRate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px", alignItems: "center", gap: 12 }}>
          <span style={{ color: T.muted, fontSize: 12, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${r.pct}%`, height: "100%", background: r.color, borderRadius: 6, transition: "width 0.4s ease" }} />
          </div>
          <span style={{ color: r.color, fontSize: 13, fontWeight: 700 }}>{eur(r.final)}</span>
        </div>
      ))}
    </div>
  );
}

function GlossaireItem({ term, def }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", gap: 12 }}
      >
        <span style={{ color: T.text, fontWeight: 600, fontSize: 15 }}>{term}</span>
        {open ? <ChevronUp size={16} style={{ color: T.muted, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: T.muted, flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.65, paddingBottom: 16 }}>
          {def}
        </div>
      )}
    </div>
  );
}

// Smart default fee rate from label keywords
function guessRate(label = "") {
  const l = label.toLowerCase();
  if (l.includes("livret") || l.includes("ldds") || l.includes("ldd")) return 0;
  if (l.includes("pea")) return 0.2;
  if (l.includes("etf")) return 0.25;
  if (l.includes("per")) return 1.5;
  if (l.includes("scpi")) return 1.0;
  if (l.includes("av") || l.includes("assurance") || l.includes("vie")) return 1.5;
  if (l.includes("fonds") || l.includes("sicav") || l.includes("opcvm")) return 2.0;
  if (l.includes("crypto") || l.includes("bitcoin") || l.includes("eth")) return 0.5;
  return 1.0;
}

export default function Frais({ invested = 0, investItems = [], setView }) {
  const T = useT();
  // Input épuré : se fond dans le fond de page, juste un filet inférieur.
  const uStyle = { background: "transparent", border: "none", borderBottom: `1px solid ${T.border}`, borderRadius: 0, color: T.text, padding: "8px 2px", width: "100%", outline: "none", fontSize: 15 };

  const [capital, setCapital] = useLocalStorage("wt_frais_capital", invested > 0 ? Math.round(invested) : 10000);
  const [horizon, setHorizon] = useLocalStorage("wt_frais_horizon", 20);
  const [horizonStr, setHorizonStr] = useState(String(20));
  const [feeRate, setFeeRate] = useLocalStorage("wt_frais_feerate", 1.8);
  const [expanded, setExpanded] = useState(null);
  const [itemRates, setItemRates] = useLocalStorage("wt_frais_item_rates", {});
  const [placementsOpen, setPlacementsOpen] = useState(false);
  const glossaireRef = useRef(null);
  const scrollToGlossaire = () => glossaireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const hasRealData = invested > 0;
  const hasItems = investItems.length > 0;
  const useRealCapital = () => setCapital(Math.round(invested));

  const getItemRate = (item) => {
    const key = item.label || item.name || "";
    return itemRates[key] ?? guessRate(key);
  };

  const setItemRate = (item, rate) => {
    const key = item.label || item.name || "";
    setItemRates(prev => ({ ...prev, [key]: rate }));
  };

  // Taux pondéré par valeur de marché
  const weightedFeeRate = useMemo(() => {
    if (!hasItems) return null;
    const totalVal = investItems.reduce((s, i) => s + (i.value || 0), 0);
    if (!totalVal) return null;
    return investItems.reduce((s, i) => s + ((i.value || 0) / totalVal) * getItemRate(i), 0);
  }, [investItems, itemRates]);

  // Taux effectif : pondéré si items présents, sinon slider
  const effectiveFeeRate = weightedFeeRate ?? feeRate;
  const realAnnualCost = Math.round(invested * (effectiveFeeRate / 100));

  const impactData = useMemo(() => {
    const sans = fv(capital, 0, RATE_ETF_WORLD, horizon);
    const avec = fv(capital, 0, RATE_ETF_WORLD - effectiveFeeRate / 100, horizon);
    const perte = sans - avec;
    const pct = ((perte / sans) * 100).toFixed(0);
    return { sans, avec, perte, pct };
  }, [capital, horizon, effectiveFeeRate]);

  const chartData = useMemo(() => (
    Array.from({ length: horizon + 1 }, (_, y) => ({
      y,
      sans: Math.round(fv(capital, 0, RATE_ETF_WORLD, y)),
      avec: Math.round(fv(capital, 0, RATE_ETF_WORLD - effectiveFeeRate / 100, y)),
    }))
  ), [capital, horizon, effectiveFeeRate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Percent size={22} style={{ color: "#ef4444" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: T.text, fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Mes frais</h1>
          </div>
          <button onClick={scrollToGlossaire}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 10px", border: "none", background: "transparent", color: T.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <BookOpen size={15} /> Glossaire
          </button>
        </div>

      </div>

      {/* Simulateur d'impact */}
      <Section T={T} first title="Combien les frais vous coûtent">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 0, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>

          {/* Colonne gauche — placements + saisies */}
          <div style={{ padding: "24px", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 20, overflow: "auto" }}>

            {/* Vos placements */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Wallet size={15} style={{ color: hasRealData ? T.blue : T.muted, flexShrink: 0 }} />
                <span style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vos placements</span>
                {hasItems && <span style={{ color: T.text, fontSize: 12, fontWeight: 700, marginLeft: "auto" }}>{eur(invested)}</span>}
              </div>
              {hasItems ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 76px", gap: 8, marginBottom: 4, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Placement</span>
                    <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "right" }}>Valeur</span>
                    <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "right" }}>Frais</span>
                  </div>
                  {investItems.map((item, i) => {
                    const key = item.label || item.name || "";
                    const rate = getItemRate(item);
                    const isGuess = itemRates[key] == null;
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 76px", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < investItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ color: T.text, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key || "—"}</div>
                        <div style={{ color: T.muted, fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>{eur(item.value)}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                          <input type="number" min={0} max={5} step={0.1} value={rate}
                            title={isGuess ? "Taux estimé" : undefined}
                            onChange={(e) => setItemRate(item, +e.target.value || 0)}
                            style={{ background: "transparent", border: `1px solid ${isGuess ? T.border : T.blue}`, borderRadius: 6, color: T.text, padding: "3px 5px", width: 44, fontSize: 12, textAlign: "right", outline: "none" }} />
                          <span style={{ color: T.muted, fontSize: 12 }}>%</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 12, color: T.muted }}>
                    Frais pondérés <strong style={{ color: T.text }}>{effectiveFeeRate.toFixed(2).replace(".", ",")} %/an</strong>
                    {" · "}<strong style={{ color: "#ef4444" }}>{eur(realAnnualCost)}/an</strong>
                  </div>
                  {setView && (
                    <button onClick={() => setView("patrimoine")}
                      style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}>
                      Modifier dans Patrimoine <ArrowRight size={11} />
                    </button>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ color: T.muted, fontSize: 13 }}>
                    {hasRealData ? `${eur(invested)} importés — taux global estimé` : "Aucun placement renseigné."}
                  </div>
                  {setView && (
                    <button onClick={() => setView("patrimoine")}
                      style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(91,141,239,0.1)", border: `1px solid ${T.blue}44`, color: T.blue, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8 }}>
                      {hasRealData ? "Détailler mes placements" : "Saisir mes placements"} <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${T.border}` }} />

            {/* Capital initial */}
            <div>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Capital initial</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <input type="number" value={capital || ""} placeholder="0" style={{ ...uStyle, fontSize: 28, fontWeight: 700 }}
                  onFocus={(e) => e.target.select()} onChange={(e) => setCapital(+e.target.value || 0)} />
                <span style={{ color: T.muted, fontSize: 16 }}>€</span>
              </div>
              {hasRealData && Math.round(invested) !== capital && (
                <button onClick={useRealCapital}
                  style={{ marginTop: 6, background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600 }}>
                  Utiliser mes placements ({eur(invested)})
                </button>
              )}
            </div>

            {/* Horizon */}
            <div>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Horizon de placement</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <input type="number" min={1} max={50} value={horizonStr} placeholder="20"
                  style={{ ...uStyle, fontSize: 28, fontWeight: 700, width: 80 }}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setHorizonStr(e.target.value)}
                  onBlur={(e) => {
                    const v = Math.min(50, Math.max(1, +e.target.value || horizon));
                    setHorizon(v);
                    setHorizonStr(String(v));
                  }} />
                <span style={{ color: T.muted, fontSize: 16 }}>ans</span>
              </div>
            </div>

            {/* Taux de frais */}
            <div>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Taux de frais</div>
              {hasItems ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ color: T.text, fontSize: 28, fontWeight: 700 }}>{effectiveFeeRate.toFixed(2).replace(".", ",")}</span>
                  <span style={{ color: T.muted, fontSize: 16 }}>%</span>
                  <span style={{ color: T.muted, fontSize: 12, marginLeft: 4 }}>pondérés</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                    <span style={{ color: T.text, fontSize: 28, fontWeight: 700 }}>{feeRate.toFixed(1).replace(".", ",")}</span>
                    <span style={{ color: T.muted, fontSize: 16 }}>%</span>
                  </div>
                  <input type="range" min={0} max={3} step={0.1} value={feeRate}
                    onChange={(e) => setFeeRate(+e.target.value)}
                    style={{ width: "100%", accentColor: T.blue }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
                    <span>0 %</span><span>1,5 %</span><span>3 %</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Colonne droite — résultat + graphique */}
          <div style={{ padding: "28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Résultat principal */}
            <div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: 4 }}>Manque à gagner</div>
              <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 36, letterSpacing: "-0.02em", lineHeight: 1 }}>
                − {eur(impactData.perte)}
              </div>
              <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>après {horizon} ans · {impactData.pct} % de capital en moins</div>
            </div>
            {/* Graphique */}
            <div style={{ flex: 1, minHeight: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
                  <XAxis dataKey="y" tick={{ fill: T.muted, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false}
                    tickFormatter={v => `${v} ans`} interval={Math.floor(horizon / 4)} />
                  <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} width={60}
                    tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M €` : `${Math.round(v/1000)}k €`} />
                  <Tooltip
                    cursor={{ stroke: T.border, strokeDasharray: "3 2" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const yr = payload[0]?.payload?.y;
                      const sans = payload.find(p => p.dataKey === "sans")?.value ?? 0;
                      const avec = payload.find(p => p.dataKey === "avec")?.value ?? 0;
                      const perte = sans - avec;
                      return (
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", minWidth: 180 }}>
                          <div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>Dans {yr} an{yr > 1 ? "s" : ""}</div>
                          <div style={{ color: T.text, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", marginBottom: 12 }}>{eur(avec)}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: 13 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.text, display: "inline-block" }} />ETF 0,25 %/an
                              </span>
                              <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{eur(sans)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: 13 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />Frais perdus
                              </span>
                              <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>−{eur(perte)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line dataKey="sans" stroke={T.text} strokeWidth={2} dot={false} />
                  <Line dataKey="avec" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 3" strokeOpacity={0.75} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Section>

      {/* Comparatif enveloppes — grille de cartes */}
      <Section T={T} title="Comparer les frais par enveloppe">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {DEVICES.map((d) => {
            const isOpen = expanded === d.id;
            return (
              <button key={d.id} onClick={() => setExpanded(isOpen ? null : d.id)}
                style={{
                  background: T.panel,
                  border: `1px solid ${isOpen ? T.blue + "55" : T.border}`,
                  borderLeft: `3px solid ${d.color}`,
                  borderRadius: 12,
                  padding: "16px 18px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{d.label}</span>
                <div>
                  <div style={{ color: T.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Frais annuels</div>
                  <div style={{ color: T.text, fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em" }}>{d.annuelsRange}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: T.muted, fontSize: 12 }}>Entrée</span>
                  <span style={{ color: T.muted, fontSize: 12, fontWeight: 600 }}>{d.entreeRange}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Panneau détail */}
        {expanded && (() => {
          const d = DEVICES.find(x => x.id === expanded);
          if (!d) return null;
          return (
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderLeft: `3px solid ${d.color}`, borderRadius: 12, padding: "20px 24px", marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>{d.label}</span>
                <span style={{ color: T.muted, fontSize: 13 }}>{d.annuelsRange}/an</span>
                {d.fraisEntree > 0 && <span style={{ color: T.muted, fontSize: 13 }}>· Entrée {d.entreeRange}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Avantages</div>
                  {d.avantages.map((a) => (
                    <div key={a} style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>· {a}</div>
                  ))}
                </div>
                <div>
                  <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Limites</div>
                  {d.inconvenients.map((i) => (
                    <div key={i} style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>· {i}</div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        <p style={{ color: T.muted, fontSize: 12, marginTop: 8 }}>
          Fourchettes <strong style={{ color: T.text }}>moyennes du marché</strong>, à titre indicatif. Frais réels dépendent du contrat et du courtier.
        </p>
      </Section>

      {/* Note OPCVM */}
      <div style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: 16 }}>
        <div style={{ color: T.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Fonds actifs : attention aux frais cachés</div>
        <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.7, maxWidth: 760 }}>
          Plus de 8 fonds gérés activement sur 10 font moins bien qu'un simple ETF sur 10 ans (S&P SPIVA).
          1 % de frais en plus pendant 30 ans représente environ <strong style={{ color: T.text }}>26 % de capital en moins</strong>.
        </div>
      </div>

      {/* Glossaire */}
      <div ref={glossaireRef} style={{ scrollMarginTop: 16 }}>
        <Section T={T} title="Le vocabulaire des frais, expliqué simplement">
          {GLOSSAIRE.map((g) => <GlossaireItem key={g.term} term={g.term} def={g.def} />)}
        </Section>
      </div>
    </div>
  );
}
