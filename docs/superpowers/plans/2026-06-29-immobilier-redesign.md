# Immobilier Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraire et refondre le composant Immobilier — navigation par mode cards luxe, hero KPIs par mode, sections accordéon, graphique locatif ajouté, dans un fichier dédié `src/Immobilier.jsx`.

**Architecture:** Le composant `Immobilier` quitte App.jsx (4515–5550) et devient `src/Immobilier.jsx`. Il contient trois sous-sections inline (`ResidenceSection`, `LocatifSection`, `LocationSection`), un composant `AccordionSection` partagé, et un `ModeCard`. Les constantes locales (`TAUX_TF_PAR_DEPT`, `detectProfileType`, `PROFILE_CONFIG`, `eur`, `SIM_START_YEAR`) sont redéfinies dans le nouveau fichier — elles n'en sortiront pas, pas de circular dep. App.jsx les supprime et importe Immobilier depuis `./Immobilier.jsx`.

**Tech Stack:** React 18, Recharts, Lucide React, Tailwind CDN, `./finance.js` (fv, loanRemaining, loanFromPayment, immoDetailedSeries, RATE_A), `./ui.jsx` (Card, Field, MiniStat, makeChartTip, makeInputStyle), `./ChartComponents.jsx` (ExpandableChart), `./ThemeProvider.jsx` (useT), `./InfoTooltip.jsx`.

---

## File map

| Fichier | Action | Contenu |
|---|---|---|
| `src/Immobilier.jsx` | **Créer** | Composant complet — mode selector, hero KPIs, accordion, 3 modes |
| `src/App.jsx` | **Modifier** | Supprimer fn Immobilier (l.4515–5550) + 2 constantes TAUX_TF (l.3869–3877) + ajouter import |

---

## Task 1 — Créer src/Immobilier.jsx : squelette + mode selector

**Files:**
- Create: `src/Immobilier.jsx`

- [ ] **Créer le fichier avec imports + helpers locaux**

```jsx
// src/Immobilier.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useT } from "./ThemeProvider.jsx";
import InfoTooltip from "./InfoTooltip.jsx";
import { Card, Field, MiniStat, makeChartTip, makeInputStyle } from "./ui.jsx";
import { ExpandableChart } from "./ChartComponents.jsx";
import { NumInput } from "./NumInput.jsx";
import {
  Home, Building2, Key, TrendingUp, Wallet, Landmark, FileText,
  AlertTriangle, ChevronDown, ChevronUp, ChevronLeft,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  RATE_A, fv, loanRemaining, loanFromPayment, immoDetailedSeries,
} from "./finance.js";

const SIM_START_YEAR = 2026;

const eur = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.round(Number.isFinite(n) ? n : 0)
  ) + " €";

const TAUX_TF_PAR_DEPT = {
  "75": 13.5,
  "92": 22, "93": 28, "94": 24,
  "77": 30, "78": 26, "91": 32, "95": 33,
  "69": 38, "13": 44, "31": 42, "33": 41,
  "44": 40, "59": 46, "67": 36, "34": 43,
  "35": 40, "06": 30, "38": 41, "76": 45,
};
const TAUX_TF_DEFAUT = 46;

function detectProfileType(transactions) {
  const revenues = transactions.filter((t) => t.type === "revenu");
  if (revenues.some((t) => t.cat === "Freelance") || transactions.some((t) => t.cat === "Frais pro")) {
    return "independant";
  }
  if (revenues.some((t) => /int[ée]rim/i.test(t.label))) return "interimaire";
  return "salarie_stable";
}

const PROFILE_CONFIG = {
  salarie_stable: { label: "Salarié CDI", color: "#22c79a", revenueRatio: 1.0, capacityMult: 1.0, note: null },
  interimaire:    { label: "Intérimaire / Variable", color: "#f5a623", revenueRatio: 0.85, capacityMult: 0.7,
    note: "Revenu variable : les banques retiennent 85 % de vos revenus et réduisent la capacité de 30 %. Un apport conséquent améliorait votre dossier." },
  independant:    { label: "Indépendant / Freelance", color: "#f5a623", revenueRatio: 0.70, capacityMult: 0.5,
    note: "Statut indépendant : les banques retiennent 70 % des revenus déclarés et exigent 2–3 ans de bilans comptables." },
};
```

- [ ] **Créer AccordionSection — composant partagé pour les sections pliables**

```jsx
function AccordionSection({ accentColor, title, desc, summaryValue, summaryColor, defaultOpen = false, children }) {
  const T = useT();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: T.panel,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ width: 3, height: 34, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
          {desc && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{desc}</div>}
        </div>
        {summaryValue && !open && (
          <span style={{ fontSize: 14, fontWeight: 800, color: summaryColor || T.text }}>
            {summaryValue}
          </span>
        )}
        <span style={{ color: T.muted, fontSize: 16, flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 20px 20px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Créer ModeCard — carte de sélection de mode**

```jsx
function ModeCard({ icon: Icon, label, desc, active, onClick }) {
  const T = useT();
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(59,130,246,0.08)" : T.panel,
        border: `1px solid ${active ? "rgba(59,130,246,0.4)" : T.border}`,
        borderRadius: 14,
        padding: "18px 16px",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {active && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 2, background: T.blue,
        }} />
      )}
      <div style={{
        width: 36, height: 36, borderRadius: 9, marginBottom: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
      }}>
        <Icon size={18} color={active ? T.blue : T.muted} strokeWidth={1.8} />
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
        textTransform: "uppercase", color: active ? T.blue : T.muted, marginBottom: 5,
      }}>{label}</div>
      <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{desc}</div>
    </button>
  );
}
```

- [ ] **Créer le shell principal du composant Immobilier avec mode selector**

```jsx
export default function Immobilier({ totals, simParams, patrimoine, transactions, setView }) {
  const T = useT();
  const [mode, setMode] = useState("residence");

  const netWorth = useMemo(() => {
    const a = (patrimoine?.actifs || []).flatMap((c) => c.items || []).reduce((s, i) => s + (i.value || 0), 0);
    const p = (patrimoine?.passifs || []).flatMap((c) => c.items || []).reduce((s, i) => s + (i.value || 0), 0);
    return a - p;
  }, [patrimoine]);

  const profileType = useMemo(() => detectProfileType(transactions || []), [transactions]);
  const bCfg = PROFILE_CONFIG[profileType];
  const revenueForBank = Math.round(totals.revenus * bCfg.revenueRatio);

  const autoCredits = useMemo(() =>
    Math.abs((transactions || [])
      .filter((t) => t.type === "charge_fixe" && (t.cat === "Remboursements" || /pr[eê]t|cr[eé]dit|emprunt/i.test(t.label || "")))
      .reduce((s, t) => s + (t.amount || 0), 0)),
    [transactions]
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div>
        {setView && (
          <button
            onClick={() => setView("simulations")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "8px 14px", color: T.text,
              cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            <ChevronLeft size={16} style={{ color: T.blue }} />
            Retour aux Simulations
          </button>
        )}
        <h1 className="text-3xl font-bold" style={{ color: T.text }}>Simulateur Immobilier</h1>
        <p style={{ color: T.muted }}>Analysez un projet d'achat, calculez votre capacité et optimisez votre investissement.</p>
      </div>

      {/* Mode selector — 3 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <ModeCard
          icon={Home} label="Résidence principale" desc="Achat, mensualité, achat vs location"
          active={mode === "residence"} onClick={() => setMode("residence")}
        />
        <ModeCard
          icon={Building2} label="Investissement locatif" desc="Rendement, cash-flow, crédit investisseur"
          active={mode === "locatif"} onClick={() => setMode("locatif")}
        />
        <ModeCard
          icon={Key} label="Mettre en location" desc="Bien existant, LMNP, imposition nette"
          active={mode === "location"} onClick={() => setMode("location")}
        />
      </div>

      {mode === "residence" && (
        <ResidenceSection
          T={T} netWorth={netWorth} revenueForBank={revenueForBank} bCfg={bCfg}
          profileType={profileType} autoCredits={autoCredits} simParams={simParams}
          transactions={transactions}
        />
      )}
      {mode === "locatif" && (
        <LocatifSection
          T={T} revenueForBank={revenueForBank} bCfg={bCfg}
          profileType={profileType} autoCredits={autoCredits}
        />
      )}
      {mode === "location" && (
        <LocationSection T={T} />
      )}
    </div>
  );
}
```

- [ ] **Vérifier que le fichier est syntaxiquement correct (pas encore importé)**

```bash
node --input-type=module < /dev/null || true
# Juste vérifier qu'il n'y a pas d'erreur de syntaxe évidente — compilation Vite le confirmera
```

---

## Task 2 — ResidenceSection : hero KPIs + sections accordéon

**Files:**
- Modify: `src/Immobilier.jsx` — ajouter ResidenceSection avant export default

- [ ] **Ajouter ResidenceSection avec tous les états locaux**

```jsx
function ResidenceSection({ T, netWorth, revenueForBank, bCfg, profileType, autoCredits, simParams }) {
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);

  const [creditsManual, setCreditsManual] = useState(null);
  const creditsExistants = creditsManual !== null ? creditsManual : autoCredits;
  const mensualiteMax = Math.max(0, Math.round(revenueForBank * 0.35 * bCfg.capacityMult - creditsExistants));
  const loan20 = Math.round(loanFromPayment(mensualiteMax, 0.035, 20));
  const loan25 = Math.round(loanFromPayment(mensualiteMax, 0.037, 25));

  const [price, setPrice] = useState(300000);
  const [apportPct, setApportPct] = useState(20);
  const [rate, setRate] = useState(3.8);
  const [duration, setDuration] = useState(20);
  const [appreciation, setAppreciation] = useState(2.5);
  const [rentMonthly, setRentMonthly] = useState(1200);
  const [resChargesProprio, setResChargesProprio] = useState(300);
  const [showRentVsBuy, setShowRentVsBuy] = useState(false);

  const totalApport = Math.round(price * apportPct / 100);
  const notaire = Math.round(price * 0.08);
  const apportSurBien = Math.max(0, totalApport - notaire);
  const credit = price - apportSurBien;
  const monthlyRate = rate / 100 / 12;
  const n = duration * 12;
  const mensualite = monthlyRate > 0
    ? Math.round(credit * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)))
    : Math.round(credit / n);
  const totalInterest = Math.max(0, mensualite * n - credit);
  const liquidNetWorth = netWorth * 0.8;
  const canAfford = liquidNetWorth >= totalApport;
  const affordGap = totalApport - liquidNetWorth;
  const effortProprietaire = mensualite + resChargesProprio;
  const investMonthly = Math.max(0, effortProprietaire - rentMonthly);
  const ecartAchatMoinsCher = Math.max(0, rentMonthly - effortProprietaire);

  const ownershipSeries = useMemo(() => Array.from({ length: duration + 1 }, (_, y) => {
    const propValue = Math.round(price * Math.pow(1 + appreciation / 100, y));
    const remaining = loanRemaining(credit, rate / 100, duration, y * 12);
    const equity = propValue - remaining;
    const renterFV = Math.round(fv(0, investMonthly, RATE_A, y));
    return { year: SIM_START_YEAR + y, propValue, "Propriété nette": Math.max(0, equity), "Patrimoine locataire": renterFV };
  }), [price, appreciation, credit, rate, duration, investMonthly]);

  const finalEquity = ownershipSeries[ownershipSeries.length - 1]["Propriété nette"] || 0;
  const finalPropValue = ownershipSeries[ownershipSeries.length - 1].propValue || 0;
  const finalRenterFV = ownershipSeries[ownershipSeries.length - 1]["Patrimoine locataire"] || 0;
```

- [ ] **Ajouter le bloc Hero KPIs résidence**

```jsx
  // Hero KPIs résidence — ajouter dans le return de ResidenceSection
  // Insérer AVANT les AccordionSections :
  return (
    <>
      {/* Hero KPIs */}
      <div style={{
        background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: "22px 28px",
        display: "flex", alignItems: "center", gap: 0,
      }}>
        {[
          { label: "Capacité d'emprunt · 20 ans", value: eur(loan20), color: T.cyan, sub: `mensualité max ${eur(mensualiteMax)}/mois` },
          { label: "Mensualité simulée", value: eur(mensualite), color: T.amber, sub: `${rate} % · ${duration} ans` },
          { label: `Patrimoine net à ${duration} ans`, value: eur(finalEquity), color: T.green, sub: `+${appreciation} %/an valorisation` },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, padding: "0 24px",
            ...(i === 0 ? { paddingLeft: 0 } : { borderLeft: `1px solid ${T.border}` }),
          }}>
            <div style={{ fontSize: 11, color: T.muted, fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
        <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 24, flexShrink: 0 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: canAfford ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${canAfford ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 999, padding: "4px 12px",
            fontSize: 12, fontWeight: 700, color: canAfford ? T.green : T.red,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {canAfford ? "Apport OK" : "Apport insuffisant"}
          </span>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
            {canAfford ? `Marge : +${eur(Math.round(-affordGap))}` : `Manque : ${eur(Math.round(affordGap))}`}
          </div>
        </div>
      </div>
```

- [ ] **Ajouter les 4 AccordionSections résidence**

```jsx
      {/* Sections accordéon */}
      <div className="flex flex-col gap-3">

        {/* 1 — Capacité d'emprunt */}
        <AccordionSection
          accentColor={T.cyan}
          title="Capacité d'emprunt"
          desc="Règle des 35 % HCSF · profil détecté · crédits existants"
          summaryValue={eur(loan20)}
          summaryColor={T.cyan}
          defaultOpen={false}
        >
          {/* Contenu identique à l'ancienne Card "Capacité d'Emprunt Maximale" */}
          <div style={{
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
            borderRadius: 12, padding: "10px 16px", marginBottom: 16,
            background: profileType === "salarie_stable" ? "rgba(34,199,154,0.06)" : "rgba(245,166,35,0.06)",
            border: `1px solid ${profileType === "salarie_stable" ? "rgba(34,199,154,0.3)" : "rgba(245,166,35,0.3)"}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: bCfg.color }}>Profil : {bCfg.label}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted }}>
              Revenu retenu : <b style={{ color: T.text }}>{eur(revenueForBank)}</b>
              {bCfg.revenueRatio < 1 && ` · ${Math.round(bCfg.revenueRatio * 100)} % du brut`}
            </span>
          </div>
          {bCfg.note && (
            <div style={{ borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.25)", color: T.amber }}>
              {bCfg.note}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <MiniStat label="Revenus nets mensuels" value={eur(revenueForBank)} />
            <div style={{ borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, marginBottom: 6, color: T.muted }}>Crédits existants hors immo</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NumInput min={0} value={creditsExistants} onChange={(n) => setCreditsManual(n)}
                  style={{ ...inputStyle, padding: "4px 8px", fontSize: 14, fontWeight: 700, color: T.amber, width: "100%" }} />
                <span style={{ fontSize: 12, color: T.muted }}>€/mois</span>
              </div>
              {creditsManual !== null && (
                <button style={{ fontSize: 12, marginTop: 4, color: T.muted, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  onClick={() => setCreditsManual(null)}>
                  Remettre auto ({eur(autoCredits)})
                </button>
              )}
            </div>
            <MiniStat label="Mensualité disponible" value={eur(mensualiteMax)} color={mensualiteMax > 0 ? T.green : T.red} />
          </div>
          <div style={{ borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 12, fontFamily: "monospace", display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center", background: "rgba(47,155,255,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
            <span style={{ color: T.text }}>Mensualité max</span><span>=</span>
            <span style={{ color: T.green }}>{eur(revenueForBank)} × 35%{bCfg.capacityMult < 1 ? ` × ${Math.round(bCfg.capacityMult * 100)}%` : ""}</span>
            {creditsExistants > 0 && <><span>−</span><span style={{ color: T.amber }}>{eur(creditsExistants)} crédits</span></>}
            <span>=</span><span style={{ color: mensualiteMax > 0 ? T.cyan : T.red, fontWeight: 700 }}>{eur(mensualiteMax)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card style={{ background: "rgba(59,130,246,0.05)" }}>
              <div style={{ fontSize: 13, color: T.muted }}>Sur <b>20 ans</b> à 3,5 %</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: loan20 > 0 ? T.cyan : T.muted }}>{eur(loan20)}</div>
              <div style={{ fontSize: 11, color: T.muted }}>mensualité : {eur(mensualiteMax)}</div>
            </Card>
            <Card style={{ background: "rgba(34,199,154,0.05)" }}>
              <div style={{ fontSize: 13, color: T.muted }}>Sur <b>25 ans</b> à 3,7 %</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: loan25 > 0 ? T.green : T.muted }}>{eur(loan25)}</div>
              <div style={{ fontSize: 11, color: T.muted }}>mensualité : {eur(mensualiteMax)}</div>
            </Card>
          </div>
        </AccordionSection>

        {/* 2 — Paramètres du projet */}
        <AccordionSection
          accentColor={T.blue}
          title="Paramètres du projet"
          desc="Prix, apport, taux, durée, appréciation annuelle"
          summaryValue={eur(price)}
          summaryColor={T.blue}
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Prix du bien (€)">
              <NumInput value={price} style={inputStyle} onChange={(n) => setPrice(n)} />
            </Field>
            <Field label={`Apport total, notaire inclus (${apportPct} % = ${eur(totalApport)})`}>
              <input type="range" min={5} max={50} step={1} value={apportPct}
                onChange={(e) => setApportPct(+e.target.value)} className="w-full" style={{ accentColor: T.blue }} />
            </Field>
            <Field label="Taux crédit (% / an)">
              <NumInput value={rate} step={0.1} style={inputStyle} onChange={(n) => setRate(n)} />
            </Field>
            <Field label="Durée du crédit">
              <select value={duration} style={inputStyle} onChange={(e) => setDuration(+e.target.value)}>
                {[10, 15, 20, 25, 30].map((d) => <option key={d} value={d}>{d} ans</option>)}
              </select>
            </Field>
            <Field label="Appréciation annuelle (%)">
              <NumInput value={appreciation} step={0.5} style={inputStyle} onChange={(n) => setAppreciation(n)} />
            </Field>
          </div>
        </AccordionSection>

        {/* 3 — Structure du financement */}
        <AccordionSection
          accentColor={T.amber}
          title="Structure du financement"
          desc="Apport · frais de notaire · crédit · coût total"
          summaryValue={`${eur(mensualite)}/mois`}
          summaryColor={T.amber}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MiniStat label="Montant emprunté" value={eur(credit)} color={T.amber} />
            <MiniStat label="Avec apport" value={eur(totalApport)} color={T.cyan} />
            <MiniStat label="Dont frais de notaire" value={eur(notaire)} color={T.muted} />
            <MiniStat label="Dont sur le bien" value={eur(apportSurBien)} color={T.blue} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted }}>Mensualité crédit</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: T.text }}>{eur(mensualite)}</div>
              <div style={{ fontSize: 12, color: T.muted }}>sur {duration} ans à {rate} %</div>
            </div>
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted }}>Coût total du crédit</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: T.amber }}>{eur(credit + totalInterest)}</div>
              <div style={{ fontSize: 12, color: T.muted }}>dont intérêts : {eur(Math.round(totalInterest))}</div>
            </div>
          </div>
          {/* Bloc affordabilité */}
          <div style={{ borderRadius: 12, padding: 16, background: canAfford ? "rgba(34,199,154,0.06)" : "rgba(255,90,95,0.06)", border: `1px solid ${canAfford ? T.green + "44" : T.red + "44"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: canAfford ? T.green : T.red }}>
                {canAfford ? "Apport finançable" : "Apport insuffisant"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {canAfford ? `Marge : ${eur(Math.round(-affordGap))}` : `Manque : ${eur(Math.round(affordGap))}`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted }}>
              <span>Patrimoine liquide estimé : <b style={{ color: T.text }}>{eur(Math.round(liquidNetWorth))}</b></span>
              <span>Apport requis : <b style={{ color: T.text }}>{eur(totalApport)}</b></span>
            </div>
            {!canAfford && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: T.muted }}>
                <div>• Attendre {Math.ceil(affordGap / (simParams?.monthly || 1000))} mois d'épargne</div>
                <div>• Réduire l'apport à {Math.max(10, Math.floor((liquidNetWorth / price) * 100))} %</div>
                <div>• Rechercher un bien à {eur(Math.round(liquidNetWorth / (apportPct / 100)))} max</div>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 4 — Projection */}
        <AccordionSection
          accentColor={T.green}
          title={`Projection sur ${duration} ans`}
          desc="Valeur du bien · patrimoine net · comparaison achat vs location"
          summaryValue={eur(finalEquity)}
          summaryColor={T.green}
          defaultOpen={false}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginBottom: 16, userSelect: "none" }}>
            <input type="checkbox" checked={showRentVsBuy} onChange={(e) => setShowRentVsBuy(e.target.checked)}
              style={{ accentColor: T.green, width: 14, height: 14 }} />
            <span style={{ color: showRentVsBuy ? T.green : T.muted }}>Comparer avec la location</span>
          </label>
          {showRentVsBuy && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Loyer mensuel (si vous louiez)">
                  <NumInput value={rentMonthly} style={inputStyle} onChange={(n) => setRentMonthly(n)} />
                </Field>
                <Field label={<>Charges propriétaire (€/mois)<InfoTooltip text="Taxe foncière, assurance habitation, entretien et charges de copropriété." align="left" /></>}>
                  <NumInput value={resChargesProprio} style={inputStyle} onChange={(n) => setResChargesProprio(n)} />
                </Field>
              </div>
              <div style={{ borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, display: "flex", flexWrap: "wrap", gap: "4px 8px", alignItems: "center", background: "rgba(34,211,238,0.05)", border: `1px solid ${T.cyan}33`, color: T.muted }}>
                {investMonthly > 0 ? (
                  <>
                    <span>Effort proprio</span><span style={{ color: T.text }}>{eur(effortProprietaire)}/mois</span>
                    <span>− loyer</span><span style={{ color: T.text }}>{eur(rentMonthly)}/mois</span>
                    <span>=</span>
                    <span style={{ color: T.cyan, fontWeight: 700 }}>{eur(investMonthly)}/mois investis en ETF par le locataire</span>
                  </>
                ) : (
                  <span>Acheter coûte {eur(ecartAchatMoinsCher)}/mois de moins que louer.</span>
                )}
              </div>
            </>
          )}
          <ExpandableChart height={260} title="Constitution de patrimoine immobilier">
            <LineChart data={ownershipSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis stroke={T.muted} tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + "k€" : v} />
              <Tooltip {...chartTip} formatter={(v) => eur(v)} />
              <Line type="monotone" dataKey="Propriété nette" stroke={T.amber} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="propValue" name="Valeur du bien" stroke={T.muted} strokeWidth={1.5} dot={false} />
              {showRentVsBuy && <Line type="monotone" dataKey="Patrimoine locataire" stroke={T.cyan} strokeWidth={2} dot={false} />}
            </LineChart>
          </ExpandableChart>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            <div style={{ borderRadius: 10, padding: 12, textAlign: "center", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, marginBottom: 4, color: T.muted }}>Valeur du bien à {duration} ans</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.amber }}>{eur(finalPropValue)}</div>
            </div>
            <div style={{ borderRadius: 10, padding: 12, textAlign: "center", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, marginBottom: 4, color: T.muted }}>Patrimoine net immobilier</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{eur(finalEquity)}</div>
            </div>
            {showRentVsBuy ? (
              <div style={{ borderRadius: 10, padding: 12, textAlign: "center", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.3)" }}>
                <div style={{ fontSize: 11, marginBottom: 4, color: T.muted }}>Patrimoine locataire</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.cyan }}>{eur(finalRenterFV)}</div>
              </div>
            ) : (
              <div style={{ borderRadius: 10, padding: 12, textAlign: "center", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, marginBottom: 4, color: T.muted }}>Intérêts payés</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.red }}>{eur(Math.round(totalInterest))}</div>
              </div>
            )}
          </div>
          {showRentVsBuy && (
            <>
              <div style={{ marginTop: 12, borderRadius: 10, padding: 12, fontSize: 13, background: finalEquity > finalRenterFV ? "rgba(34,199,154,0.06)" : "rgba(56,189,248,0.06)", border: `1px solid ${finalEquity > finalRenterFV ? T.green + "44" : T.cyan + "44"}` }}>
                <span style={{ color: finalEquity > finalRenterFV ? T.green : T.cyan }}>
                  {finalEquity > finalRenterFV
                    ? `L'achat génère ${eur(finalEquity - finalRenterFV)} de plus qu'investir en ETF en tant que locataire.`
                    : `La location + ETF génère ${eur(finalRenterFV - finalEquity)} de plus. Les deux stratégies sont proches.`}
                </span>
              </div>
              <p style={{ marginTop: 8, fontSize: 11, color: T.muted }}>
                Note fiscale : le capital ETF est affiché brut (avant flat tax 30 % en cas de retrait), alors que la plus-value sur résidence principale est exonérée d'impôt.
              </p>
            </>
          )}
        </AccordionSection>

      </div>
    </>
  );
}
```

- [ ] **Vérifier visuellement dans le navigateur : mode résidence fonctionnel**

```bash
npm run dev
# Naviguer vers Immobilier — vérifier les 3 mode cards, le hero KPIs, les accordéons
```

---

## Task 3 — LocatifSection : hero KPIs + accordéon + graphique de projection

**Files:**
- Modify: `src/Immobilier.jsx` — ajouter LocatifSection avant ResidenceSection

- [ ] **Ajouter LocatifSection avec états locaux et calculs**

```jsx
function LocatifSection({ T, revenueForBank, bCfg, autoCredits }) {
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);

  const creditsExistants = autoCredits;
  const mensualiteMax = Math.max(0, Math.round(revenueForBank * 0.35 * bCfg.capacityMult - creditsExistants));

  const [locPrice, setLocPrice] = useState(120000);
  const [locApportPct, setLocApportPct] = useState(20);
  const [locRate, setLocRate] = useState(3.8);
  const [locDuration, setLocDuration] = useState(20);
  const [locLoyer, setLocLoyer] = useState(700);
  const [locCharges, setLocCharges] = useState(60);
  const [locTaxeFonciere, setLocTaxeFonciere] = useState(800);
  const [locVacance, setLocVacance] = useState(1);
  const [locAssurancePNO, setLocAssurancePNO] = useState(100);
  const [locAssuranceEmprunteurPct, setLocAssuranceEmprunteurPct] = useState(0.30);
  const [locAppreciation, setLocAppreciation] = useState(2);

  const locTotalApport = Math.round(locPrice * locApportPct / 100);
  const locNotaire = Math.round(locPrice * 0.08);
  const locApportSurBien = Math.max(0, locTotalApport - locNotaire);
  const locCredit = locPrice - locApportSurBien;
  const locMonthlyRate = locRate / 100 / 12;
  const locN = locDuration * 12;
  const locMensualite = locMonthlyRate > 0
    ? Math.round(locCredit * locMonthlyRate / (1 - Math.pow(1 + locMonthlyRate, -locN)))
    : Math.round(locCredit / locN);
  const locAssuranceEmprunteurMensuelle = Math.round(locCredit * (locAssuranceEmprunteurPct / 100) / 12);

  const loyerAnnuelBrut = locLoyer * 12;
  const moisOccupes = Math.max(0, 12 - locVacance);
  const loyerAnnuelEffectif = locLoyer * moisOccupes;
  const loyerMensuelEffectif = loyerAnnuelEffectif / 12;
  const locInvestissementTotal = locPrice + locNotaire;
  const locChargesAnnuelles = locCharges * 12 + locTaxeFonciere + locAssurancePNO;
  const rendementBrut = locInvestissementTotal > 0 ? (loyerAnnuelBrut / locInvestissementTotal) * 100 : 0;
  const rendementNet = locInvestissementTotal > 0 ? ((loyerAnnuelEffectif - locChargesAnnuelles) / locInvestissementTotal) * 100 : 0;
  const cashflowMensuel = loyerMensuelEffectif - locMensualite - locAssuranceEmprunteurMensuelle - locCharges - (locTaxeFonciere / 12) - (locAssurancePNO / 12);

  const mensualiteMaxAvecLoyer = mensualiteMax + Math.round(locLoyer * 0.7);
  const locBudgetSearch = Math.round(loanFromPayment(mensualiteMaxAvecLoyer, 0.037, 25));

  const rendementColor = (r) => r >= 6 ? T.green : r >= 3.5 ? T.amber : T.red;

  // Projection locative — valeur du bien + capital net sur la durée
  const locProjectionSeries = useMemo(() => Array.from({ length: locDuration + 1 }, (_, y) => {
    const propValue = Math.round(locPrice * Math.pow(1 + locAppreciation / 100, y));
    const remaining = loanRemaining(locCredit, locRate / 100, locDuration, y * 12);
    const equity = Math.max(0, propValue - remaining);
    return { year: SIM_START_YEAR + y, "Valeur du bien": propValue, "Capital net": equity };
  }), [locPrice, locCredit, locRate, locDuration, locAppreciation]);

  const locFinalEquity = locProjectionSeries[locProjectionSeries.length - 1]["Capital net"] || 0;
  const locFinalPropValue = locProjectionSeries[locProjectionSeries.length - 1]["Valeur du bien"] || 0;
```

- [ ] **Ajouter le hero KPIs locatif**

```jsx
  return (
    <>
      {/* Hero KPIs locatif */}
      <div style={{
        background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: "22px 28px",
        display: "flex", alignItems: "center", gap: 0,
      }}>
        {[
          { label: "Rendement brut", value: `${rendementBrut.toFixed(2)} %`, color: rendementColor(rendementBrut), sub: `loyers annuels / investissement total` },
          { label: "Rendement net", value: `${rendementNet.toFixed(2)} %`, color: rendementColor(rendementNet), sub: "après charges, hors crédit et fiscalité" },
          { label: "Cash-flow avant impôt", value: `${cashflowMensuel >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(cashflowMensuel)))}`, color: cashflowMensuel >= 0 ? T.green : T.red, sub: "par mois, toutes charges déduites" },
          { label: `Capital net à ${locDuration} ans`, value: eur(locFinalEquity), color: T.amber, sub: `bien vaut ${eur(locFinalPropValue)}` },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, padding: "0 20px",
            ...(i === 0 ? { paddingLeft: 0 } : { borderLeft: `1px solid ${T.border}` }),
          }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>
```

- [ ] **Ajouter sections accordéon locatif**

```jsx
      <div className="flex flex-col gap-3">

        {/* 1 — Capacité d'emprunt avec loyer */}
        <AccordionSection
          accentColor={T.cyan}
          title="Capacité d'emprunt investisseur"
          desc="Les banques intègrent 70 % du loyer prévisionnel dans le calcul du taux d'endettement"
          summaryValue={eur(locBudgetSearch)}
          summaryColor={T.cyan}
        >
          <div style={{ borderRadius: 10, padding: "12px 16px", background: T.panel, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <span style={{ color: T.blue, fontWeight: 700, fontSize: 13 }}>Avec ce loyer prévisionnel</span>
              <span style={{ color: T.text, fontWeight: 800 }}>{eur(mensualiteMaxAvecLoyer)} / mois</span>
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>
              Soit jusqu'à <b style={{ color: T.text }}>{eur(locBudgetSearch)}</b> empruntables sur 25 ans
              (au lieu de {eur(Math.round(loanFromPayment(mensualiteMax, 0.037, 25)))} sans loyer pris en compte).
            </div>
          </div>
        </AccordionSection>

        {/* 2 — Paramètres du bien locatif */}
        <AccordionSection
          accentColor={T.blue}
          title="Paramètres du bien locatif"
          desc="Prix, apport, taux, loyer, charges, vacance"
          summaryValue={eur(locPrice)}
          summaryColor={T.blue}
          defaultOpen={true}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Prix du bien (€)">
              <NumInput value={locPrice} style={inputStyle} onChange={(n) => setLocPrice(n)} />
            </Field>
            <Field label={`Apport, notaire inclus (${locApportPct} % = ${eur(locTotalApport)})`}>
              <input type="range" min={5} max={50} step={1} value={locApportPct}
                onChange={(e) => setLocApportPct(+e.target.value)} className="w-full" style={{ accentColor: T.blue }} />
            </Field>
            <Field label={`Vacance locative (${locVacance} mois/an)`}>
              <input type="range" min={0} max={3} step={1} value={locVacance}
                onChange={(e) => setLocVacance(+e.target.value)} className="w-full" style={{ accentColor: T.amber }} />
            </Field>
            <Field label="Taux crédit (% / an)">
              <NumInput value={locRate} step={0.1} style={inputStyle} onChange={(n) => setLocRate(n)} />
            </Field>
            <Field label="Durée du crédit">
              <select value={locDuration} onChange={(e) => setLocDuration(+e.target.value)} style={inputStyle}>
                {[10, 15, 20, 25, 30].map((d) => <option key={d} value={d}>{d} ans</option>)}
              </select>
            </Field>
            <Field label="Loyer mensuel hors charges (€)">
              <NumInput value={locLoyer} style={inputStyle} onChange={(n) => setLocLoyer(n)} />
            </Field>
            <Field label="Charges copropriété non récupérables (€/mois)">
              <NumInput value={locCharges} style={inputStyle} onChange={(n) => setLocCharges(n)} />
            </Field>
            <Field label="Taxe foncière (€/an)">
              <NumInput value={locTaxeFonciere} style={inputStyle} onChange={(n) => setLocTaxeFonciere(n)} />
            </Field>
            <Field label={<>Assurance PNO (€/an)<InfoTooltip text="Assurance Propriétaire Non Occupant." /></>}>
              <NumInput value={locAssurancePNO} style={inputStyle} onChange={(n) => setLocAssurancePNO(n)} />
            </Field>
            <Field label={<>Assurance emprunteur (% / an du capital)<InfoTooltip text="Coût indicatif : 0,10 % à 0,60 % selon l'âge et le profil." /></>}>
              <NumInput value={locAssuranceEmprunteurPct} step={0.05} style={inputStyle} onChange={(n) => setLocAssuranceEmprunteurPct(n)} />
            </Field>
            <Field label="Appréciation annuelle du bien (%)">
              <NumInput value={locAppreciation} step={0.5} style={inputStyle} onChange={(n) => setLocAppreciation(n)} />
            </Field>
          </div>
        </AccordionSection>

        {/* 3 — Financement */}
        <AccordionSection
          accentColor={T.amber}
          title="Structure du financement"
          desc="Apport · crédit · assurance emprunteur"
          summaryValue={`${eur(locMensualite)}/mois`}
          summaryColor={T.amber}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MiniStat label="Votre apport" value={eur(locTotalApport)} color={T.cyan} />
            <MiniStat label="Dont frais de notaire" value={eur(locNotaire)} color={T.muted} />
            <MiniStat label="Dont sur le bien" value={eur(locApportSurBien)} color={T.blue} />
            <MiniStat label="Montant emprunté" value={eur(locCredit)} color={T.amber} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted }}>Mensualité crédit</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: T.text }}>{eur(locMensualite)}</div>
              <div style={{ fontSize: 12, color: T.muted }}>sur {locDuration} ans à {locRate} %</div>
            </div>
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted }}>Assurance emprunteur</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: T.text }}>{eur(locAssuranceEmprunteurMensuelle)}</div>
              <div style={{ fontSize: 12, color: T.muted }}>par mois, sur {eur(locCredit)} emprunté</div>
            </div>
          </div>
        </AccordionSection>

        {/* 4 — Rendement */}
        <AccordionSection
          accentColor={T.amber}
          title="Rendement locatif"
          desc="Brut · net · formule détaillée"
          summaryValue={`${rendementNet.toFixed(2)} % net`}
          summaryColor={rendementColor(rendementNet)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted, display: "flex", alignItems: "center" }}>
                Rendement brut<InfoTooltip text="Loyers annuels (sans vacance) ÷ (prix + notaire). Utile pour comparer des biens rapidement." />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: rendementColor(rendementBrut) }}>{rendementBrut.toFixed(2)} %</div>
              <div style={{ fontSize: 12, color: T.muted }}>{eur(loyerAnnuelBrut)} / an ÷ {eur(locInvestissementTotal)}</div>
            </div>
            <div style={{ borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.muted, display: "flex", alignItems: "center" }}>
                Rendement net<InfoTooltip text="(Loyers réels après vacance − charges copro − taxe foncière − PNO) ÷ (prix + notaire). Hors crédit et fiscalité." />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "4px 0", color: rendementColor(rendementNet) }}>{rendementNet.toFixed(2)} %</div>
              <div style={{ fontSize: 12, color: T.muted }}>après charges, hors crédit et fiscalité</div>
            </div>
          </div>
          <div style={{ borderRadius: 10, padding: "10px 16px", fontSize: 12, fontFamily: "monospace", display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center", background: "rgba(47,155,255,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
            <span style={{ color: T.text }}>Rendement net</span><span>=</span>
            <span style={{ color: T.green }}>({eur(loyerAnnuelEffectif)} loyers</span><span>−</span>
            <span style={{ color: T.amber }}>{eur(locChargesAnnuelles)} charges)</span><span>÷</span>
            <span style={{ color: T.cyan }}>{eur(locInvestissementTotal)}</span><span>=</span>
            <span style={{ color: rendementColor(rendementNet), fontWeight: 700 }}>{rendementNet.toFixed(2)} %</span>
          </div>
        </AccordionSection>

        {/* 5 — Cash-flow */}
        <AccordionSection
          accentColor={T.cyan}
          title="Cash-flow mensuel"
          desc="Avant impôt · détail ligne à ligne"
          summaryValue={`${cashflowMensuel >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(cashflowMensuel)))}/mois`}
          summaryColor={cashflowMensuel >= 0 ? T.green : T.red}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            {[
              { label: "Loyer perçu (vacance déduite)", value: `+ ${eur(Math.round(loyerMensuelEffectif))}`, color: T.green },
              { label: "Mensualité crédit", value: `− ${eur(locMensualite)}`, color: T.red },
              { label: "Assurance emprunteur", value: `− ${eur(locAssuranceEmprunteurMensuelle)}`, color: T.red },
              { label: "Charges de copropriété", value: `− ${eur(locCharges)}`, color: T.red },
              { label: "Taxe foncière (mensualisée)", value: `− ${eur(Math.round(locTaxeFonciere / 12))}`, color: T.red },
              { label: "Assurance PNO (mensualisée)", value: `− ${eur(Math.round(locAssurancePNO / 12))}`, color: T.red },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted }}>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net mensuel (avant impôt)</span>
              <span style={{ color: cashflowMensuel >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 16 }}>
                {cashflowMensuel >= 0 ? "+" : "−"} {eur(Math.abs(Math.round(cashflowMensuel)))}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
            <AlertTriangle size={12} style={{ color: T.amber, display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
            Cash-flow <b>avant impôt sur les revenus fonciers</b>. Selon votre régime (micro-foncier 30 % ou régime réel), l'impact réel peut différer. Consultez <b>Fiscalité → Revenus locatifs</b>.
          </div>
        </AccordionSection>

        {/* 6 — Projection locative (NOUVEAU) */}
        <AccordionSection
          accentColor={T.green}
          title={`Projection sur ${locDuration} ans`}
          desc="Valeur du bien · capital net après remboursement"
          summaryValue={eur(locFinalEquity)}
          summaryColor={T.green}
        >
          <ExpandableChart height={260} title="Projection patrimoine locatif">
            <LineChart data={locProjectionSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis stroke={T.muted} tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + "k€" : v} />
              <Tooltip {...chartTip} formatter={(v) => eur(v)} />
              <Line type="monotone" dataKey="Valeur du bien" stroke={T.muted} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="Capital net" stroke={T.amber} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ExpandableChart>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div style={{ borderRadius: 10, padding: 12, textAlign: "center", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, marginBottom: 4, color: T.muted }}>Valeur du bien à {locDuration} ans</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.muted }}>{eur(locFinalPropValue)}</div>
            </div>
            <div style={{ borderRadius: 10, padding: 12, textAlign: "center", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, marginBottom: 4, color: T.muted }}>Capital net (bien − crédit restant)</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.amber }}>{eur(locFinalEquity)}</div>
            </div>
          </div>
        </AccordionSection>

      </div>
    </>
  );
}
```

- [ ] **Vérifier mode locatif dans le navigateur — hero KPIs corrects, graphique de projection visible**

```bash
# Dans le navigateur : switcher sur "Investissement locatif"
# Vérifier que la section "Projection sur X ans" contient bien un graphique LineChart
```

---

## Task 4 — LocationSection : hero KPIs + accordéon

**Files:**
- Modify: `src/Immobilier.jsx` — ajouter LocationSection avant LocatifSection

- [ ] **Ajouter LocationSection avec tous les états locaux**

```jsx
function LocationSection({ T }) {
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);

  const [melLoyerBrut, setMelLoyerBrut] = useState(900);
  const [melMensualite, setMelMensualite] = useState(700);
  const [melChargesCopro, setMelChargesCopro] = useState(50);
  const [melTaxeFonciere, setMelTaxeFonciere] = useState(900);
  const [melVacance, setMelVacance] = useState(1);
  const [melGLIPct, setMelGLIPct] = useState(2.5);
  const [melPNO, setMelPNO] = useState(120);
  const [melGestionPct, setMelGestionPct] = useState(0);
  const [melEntretienPct, setMelEntretienPct] = useState(5);
  const [melMeuble, setMelMeuble] = useState(false);
  const [melRegimeFiscal, setMelRegimeFiscal] = useState("micro");
  const [melTMI, setMelTMI] = useState(30);
  const [melCodePostal, setMelCodePostal] = useState("");
  const [melSurface, setMelSurface] = useState(50);
  const [melLoyerMeubleMajorationPct, setMelLoyerMeubleMajorationPct] = useState(15);
  const [melGeoInfo, setMelGeoInfo] = useState(null);
  const [melGeoLoading, setMelGeoLoading] = useState(false);
  const [melGeoError, setMelGeoError] = useState(null);

  useEffect(() => {
    setMelRegimeFiscal((prev) => {
      if (melMeuble && prev === "micro") return "microBic";
      if (!melMeuble && prev === "microBic") return "micro";
      return prev;
    });
  }, [melMeuble]);

  useEffect(() => {
    const cp = melCodePostal.trim();
    if (!/^\d{5}$/.test(cp)) { setMelGeoInfo(null); setMelGeoError(null); setMelGeoLoading(false); return; }
    let cancelled = false;
    setMelGeoLoading(true);
    setMelGeoError(null);
    const t = setTimeout(() => {
      fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,departement,population&format=json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("network"))))
        .then((data) => {
          if (cancelled) return;
          if (!data || data.length === 0) { setMelGeoError("Code postal introuvable."); setMelGeoInfo(null); return; }
          const c = data[0];
          setMelGeoInfo({ commune: c.nom, codeDept: c.departement?.code, departement: c.departement?.nom, population: c.population || 0 });
        })
        .catch(() => { if (!cancelled) { setMelGeoError("Impossible de récupérer la commune."); setMelGeoInfo(null); } })
        .finally(() => { if (!cancelled) setMelGeoLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [melCodePostal]);

  const melMoisOccupes = Math.max(0, 12 - melVacance);
  const melLoyerAnnuelEffectif = melLoyerBrut * melMoisOccupes;
  const melLoyerMensuelEffectif = melLoyerAnnuelEffectif / 12;
  const melGLIMensuel = Math.round(melLoyerBrut * melGLIPct / 100);
  const melGestionMensuel = Math.round(melLoyerBrut * melGestionPct / 100);
  const melEntretienMensuel = Math.round(melLoyerBrut * melEntretienPct / 100);
  const melTaxeFonciereMensuelle = melTaxeFonciere / 12;
  const melPNOMensuelle = melPNO / 12;
  const melChargesMensuelles = melMensualite + melChargesCopro + melTaxeFonciereMensuelle + melPNOMensuelle + melGLIMensuel + melGestionMensuel + melEntretienMensuel;
  const melCashflowAvantImpot = melLoyerMensuelEffectif - melChargesMensuelles;
  const melAbattementPct = melRegimeFiscal === "microBic" ? 50 : 30;
  const melChargesDeductiblesAnnuelles = melTaxeFonciere + melPNO + (melChargesCopro + melGLIMensuel + melGestionMensuel + melEntretienMensuel) * 12;
  const melResultatFoncier = melLoyerAnnuelEffectif - melChargesDeductiblesAnnuelles;
  const melBaseImposable = melRegimeFiscal === "reel" ? Math.max(0, melResultatFoncier) : Math.max(0, melLoyerAnnuelEffectif * (1 - melAbattementPct / 100));
  const melDeficitFoncier = melRegimeFiscal === "reel" ? Math.max(0, -melResultatFoncier) : 0;
  const melImpotAnnuel = melBaseImposable * (melTMI / 100 + 0.172);
  const melImpotMensuel = melImpotAnnuel / 12;
  const melCashflowApresImpot = melCashflowAvantImpot - melImpotMensuel;
  const melTauxTFDept = melGeoInfo ? (TAUX_TF_PAR_DEPT[melGeoInfo.codeDept] ?? TAUX_TF_DEFAUT) : null;
  const melValeurLocativeEstimee = (melLoyerBrut * 12) / 2;
  const melTaxeFonciereEstimee = melTauxTFDept != null ? Math.round(melValeurLocativeEstimee * melTauxTFDept / 100) : null;
  const melPNOEstimee = Math.round((70 + melSurface * 1.1) * (melGeoInfo && melGeoInfo.population > 100000 ? 1.15 : 1));

  function computeMelScenario(loyerBrut, abattementPct, regime) {
    const loyerAnnuelEff = loyerBrut * melMoisOccupes;
    const loyerMensuelEff = loyerAnnuelEff / 12;
    const gli = Math.round(loyerBrut * melGLIPct / 100);
    const gestion = Math.round(loyerBrut * melGestionPct / 100);
    const entretien = Math.round(loyerBrut * melEntretienPct / 100);
    const chargesMens = melMensualite + melChargesCopro + melTaxeFonciereMensuelle + melPNOMensuelle + gli + gestion + entretien;
    const cfAvantImpot = loyerMensuelEff - chargesMens;
    let baseImp;
    if (regime === "reel") {
      const chargesDed = melTaxeFonciere + melPNO + (melChargesCopro + gli + gestion + entretien) * 12;
      baseImp = Math.max(0, loyerAnnuelEff - chargesDed);
    } else {
      baseImp = Math.max(0, loyerAnnuelEff * (1 - abattementPct / 100));
    }
    const impotMens = baseImp * (melTMI / 100 + 0.172) / 12;
    return { loyerMensuelEff, chargesMens, cfAvantImpot, baseImp, impotMens, cfApresImpot: cfAvantImpot - impotMens };
  }

  const melRegimeNuComparaison = melRegimeFiscal === "reel" ? "reel" : "micro";
  const melScenarioNu = computeMelScenario(melLoyerBrut, 30, melRegimeNuComparaison);
  const melLoyerMeuble = Math.round(melLoyerBrut * (1 + melLoyerMeubleMajorationPct / 100));
  const melScenarioMeuble = computeMelScenario(melLoyerMeuble, 50, "micro");
  const melDeltaMeuble = melScenarioMeuble.cfApresImpot - melScenarioNu.cfApresImpot;
```

- [ ] **Ajouter hero KPIs + sections accordéon location (return de LocationSection)**

```jsx
  return (
    <>
      {/* Hero KPIs location */}
      <div style={{
        background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: "22px 28px",
        display: "flex", alignItems: "center", gap: 0,
      }}>
        {[
          { label: "Cash-flow avant impôt", value: `${melCashflowAvantImpot >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(melCashflowAvantImpot)))}`, color: melCashflowAvantImpot >= 0 ? T.green : T.red, sub: "par mois, toutes charges déduites" },
          { label: "Cash-flow après impôt", value: `${melCashflowApresImpot >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(melCashflowApresImpot)))}`, color: melCashflowApresImpot >= 0 ? T.green : T.red, sub: `régime ${melRegimeFiscal === "reel" ? "réel" : melRegimeFiscal === "microBic" ? "micro-BIC" : "micro-foncier"}` },
          { label: "Impôt (mensualisé)", value: eur(Math.round(melImpotMensuel)), color: T.red, sub: `TMI ${melTMI} % + prélèvements sociaux` },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, padding: "0 24px",
            ...(i === 0 ? { paddingLeft: 0 } : { borderLeft: `1px solid ${T.border}` }),
          }}>
            <div style={{ fontSize: 11, color: T.muted, fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">

        {/* 1 — Paramètres */}
        <AccordionSection
          accentColor={T.blue}
          title="Paramètres de la mise en location"
          desc="Loyer, crédit, charges, vacance, code postal"
          summaryValue={`${eur(melLoyerBrut)}/mois`}
          summaryColor={T.blue}
          defaultOpen={true}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginBottom: 16, userSelect: "none", borderRadius: 10, padding: "10px 14px", background: melMeuble ? "rgba(34,199,154,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${melMeuble ? T.green + "44" : T.border}` }}>
            <input type="checkbox" checked={melMeuble} onChange={(e) => setMelMeuble(e.target.checked)}
              style={{ accentColor: T.green, width: 16, height: 16 }} />
            <span style={{ color: melMeuble ? T.green : T.text, fontWeight: 600 }}>Bien loué meublé (LMNP)</span>
            <InfoTooltip text="Cochez si le bien est loué avec mobilier. Définit le régime fiscal par défaut : micro-BIC (50 %) pour le meublé, micro-foncier (30 %) pour la location nue." align="left" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label={<>Code postal<InfoTooltip text="Estimation taxe foncière et PNO via geo.api.gouv.fr." align="left" /></>}>
              <input type="text" inputMode="numeric" maxLength={5} value={melCodePostal} placeholder="ex : 69003"
                style={inputStyle} onChange={(e) => setMelCodePostal(e.target.value.replace(/\D/g, "").slice(0, 5))} />
            </Field>
            <Field label="Surface du bien (m²)">
              <NumInput value={melSurface} style={inputStyle} onChange={(n) => setMelSurface(n)} />
            </Field>
            <Field label="Loyer mensuel brut estimé (€)">
              <NumInput value={melLoyerBrut} style={inputStyle} onChange={(n) => setMelLoyerBrut(n)} />
            </Field>
            <Field label={<>Mensualité de crédit, assurances comprises (€)<InfoTooltip text="0 si le bien est entièrement remboursé." align="left" /></>}>
              <NumInput value={melMensualite} style={inputStyle} onChange={(n) => setMelMensualite(n)} />
            </Field>
            <Field label={`Vacance locative (${melVacance} mois/an)`}>
              <input type="range" min={0} max={3} step={1} value={melVacance}
                onChange={(e) => setMelVacance(+e.target.value)} className="w-full" style={{ accentColor: T.amber }} />
            </Field>
            <Field label="Charges copropriété non récupérables (€/mois)">
              <NumInput value={melChargesCopro} style={inputStyle} onChange={(n) => setMelChargesCopro(n)} />
            </Field>
            <Field label="Taxe foncière (€/an)">
              <NumInput value={melTaxeFonciere} style={inputStyle} onChange={(n) => setMelTaxeFonciere(n)} />
            </Field>
            <Field label={<>Assurance PNO (€/an)<InfoTooltip text="Assurance Propriétaire Non Occupant." /></>}>
              <NumInput value={melPNO} style={inputStyle} onChange={(n) => setMelPNO(n)} />
            </Field>
            <Field label={<>GLI — Garantie Loyers Impayés (% du loyer)<InfoTooltip text="Coût indicatif : 2 % à 3,5 % du loyer." /></>}>
              <NumInput value={melGLIPct} step={0.1} style={inputStyle} onChange={(n) => setMelGLIPct(n)} />
            </Field>
            <Field label={<>Frais de gestion locative (% du loyer)<InfoTooltip text="5 % à 8 % si agence, 0 si gestion directe." /></>}>
              <NumInput value={melGestionPct} step={0.5} style={inputStyle} onChange={(n) => setMelGestionPct(n)} />
            </Field>
            <Field label={<>Provision entretien / travaux (% du loyer)<InfoTooltip text="Recommandé : 5 % à 10 % du loyer." /></>}>
              <NumInput value={melEntretienPct} step={0.5} style={inputStyle} onChange={(n) => setMelEntretienPct(n)} />
            </Field>
          </div>
          {melCodePostal.length === 5 && (
            <div style={{ marginTop: 16, borderRadius: 10, padding: "12px 16px", background: T.panel, border: `1px solid ${T.border}` }}>
              {melGeoLoading && <span style={{ color: T.muted }}>Recherche de la commune…</span>}
              {melGeoError && <span style={{ color: T.red }}>{melGeoError}</span>}
              {melGeoInfo && !melGeoLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ color: T.blue, fontWeight: 700 }}>{melGeoInfo.commune} ({melGeoInfo.codeDept}) · {melGeoInfo.departement}</div>
                  {melTaxeFonciereEstimee != null && (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: T.muted }}>
                      <span>Taxe foncière estimée : <b style={{ color: T.text }}>{eur(melTaxeFonciereEstimee)}/an</b> (taux ~{melTauxTFDept} %)</span>
                      <button onClick={() => setMelTaxeFonciere(melTaxeFonciereEstimee)}
                        style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${T.blue}55`, background: "rgba(91,141,239,0.12)", color: T.blue, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Utiliser
                      </button>
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: T.muted }}>
                    <span>Assurance PNO estimée : <b style={{ color: T.text }}>{eur(melPNOEstimee)}/an</b></span>
                    <button onClick={() => setMelPNO(melPNOEstimee)}
                      style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${T.blue}55`, background: "rgba(91,141,239,0.12)", color: T.blue, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Utiliser
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>Estimations indicatives — vérifiez votre avis de taxe foncière.</div>
                </div>
              )}
            </div>
          )}
        </AccordionSection>

        {/* 2 — Imposition */}
        <AccordionSection
          accentColor={T.violet}
          title="Imposition des revenus locatifs"
          desc="Régime fiscal · TMI · base imposable · déficit foncier"
          summaryValue={eur(Math.round(melImpotAnnuel))}
          summaryColor={T.red}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Field label={<>Régime fiscal<InfoTooltip text="Micro-foncier (nu, 30 %) ou micro-BIC (meublé, 50 %). Le régime réel déduit les charges réelles." align="left" /></>}>
              <select value={melRegimeFiscal} style={inputStyle} onChange={(e) => setMelRegimeFiscal(e.target.value)}>
                {melMeuble ? (
                  <>
                    <option value="microBic">Micro-BIC — meublé (abattement 50 %)</option>
                    <option value="reel">Régime réel LMNP (déduction des charges)</option>
                  </>
                ) : (
                  <>
                    <option value="micro">Micro-foncier — nu (abattement 30 %)</option>
                    <option value="reel">Régime réel (déduction des charges)</option>
                  </>
                )}
              </select>
            </Field>
            <Field label={<>Tranche marginale d'imposition (TMI)<InfoTooltip text="Les revenus fonciers s'ajoutent à vos revenus et sont taxés à ce taux, plus 17,2 % de prélèvements sociaux." align="left" /></>}>
              <select value={melTMI} style={inputStyle} onChange={(e) => setMelTMI(+e.target.value)}>
                {[0, 11, 30, 41, 45].map((t) => <option key={t} value={t}>{t} %</option>)}
              </select>
            </Field>
          </div>
          <div style={{ borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 12, fontFamily: "monospace", display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center", background: "rgba(106,63,251,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
            {melRegimeFiscal !== "reel" ? (
              <>
                <span style={{ color: T.text }}>Base imposable</span><span>=</span>
                <span style={{ color: T.green }}>{eur(Math.round(melLoyerAnnuelEffectif))} loyers</span><span>×</span>
                <span style={{ color: T.amber }}>(1 − {melAbattementPct} %)</span><span>=</span>
                <span style={{ color: T.violet, fontWeight: 700 }}>{eur(Math.round(melBaseImposable))}</span>
              </>
            ) : (
              <>
                <span style={{ color: T.text }}>Résultat foncier</span><span>=</span>
                <span style={{ color: T.green }}>{eur(Math.round(melLoyerAnnuelEffectif))} loyers</span><span>−</span>
                <span style={{ color: T.amber }}>{eur(Math.round(melChargesDeductiblesAnnuelles))} charges</span><span>=</span>
                <span style={{ color: melResultatFoncier >= 0 ? T.violet : T.red, fontWeight: 700 }}>{eur(Math.round(melResultatFoncier))}</span>
              </>
            )}
          </div>
          {melDeficitFoncier > 0 && (
            <div style={{ fontSize: 12, marginBottom: 12, color: T.cyan, lineHeight: 1.6 }}>
              Déficit foncier de {eur(Math.round(melDeficitFoncier))} : imputable sur votre revenu global dans la limite de 10 700 €/an.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Impôt + prélèvements sociaux (annuel)" value={eur(Math.round(melImpotAnnuel))} color={T.red} />
            <MiniStat label="Soit par mois" value={eur(Math.round(melImpotMensuel))} color={T.red} />
          </div>
        </AccordionSection>

        {/* 3 — Cash-flow après impôt */}
        <AccordionSection
          accentColor={T.cyan}
          title="Cash-flow mensuel de la location"
          desc="Avant et après impôt · détail ligne à ligne"
          summaryValue={`${melCashflowApresImpot >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(melCashflowApresImpot)))}/mois`}
          summaryColor={melCashflowApresImpot >= 0 ? T.green : T.red}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            {[
              { label: "Loyer perçu (vacance déduite)", value: `+ ${eur(Math.round(melLoyerMensuelEffectif))}`, color: T.green },
              { label: "Mensualité crédit (assurances comprises)", value: `− ${eur(melMensualite)}`, color: T.red },
              { label: "Charges de copropriété", value: `− ${eur(melChargesCopro)}`, color: T.red },
              { label: "Taxe foncière (mensualisée)", value: `− ${eur(Math.round(melTaxeFonciereMensuelle))}`, color: T.red },
              { label: "Assurance PNO (mensualisée)", value: `− ${eur(Math.round(melPNOMensuelle))}`, color: T.red },
              { label: "GLI (Garantie Loyers Impayés)", value: `− ${eur(melGLIMensuel)}`, color: T.red },
              ...(melGestionMensuel > 0 ? [{ label: "Frais de gestion locative", value: `− ${eur(melGestionMensuel)}`, color: T.red }] : []),
              { label: "Provision entretien / travaux", value: `− ${eur(melEntretienMensuel)}`, color: T.red },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted }}>{label}</span>
                <span style={{ color, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net (avant impôt)</span>
              <span style={{ color: melCashflowAvantImpot >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 16 }}>
                {melCashflowAvantImpot >= 0 ? "+" : "−"} {eur(Math.abs(Math.round(melCashflowAvantImpot)))}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.muted }}>Impôt + prélèvements sociaux (mensualisé)</span>
              <span style={{ color: T.red, fontWeight: 700 }}>− {eur(Math.round(melImpotMensuel))}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.text, fontWeight: 800 }}>Cash-flow net (après impôt)</span>
              <span style={{ color: melCashflowApresImpot >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 18 }}>
                {melCashflowApresImpot >= 0 ? "+" : "−"} {eur(Math.abs(Math.round(melCashflowApresImpot)))}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
            Estimation simplifiée — le régime réel ne déduit ici que les charges courantes (hors intérêts et amortissement LMNP). Consultez <b>Fiscalité → Revenus locatifs</b> ou un expert-comptable.
          </div>
        </AccordionSection>

        {/* 4 — Nu vs meublé */}
        <AccordionSection
          accentColor={T.green}
          title="Location nue vs meublée (LMNP)"
          desc="Comparatif cash-flow net après impôt selon le statut"
          summaryValue={melDeltaMeuble >= 0 ? `meublé +${eur(Math.round(melDeltaMeuble))}/mois` : `nu +${eur(Math.round(-melDeltaMeuble))}/mois`}
          summaryColor={melDeltaMeuble >= 0 ? T.green : T.muted}
        >
          <Field label={<>Majoration loyer en meublé ({melLoyerMeubleMajorationPct} % = {eur(melLoyerMeuble)}/mois)<InfoTooltip text="Un bien meublé se loue généralement 10 à 20 % plus cher qu'un bien nu." align="left" /></>}>
            <input type="range" min={0} max={30} step={1} value={melLoyerMeubleMajorationPct}
              onChange={(e) => setMelLoyerMeubleMajorationPct(+e.target.value)} className="w-full" style={{ accentColor: T.green }} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {[
              { label: "Location nue", active: !melMeuble, scenario: melScenarioNu, regime: melRegimeNuComparaison === "micro" ? "Micro-foncier — abattement 30 %" : "Régime réel — déduction charges", bg: "rgba(255,255,255,0.02)", border: T.border },
              { label: "Location meublée", active: melMeuble, scenario: melScenarioMeuble, regime: "Micro-BIC — abattement 50 %", bg: "rgba(34,199,154,0.04)", border: `${T.green}33` },
            ].map(({ label, active, scenario, regime, bg, border: bdr }) => (
              <div key={label} style={{ borderRadius: 12, padding: 16, background: bg, border: `1px solid ${bdr}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
                  {active && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: active ? `${T.green}22` : `${T.muted}22`, color: active ? T.green : T.muted }}>
                      Configuration actuelle
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, marginBottom: 12, color: T.muted }}>{regime}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: T.muted }}>Loyer (vacance déduite)</span>
                  <span style={{ color: T.text }}>{eur(Math.round(scenario.loyerMensuelEff))}/mois</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: T.muted }}>Impôt + prélèvements sociaux</span>
                  <span style={{ color: T.red }}>− {eur(Math.round(scenario.impotMensuel))}/mois</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net</span>
                  <span style={{ color: scenario.cfApresImpot >= 0 ? T.green : T.red, fontWeight: 800 }}>
                    {scenario.cfApresImpot >= 0 ? "+" : "−"} {eur(Math.abs(Math.round(scenario.cfApresImpot)))}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, borderRadius: 10, padding: 12, fontSize: 13, background: melDeltaMeuble >= 0 ? "rgba(34,199,154,0.06)" : "rgba(255,90,95,0.06)", border: `1px solid ${melDeltaMeuble >= 0 ? T.green + "44" : T.red + "44"}` }}>
            <span style={{ color: melDeltaMeuble >= 0 ? T.green : T.red }}>
              {melDeltaMeuble >= 0
                ? `La location meublée améliore le cash-flow net de ${eur(Math.round(melDeltaMeuble))}/mois.`
                : `Avec cette majoration de loyer, la location nue reste plus avantageuse de ${eur(Math.round(-melDeltaMeuble))}/mois.`}
            </span>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
            Le statut LMNP au régime réel permet en plus d'amortir le bien et le mobilier — non modélisé ici. Le micro-BIC suppose des recettes &lt; 77 700 €/an.
          </div>
        </AccordionSection>

      </div>
    </>
  );
}
```

- [ ] **Vérifier mode location dans le navigateur — hero KPIs, tous les accordéons fonctionnels**

---

## Task 5 — Brancher dans App.jsx + nettoyer

**Files:**
- Modify: `src/App.jsx` — import + suppression ancienne Immobilier + suppression TAUX_TF

- [ ] **Ajouter l'import dans App.jsx (après les imports existants)**

Ajouter en ligne ~60, après l'import de InfoTooltip :

```jsx
import Immobilier from "./Immobilier.jsx";
```

- [ ] **Supprimer l'ancienne fonction Immobilier de App.jsx (lignes 4515–5550)**

Supprimer tout le bloc :
```
function Immobilier({ totals, simParams, patrimoine, transactions, setView }) {
  ...
}
/* ------------------------------------------------------------------ */
/*  ÉCRAN : PROFIL                                                     */
/* ------------------------------------------------------------------ */
```
Garder uniquement le commentaire `/* ÉCRAN : PROFIL */` et ce qui suit.

- [ ] **Supprimer les 2 constantes TAUX_TF de App.jsx (lignes 3869–3877)**

Supprimer :
```js
const TAUX_TF_PAR_DEPT = {
  "75": 13.5,
  ...
};
const TAUX_TF_DEFAUT = 46;
```

- [ ] **Vérifier que `npm run dev` ne produit aucune erreur de compilation**

```bash
npm run dev
# Attendre que Vite indique "ready in X ms" sans erreur rouge
```

- [ ] **Tester les 3 modes dans le navigateur**

Navigation : aller dans Immobilier (via sidebar ou simulations).
- Mode Résidence : hero KPIs visibles, 4 accordéons, graphique de projection
- Mode Locatif : hero KPIs visibles, 6 accordéons, graphique de projection locative (nouveau)
- Mode Location : hero KPIs visibles, 4 accordéons, cash-flow avant/après impôt

- [ ] **Commit**

```bash
git add src/Immobilier.jsx src/App.jsx
git commit -m "feat(immobilier): refonte complète — mode cards, hero KPIs, accordéons, graphique locatif"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Navigation mode cards luxe (sans emoji) → Task 1 ModeCard
- ✅ Hero KPIs par mode → Tasks 2/3/4
- ✅ Sections accordéon → Tasks 2/3/4
- ✅ Graphique de projection locatif (manquant) → Task 3
- ✅ Extraction dans Immobilier.jsx → Task 5
- ✅ Constantes dupliquées (detectProfileType, eur, TAUX_TF) → Task 1

**Placeholder scan:** Aucun TBD. Tout le code est complet.

**Type consistency:** 
- `computeMelScenario` retourne `cfApresImpot` (non `cashflowApresImpot`) — vérifié cohérent dans le rendu de LocationSection
- `locProjectionSeries` utilise `loanRemaining` avec les bons paramètres (principal=locCredit, annualRate=locRate/100, years=locDuration)
- Props `Immobilier` inchangées : `totals, simParams, patrimoine, transactions, setView`
