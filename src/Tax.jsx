import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator, Plus, Trash2, Download, AlertTriangle,
  TrendingDown, TrendingUp, X, FileText, FlaskConical,
  Landmark, Shield, Home, Info, Percent,
  CheckCircle2, XCircle, Lightbulb, Globe, RotateCw, Clock, Gift,
  ClipboardList, BarChart3, Armchair, Briefcase, Trophy, Zap,
  ArrowDownToLine, ArrowUpFromLine, User,
} from "lucide-react";
import { eur } from "./theme.js";
import { useT } from "./ThemeProvider.jsx";
import { SEUIL_EXONERATION_CESSION, pmcaSummary } from "./finance.js";
import { API_URL } from "./config.js";
import InfoTooltip from "./InfoTooltip.jsx";
import { useLocalStorage } from "./storage.js";

/* ─── Constantes ────────────────────────────────────────────────────── */
const TAX_RATE    = 0.30;
const CURRENT_YEAR = new Date().getFullYear();

/* ─── Données démo ──────────────────────────────────────────────────── */
const DEMO_LOTS = [
  { id: 10001, symbol: "BTC", name: "Bitcoin",  amount: 0.20, costPerUnit: 35000, date: "2025-01-15" },
  { id: 10002, symbol: "BTC", name: "Bitcoin",  amount: 0.10, costPerUnit: 40000, date: "2025-03-10" },
  { id: 10003, symbol: "ETH", name: "Ethereum", amount: 2.00, costPerUnit:  2200, date: "2025-02-01" },
  { id: 10004, symbol: "ETH", name: "Ethereum", amount: 1.00, costPerUnit:  2800, date: "2025-04-15" },
  { id: 10005, symbol: "SOL", name: "Solana",   amount: 50,   costPerUnit:   120, date: "2025-01-20" },
];

const DEMO_SELLS = [
  { id: 20001, symbol: "BTC", amount: 0.15, pricePerUnit: 58000, portfolioValue: 32000, date: "2025-09-10", notes: "Kraken → EUR" },
  { id: 20002, symbol: "ETH", amount: 1.50, pricePerUnit:  3500, portfolioValue: 28000, date: "2025-10-05", notes: "Coinbase" },
  { id: 20003, symbol: "SOL", amount: 20,   pricePerUnit:   180, portfolioValue: 25000, date: "2025-11-20", notes: "Binance → EUR" },
];

/* ─── FIFO engine ───────────────────────────────────────────────────── */
function computeFIFO(lots, sells) {
  const remaining = lots.map(l => ({ ...l, remaining: l.amount }));
  const results   = [];

  for (const sell of [...sells].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    let toSell   = sell.amount;
    let costUsed = 0;

    const matchLots = remaining
      .filter(l => l.symbol === sell.symbol)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const lot of matchLots) {
      if (toSell <= 0) break;
      const used      = Math.min(lot.remaining, toSell);
      costUsed       += used * lot.costPerUnit;
      lot.remaining  -= used;
      toSell         -= used;
    }

    const proceeds = sell.amount * sell.pricePerUnit;
    const gain     = proceeds - costUsed;
    results.push({
      id:        sell.id,
      date:      sell.date,
      symbol:    sell.symbol,
      amount:    sell.amount,
      proceeds,
      costBasis: costUsed,
      gain,
      tax:       gain > 0 ? gain * TAX_RATE : 0,
    });
  }
  return results;
}

/* ─── Répartition par actif ─────────────────────────────────────────── */
function groupByAsset(cessions) {
  const map = {};
  for (const c of cessions) {
    if (!map[c.symbol]) map[c.symbol] = { symbol: c.symbol, gain: 0, loss: 0, proceeds: 0, tax: 0, count: 0 };
    if (c.gain >= 0) map[c.symbol].gain += c.gain;
    else             map[c.symbol].loss += c.gain;
    map[c.symbol].proceeds += c.proceeds;
    map[c.symbol].tax      += c.tax;
    map[c.symbol].count++;
  }
  return Object.values(map).sort((a, b) => (b.gain + b.loss) - (a.gain + a.loss));
}

/* ─── Harvest opportunities ─────────────────────────────────────────── */
function computeHarvest(lots, sells, currentPrices, netGain) {
  const remaining = lots.map(l => ({ ...l, remaining: l.amount }));
  for (const sell of [...sells].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    let toSell = sell.amount;
    for (const lot of remaining.filter(l => l.symbol === sell.symbol).sort((a, b) => new Date(a.date) - new Date(b.date))) {
      if (toSell <= 0) break;
      const used = Math.min(lot.remaining, toSell);
      lot.remaining -= used; toSell -= used;
    }
  }

  const candidates = remaining
    .filter(l => l.remaining > 0 && currentPrices[l.symbol] != null)
    .map(l => {
      const currentValue = l.remaining * currentPrices[l.symbol];
      const costBasis    = l.remaining * l.costPerUnit;
      const unrealized   = currentValue - costBasis;
      return unrealized < 0 ? { ...l, currentValue, costBasis, unrealized } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.unrealized - b.unrealized);

  let remainingGain = Math.max(0, netGain);
  return candidates.map(l => {
    const gainOffset = Math.min(-l.unrealized, remainingGain);
    remainingGain   -= gainOffset;
    return { ...l, taxSaving: gainOffset * TAX_RATE };
  }).filter(h => h.taxSaving > 0);
}

/* ─── Export récapitulatif fiscal indicatif (non officiel) ──────────── */
function exportFiscalRecap(cessions, lots, taxYear) {
  const inYear = cessions.filter(c => c.date?.startsWith(String(taxYear)));
  if (!inYear.length) { alert(`Aucune cession en ${taxYear}`); return; }

  const totalAcq = lots.reduce((s, l) => s + l.amount * l.costPerUnit, 0);

  const header = [
    "Date de cession", "Actif", "Quantité cédée",
    "Prix de cession (€)", "Prix de revient total portefeuille (€)",
    "Fraction cédée (%)", "Quote-part acquisition (€)",
    "Plus-value / Moins-value (€)", "PFU estimé 30 % (€)",
  ].join(";");

  const rows = inYear.map(c => {
    const denom = c.proceeds + totalAcq - c.costBasis;
    const fraction = (totalAcq > 0 && denom > 0) ? c.proceeds / denom : 0;
    return [
      c.date, c.symbol, c.amount.toFixed(8),
      c.proceeds.toFixed(2), totalAcq.toFixed(2),
      (fraction * 100).toFixed(4),
      (totalAcq * fraction).toFixed(2),
      c.gain.toFixed(2), c.tax.toFixed(2),
    ].join(";");
  });

  const totals = [
    "", "TOTAL", "",
    inYear.reduce((s, c) => s + c.proceeds, 0).toFixed(2), "", "", "",
    inYear.reduce((s, c) => s + c.gain, 0).toFixed(2),
    inYear.reduce((s, c) => s + c.tax, 0).toFixed(2),
  ].join(";");

  const csv  = [header, ...rows, totals].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href     = URL.createObjectURL(blob);
  link.download = `recap-fiscal-indicatif-crypto-${taxYear}.csv`;
  link.click();
}

/* ─── Formulaire 2086 pré-rempli (PDF) — méthode légale PMCA ─────────── */
const eur2 = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + " €";

async function generate2086PDF(pmca, taxYear) {
  if (!pmca.cessions.length) { alert(`Aucune cession en ${taxYear}.`); return; }
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ML = 14, MR = 196;
  let y = 18;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(`Formulaire 2086 — Cessions d'actifs numériques ${taxYear}`, ML, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
  doc.text("Méthode PMCA (prix moyen pondéré d'acquisition) — art. 150 VH bis du CGI.", ML, y); y += 4;
  doc.text("Document d'aide à la déclaration. À vérifier et reporter sur impots.gouv.fr. Ne constitue pas un conseil fiscal.", ML, y); y += 8;
  doc.setTextColor(0);

  // Détail par cession
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Détail des cessions (un bloc = une cession à reporter sur le formulaire 2086)", ML, y); y += 2;
  doc.setLineWidth(0.2); doc.line(ML, y, MR, y); y += 5;
  doc.setFontSize(8);
  pmca.cessions.forEach((c, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`Cession ${i + 1} — ${c.date} — ${c.symbol}${c.estimated ? "  (valeur portefeuille manquante : à compléter)" : ""}`, ML, y); y += 4;
    doc.setFont("helvetica", "normal");
    const lines = [
      `Prix de cession : ${eur2(c.proceeds)}`,
      `Valeur globale du portefeuille au jour de la cession : ${c.portfolioValue ? eur2(c.portfolioValue) : "— à renseigner —"}`,
      `Prix d'acquisition de la fraction cédée (PMCA) : ${eur2(c.acquisitionFraction)}`,
      `Plus ou moins-value de la cession : ${eur2(c.gain)}`,
    ];
    lines.forEach(t => { doc.text(t, ML + 4, y); y += 4; });
    y += 2;
    if (y > 260) { doc.addPage(); y = 18; }
  });

  // Synthèse → report 2042-C
  y += 2; doc.setLineWidth(0.2); doc.line(ML, y, MR, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Synthèse annuelle → report sur la déclaration 2042-C", ML, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const synth = [
    `Total des prix de cession ${taxYear} : ${eur2(pmca.totalProceeds)}`,
    `Plus-value nette globale (case 3AN) : ${eur2(Math.max(0, pmca.netGain))}`,
    `Moins-value nette globale (case 3BN) : ${eur2(Math.min(0, pmca.netGain))}`,
    `Imposition forfaitaire 30 % (PFU) estimée : ${eur2(pmca.tax)}`,
  ];
  synth.forEach(t => { doc.text(t, ML + 2, y); y += 5; });
  y += 2;
  if (pmca.exonerated) {
    doc.setTextColor(180, 100, 20);
    doc.text(`Total des cessions ≤ ${SEUIL_EXONERATION_CESSION} € → exonération (art. 150 VH bis).`, ML + 2, y); y += 5;
    doc.setTextColor(0);
  }
  if (pmca.anyEstimated) {
    doc.setTextColor(200, 40, 40);
    doc.text("⚠ Certaines cessions n'ont pas de valeur de portefeuille : montants incomplets, à corriger.", ML + 2, y);
    doc.setTextColor(0);
  }

  doc.save(`formulaire-2086-crypto-${taxYear}.pdf`);
}

/* ─── Styles partagés ───────────────────────────────────────────────── */
const EMPTY_LOT  = { symbol: "", name: "", amount: "", costPerUnit: "", date: new Date().toISOString().slice(0, 10) };
const EMPTY_SELL = { symbol: "", amount: "", pricePerUnit: "", portfolioValue: "", date: new Date().toISOString().slice(0, 10), notes: "" };
const INPUT_FOCUS_CLASS = "focus:ring-2 focus:ring-[#5b8def]/30 transition-shadow duration-150";

/* ─── ID map CoinGecko ──────────────────────────────────────────────── */
const COIN_ID = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", MATIC: "matic-network", AVAX: "avalanche-2", DOT: "polkadot", LINK: "chainlink", ADA: "cardano", ATOM: "cosmos", XRP: "ripple" };

/* ─── Listes à puces — icône par nature de règle ─────────────────────── */
const RULE_ICON_MAP = {
  good:   CheckCircle2,
  bad:    XCircle,
  tip:    Lightbulb,
  warn:   AlertTriangle,
  info:   Info,
  cycle:  RotateCw,
  global: Globe,
  down:   TrendingDown,
  time:   Clock,
  gift:   Gift,
  stat:   BarChart3,
  note:   ClipboardList,
  calc:   Calculator,
  sofa:   Armchair,
  job:    Briefcase,
  best:   Trophy,
  age:    User,
  home:   Home,
  zap:    Zap,
};

const RuleItem = ({ kind, children }) => {
  const T = useT();
  const RULE_ICON = {
    good:   { Icon: CheckCircle2,  color: T.green },
    bad:    { Icon: XCircle,       color: T.red },
    tip:    { Icon: Lightbulb,     color: T.amber },
    warn:   { Icon: AlertTriangle, color: T.amber },
    info:   { Icon: Info,          color: T.cyan },
    cycle:  { Icon: RotateCw,      color: T.blue },
    global: { Icon: Globe,         color: T.cyan },
    down:   { Icon: TrendingDown,  color: T.red },
    time:   { Icon: Clock,         color: T.muted },
    gift:   { Icon: Gift,          color: T.green },
    stat:   { Icon: BarChart3,     color: T.cyan },
    note:   { Icon: ClipboardList, color: T.muted },
    calc:   { Icon: Calculator,    color: T.blue },
    sofa:   { Icon: Armchair,      color: T.amber },
    job:    { Icon: Briefcase,     color: T.amber },
    best:   { Icon: Trophy,        color: T.green },
    age:    { Icon: User,          color: T.muted },
    home:   { Icon: Home,          color: T.blue },
    zap:    { Icon: Zap,           color: T.red },
  };
  const { Icon, color } = RULE_ICON[kind] || RULE_ICON.info;
  return (
    <li className="flex items-start gap-2" style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
      <Icon size={13} style={{ color, opacity: 0.85, flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </li>
  );
};

/* ─── Composant principal ───────────────────────────────────────────── */
export default function Tax() {
  const T = useT();
  const INPUT = { width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" };
  const LBL   = { display: "block", color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 };

  /* ── Crypto state ── */
  const [lots,    setLots]   = useLocalStorage("wt_tax_lots",  []);
  const [sells,   setSells]  = useLocalStorage("wt_tax_sells", []);
  const [taxYear, setTaxYear] = useState(CURRENT_YEAR - 1);
  const [tab,     setTab]    = useState("summary");
  const [showLotForm,  setShowLotForm]  = useState(false);
  const [showSellForm, setShowSellForm] = useState(false);
  const [lotForm,  setLotForm]  = useState(EMPTY_LOT);
  const [sellForm, setSellForm] = useState(EMPTY_SELL);
  const [prices,  setPrices]   = useState({});
  const [serverOk, setServerOk] = useState(false);

  /* ── Envelope nav ── */
  const [envelope, setEnvelope] = useState("crypto");

  /* ── PEA/CTO calculator ── */
  const [peaCalc, setPeaCalc] = useState({ gain: "", years: "5+" });

  /* ── Assurance-Vie calculator ── */
  const [avCalc, setAvCalc] = useState({ versements: "", gains: "", age: "8+", couple: false });

  /* ── Immobilier calculator ── */
  const [immoMode, setImmoMode] = useState("pv");
  const [immoCalc, setImmoCalc] = useState({ achat: "", vente: "", duree: "", travaux: "" });
  const [locCalc,  setLocCalc]  = useState({ loyers: "", regime: "micro", tmi: 30, charges: "" });

  /* ── Prix live pour harvest ── */
  useEffect(() => {
    const syms = [...new Set([...lots, ...sells].map(l => l.symbol?.toUpperCase()))].filter(Boolean);
    if (!syms.length) return;
    const ids = syms.map(s => COIN_ID[s] || s.toLowerCase()).join(",");
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`)
      .then(r => r.json())
      .then(data => {
        const out = {};
        syms.forEach(sym => { const v = data[COIN_ID[sym] || sym.toLowerCase()]?.eur; if (v) out[sym] = v; });
        setPrices(out);
      })
      .catch(() => {});
  }, [lots, sells]);

  /* ── Ping serveur ── */
  useEffect(() => {
    fetch(`${API_URL}/api/tax/ping`, { signal: AbortSignal.timeout(1500) })
      .then(r => r.ok && setServerOk(true))
      .catch(() => {});
  }, []);

  /* ── Fermeture des modals à l'Échap ── */
  useEffect(() => {
    if (!showLotForm && !showSellForm) return;
    const onKey = e => { if (e.key === "Escape") { setShowLotForm(false); setShowSellForm(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLotForm, showSellForm]);

  /* ── PMCA (méthode légale, art. 150 VH bis) — pour le formulaire 2086 ── */
  const pmca = useMemo(() => pmcaSummary(lots, sells, taxYear), [lots, sells, taxYear]);

  /* ── FIFO + dérivés (vue indicative interne) ── */
  const cessions      = useMemo(() => computeFIFO(lots, sells), [lots, sells]);
  const sessionsInYear = useMemo(() => cessions.filter(c => c.date?.startsWith(String(taxYear))), [cessions, taxYear]);
  const byAsset       = useMemo(() => groupByAsset(sessionsInYear), [sessionsInYear]);

  const totalProfit = sessionsInYear.filter(c => c.gain > 0).reduce((s, c) => s + c.gain, 0);
  const totalLoss   = sessionsInYear.filter(c => c.gain < 0).reduce((s, c) => s + c.gain, 0);
  const netGain     = totalProfit + totalLoss;

  /* Seuil d'exonération annuel (art. 150 VH bis CGI) : si la somme des prix
     de cession de l'année n'excède pas 305 €, la plus-value est exonérée. */
  const totalProceeds = sessionsInYear.reduce((s, c) => s + c.proceeds, 0);
  const isExonere     = totalProceeds > 0 && totalProceeds <= SEUIL_EXONERATION_CESSION;
  const estimTax      = isExonere ? 0 : (netGain > 0 ? netGain * TAX_RATE : 0);

  const harvestOps  = useMemo(() => computeHarvest(lots, sells, prices, netGain), [lots, sells, prices, netGain]);
  const harvestSave = harvestOps.reduce((s, h) => s + h.taxSaving, 0);

  /* ── Calculs PEA/CTO ── */
  const peaResult = useMemo(() => {
    const g = parseFloat(peaCalc.gain) || 0;
    if (!g) return null;
    const taxCTO     = g * 0.30;
    const taxPEAlt5  = g * 0.30;
    const taxPEAge5  = g * 0.172;
    return {
      gain: g,
      cto:     { total: taxCTO,    ir: g * 0.128, ps: g * 0.172 },
      peaLt5:  { total: taxPEAlt5, ir: g * 0.128, ps: g * 0.172, note: "Clôture obligatoire du PEA" },
      peaGe5:  { total: taxPEAge5, ir: 0,          ps: g * 0.172, note: "Retraits partiels autorisés sans clôture" },
      saving:  peaCalc.years === "5+" ? g * 0.128 : 0,
    };
  }, [peaCalc]);

  /* ── Calculs Assurance-Vie ── */
  const avResult = useMemo(() => {
    const versements = parseFloat(avCalc.versements) || 0;
    const gains      = parseFloat(avCalc.gains) || 0;
    if (!gains) return null;
    const abattement = avCalc.couple ? 9200 : 4600;
    const ps = gains * 0.172;
    let ir;
    if (avCalc.age === "<8") {
      ir = gains * 0.128;
    } else {
      const gainsNets = Math.max(0, gains - abattement);
      if (!versements || versements <= 150000) {
        ir = gainsNets * 0.075;
      } else {
        const fracRed = gains > 0 ? gainsNets * (150000 / versements) : 0;
        ir = fracRed * 0.075 + Math.max(0, gainsNets - fracRed) * 0.128;
      }
    }
    const abattEffectif = avCalc.age === "8+" ? Math.min(gains, abattement) : 0;
    return { ps, ir, total: ps + ir, gains, abattement: abattEffectif, cto: gains * 0.30 };
  }, [avCalc]);

  /* ── Calculs Plus-values immobilières ── */
  const immoResult = useMemo(() => {
    const achat  = parseFloat(immoCalc.achat)  || 0;
    const vente  = parseFloat(immoCalc.vente)  || 0;
    const duree  = parseInt(immoCalc.duree)    || 0;
    const travaux = parseFloat(immoCalc.travaux) || 0;
    if (!achat || !vente || !duree) return null;

    const fraisAchat   = achat * 0.075;
    const fraisTravauxForfait = duree >= 5 ? achat * 0.15 : 0;
    const fraisTravaux = travaux > 0 ? travaux : fraisTravauxForfait;
    const prixRevient  = achat + fraisAchat + fraisTravaux;
    const pvBrute      = vente - prixRevient;

    if (pvBrute <= 0) return { pvBrute, impot: 0, prixRevient };

    let abatIR = 0;
    if (duree >= 6 && duree <= 21) abatIR = (duree - 5) * 6;
    else if (duree >= 22)          abatIR = 100;

    let abatPS = 0;
    if (duree >= 6 && duree <= 21) abatPS = (duree - 5) * 1.65;
    else if (duree === 22)         abatPS = 16 * 1.65 + 1.60;
    else if (duree >= 23 && duree <= 30) abatPS = 16 * 1.65 + 1.60 + (duree - 22) * 9;
    else if (duree > 30)           abatPS = 100;

    const pvIR = pvBrute * (1 - abatIR / 100);
    const pvPS = pvBrute * (1 - abatPS / 100);
    const ir   = pvIR * 0.19;
    const ps   = pvPS * 0.172;

    return { pvBrute, prixRevient, pvIR, pvPS, ir, ps, total: ir + ps, abatIR, abatPS, duree };
  }, [immoCalc]);

  /* ── Calculs Revenus locatifs ── */
  const locResult = useMemo(() => {
    const loyers  = parseFloat(locCalc.loyers)  || 0;
    const charges = parseFloat(locCalc.charges) || 0;
    const tmi     = locCalc.tmi / 100;
    if (!loyers) return null;

    if (locCalc.regime === "micro") {
      const net = loyers * 0.70;
      return { net, ir: net * tmi, ps: net * 0.172, total: net * (tmi + 0.172), abat: loyers * 0.30 };
    } else {
      const net    = Math.max(0, loyers - charges);
      const deficit = Math.max(0, charges - loyers);
      return { net, ir: net * tmi, ps: net * 0.172, total: net * (tmi + 0.172), deficit, abat: charges };
    }
  }, [locCalc]);

  /* ── Handlers crypto ── */
  const loadDemo = () => { setLots(DEMO_LOTS); setSells(DEMO_SELLS); setTaxYear(2025); setTab("summary"); };
  const addLot = () => {
    if (!lotForm.symbol || !lotForm.amount || !lotForm.costPerUnit) return;
    const lot = { id: Date.now(), symbol: lotForm.symbol.toUpperCase().trim(), name: lotForm.name.trim() || lotForm.symbol.toUpperCase(), amount: parseFloat(lotForm.amount), costPerUnit: parseFloat(lotForm.costPerUnit), date: lotForm.date };
    setLots(prev => [...prev, lot]);
    setLotForm(EMPTY_LOT); setShowLotForm(false);
  };
  const addSell = () => {
    if (!sellForm.symbol || !sellForm.amount || !sellForm.pricePerUnit) return;
    const sell = { id: Date.now(), symbol: sellForm.symbol.toUpperCase().trim(), amount: parseFloat(sellForm.amount), pricePerUnit: parseFloat(sellForm.pricePerUnit), portfolioValue: parseFloat(sellForm.portfolioValue) || null, date: sellForm.date, notes: sellForm.notes };
    setSells(prev => [...prev, sell]);
    setSellForm(EMPTY_SELL); setShowSellForm(false);
  };
  const deleteLot  = (id) => setLots(prev => prev.filter(l => l.id !== id));
  const deleteSell = (id) => setSells(prev => prev.filter(s => s.id !== id));

  /* ─── Render ──────────────────────────────────────────────────────── */
  const ENVELOPES = [
    { id: "crypto",  label: "Crypto",         icon: <Calculator size={14} /> },
    { id: "pea_cto", label: "PEA & CTO",       icon: <Landmark size={14} /> },
    { id: "av",      label: "Assurance-Vie",   icon: <Shield size={14} /> },
    { id: "immo",    label: "Immobilier",      icon: <Home size={14} /> },
  ];

  const calcInput = (style = {}) => ({ ...INPUT, ...style });

  return (
    <div className="flex flex-col gap-6">

      {/* ══ En-tête ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: T.text }}>Fiscalité</h1>
            <p style={{ color: T.muted }}>Crypto · PEA · CTO · Assurance-Vie · Immobilier</p>
          </div>
          {envelope === "crypto" && (
            <div className="flex items-center gap-2 flex-wrap">
              {lots.length === 0 && (
                <button onClick={loadDemo} style={{ background: "rgba(91,141,239,0.12)", border: `1px solid ${T.blue}44`, color: T.blue, padding: "8px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                  <FlaskConical size={14} /> Données démo
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 12px" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>Année</span>
                <select value={taxYear} onChange={e => setTaxYear(+e.target.value)}
                  style={{ background: "transparent", border: "none", color: T.text, fontWeight: 700, fontSize: 14, outline: "none", cursor: "pointer" }}>
                  {[CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3, CURRENT_YEAR].map(y => (
                    <option key={y} value={y} style={{ background: T.card }}>{y}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => generate2086PDF(pmca, taxYear)} title="Formulaire 2086 pré-rempli (méthode légale PMCA) — aide à la déclaration"
                style={{ background: T.green, border: "none", color: "#fff", padding: "8px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                <Download size={14} /> Formulaire 2086 {taxYear}
              </button>
              <button onClick={() => exportFiscalRecap(cessions, lots, taxYear)} title="Export CSV interne (vue FIFO indicative)"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, color: T.muted, padding: "8px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                <Download size={14} /> CSV interne
              </button>
            </div>
          )}
        </div>

        {/* Envelope nav */}
        <div className="flex gap-2 flex-wrap">
          {ENVELOPES.map(e => (
            <button key={e.id} onClick={() => setEnvelope(e.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              background: envelope === e.id ? T.blue : "rgba(255,255,255,0.05)",
              color: envelope === e.id ? "#fff" : T.muted,
              transition: "all 0.15s",
            }}>
              {e.icon} {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CRYPTO ══════════════════════════════════════════════════════ */}
      {envelope === "crypto" && (
        <>
          <div className="flex items-start gap-2" style={{
            background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.3)`,
            borderRadius: 12, padding: "12px 16px", fontSize: 12, color: T.text, lineHeight: 1.6,
          }}>
            <AlertTriangle size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0 }}>
              <strong style={{ color: "#f59e0b" }}>Vue interne en FIFO (indicative).</strong>{" "}
              Le tableau ci-dessous utilise le FIFO pour un aperçu rapide. Pour votre <strong>déclaration officielle</strong>, utilisez le bouton <strong>« Formulaire 2086 »</strong> en haut : il applique la méthode légale <strong>PMCA</strong> (art. 150 VH bis CGI) et pré-remplit le formulaire.
              <br />
              Renseignez la <em>valeur globale de votre portefeuille</em> à chaque vente pour un calcul exact. Document d'aide — vérifiez avant de reporter sur impots.gouv.fr.
            </p>
          </div>

          {/* Cartes résumé */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
            {[
              { label: "Gains réalisés",    value: eur(totalProfit), color: T.green, icon: TrendingUp },
              { label: "Pertes réalisées",  value: eur(totalLoss),   color: T.red,   icon: TrendingDown },
              { label: "Gain net",          value: eur(netGain),     color: netGain >= 0 ? T.green : T.red, icon: netGain >= 0 ? TrendingUp : TrendingDown },
              {
                label: "Impôt estimé 30 %",
                value: isExonere ? "0 €" : eur(estimTax),
                color: isExonere ? T.green : T.amber,
                icon: Percent,
                sub: isExonere ? `Exonéré — seuil de cession ${SEUIL_EXONERATION_CESSION} €/an non atteint` : null,
              },
              ...(harvestSave > 0 && netGain > 0 && !isExonere ? [{ label: "Économie harvesting", value: eur(harvestSave), color: T.amber, icon: Zap }] : []),
            ].map(c => (
              <div key={c.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px" }}>
                <div className="flex items-start justify-between">
                  <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{c.label}</div>
                  <c.icon size={16} style={{ color: c.color, opacity: 0.65 }} />
                </div>
                <div style={{ color: c.color, fontSize: 22, fontWeight: 800, marginTop: 6 }}>{c.value}</div>
                {c.sub && <div style={{ color: T.muted, fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Répartition par actif */}
          {byAsset.length > 0 && (
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Gains par actif — {taxYear}</span>
                <span style={{ color: T.muted, fontSize: 12 }}>{byAsset.length} actif{byAsset.length > 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr", padding: "9px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                <span>Actif</span>
                <span style={{ textAlign: "right" }}>Produits cession</span>
                <span style={{ textAlign: "right" }}>Plus-value</span>
                <span style={{ textAlign: "right" }}>Moins-value</span>
                <span style={{ textAlign: "right" }}>PFU estimé (30 %)</span>
              </div>
              {byAsset.map(a => (
                <div key={a.symbol} className="hover:bg-white/[0.025] transition-colors" style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr", padding: "13px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 13 }}>
                  <span style={{ color: T.text, fontWeight: 800, fontSize: 15 }}>{a.symbol}</span>
                  <span style={{ textAlign: "right", color: T.muted }}>{eur(a.proceeds)}</span>
                  <span style={{ textAlign: "right", color: T.green, fontWeight: 600 }}>{a.gain > 0 ? `+${eur(a.gain)}` : "—"}</span>
                  <span style={{ textAlign: "right", color: T.red,   fontWeight: 600 }}>{a.loss < 0 ? eur(a.loss) : "—"}</span>
                  <div style={{ textAlign: "right" }}>
                    {isExonere
                      ? <span style={{ color: T.green, fontSize: 12 }}>Exonéré</span>
                      : a.tax > 0
                        ? <span style={{ color: T.red, fontWeight: 700 }}>{eur(a.tax)}</span>
                        : <span style={{ color: T.green, fontSize: 12 }}>0 €</span>}
                  </div>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr", padding: "12px 20px", borderTop: `2px solid ${T.border}`, fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: T.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>TOTAL</span>
                <span style={{ textAlign: "right", color: T.muted }}>{eur(byAsset.reduce((s, a) => s + a.proceeds, 0))}</span>
                <span style={{ textAlign: "right", color: T.green }}>{totalProfit > 0 ? `+${eur(totalProfit)}` : "—"}</span>
                <span style={{ textAlign: "right", color: T.red }}>{totalLoss < 0 ? eur(totalLoss) : "—"}</span>
                <span style={{ textAlign: "right", color: isExonere ? T.green : estimTax > 0 ? T.red : T.muted }}>{isExonere ? "Exonéré" : eur(estimTax)}</span>
              </div>
            </div>
          )}

          {/* Tax-loss harvesting */}
          {harvestOps.length > 0 && netGain > 0 && (
            <div style={{ background: "rgba(200,136,58,0.08)", border: `1px solid rgba(200,136,58,0.25)`, borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <TrendingDown size={16} style={{ color: T.amber }} />
                <span style={{ color: T.amber, fontWeight: 700, fontSize: 14 }}>
                  Tax-Loss Harvesting — économie potentielle : {eur(harvestSave)}
                  <InfoTooltip text="Tax-Loss Harvesting : réaliser une moins-value latente (vendre un actif en perte) pour compenser une plus-value imposable et réduire le PFU dû. Vous pouvez ensuite racheter l'actif si vous souhaitez conserver votre exposition." align="left" />
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 100px 100px 100px", gap: "8px 0", fontSize: 12, marginBottom: 8 }}>
                {["Actif","Position","Valeur actuelle","Perte latente","Économie PFU"].map(h => (
                  <span key={h} style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", textAlign: h !== "Actif" && h !== "Position" ? "right" : "left" }}>{h}</span>
                ))}
              </div>
              {harvestOps.slice(0, 5).map(h => (
                <div key={h.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 100px 100px 100px", alignItems: "center", fontSize: 12, padding: "6px 0", borderTop: `1px solid rgba(200,136,58,0.12)` }}>
                  <span style={{ color: T.text, fontWeight: 700 }}>{h.symbol}</span>
                  <span style={{ color: T.muted }}>{h.remaining.toFixed(4)} unités · coût {eur(h.costBasis)}</span>
                  <span style={{ textAlign: "right", color: T.muted }}>{eur(h.currentValue)}</span>
                  <span style={{ textAlign: "right", color: T.red, fontWeight: 600 }}>{eur(h.unrealized)}</span>
                  <span style={{ textAlign: "right", color: T.amber, fontWeight: 700 }}>{eur(h.taxSaving)}</span>
                </div>
              ))}
              {(() => {
                const totalHarvestLoss = harvestOps.reduce((s, h) => s + (-h.unrealized), 0);
                const offsetUsed       = harvestSave / TAX_RATE;
                const pctBillErased    = estimTax > 0 ? Math.round((harvestSave / estimTax) * 100) : 0;
                return (
                  <p style={{ color: T.muted, fontSize: 11, marginTop: 12, lineHeight: 1.7 }}>
                    Ces <strong style={{ color: T.text }}>{eur(totalHarvestLoss)}</strong> de pertes latentes permettraient de compenser{" "}
                    <strong style={{ color: T.text }}>{eur(offsetUsed)}</strong> de plus-values imposables — soit{" "}
                    <strong style={{ color: T.amber }}>{pctBillErased} % de votre facture fiscale</strong> effacée.{" "}
                    En France, il n'existe aucune règle <em>anti-wash sale</em> : vous pouvez revendre ces positions et les racheter immédiatement.{" "}
                    Attention : les moins-values crypto ne sont pas reportables sur l'exercice suivant — agissez avant le 31 décembre {taxYear}.
                  </p>
                );
              })()}
            </div>
          )}

          {/* Onglets */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, width: "fit-content", flexWrap: "wrap" }}>
            {[
              { id: "summary", label: `Cessions ${taxYear}`,     icon: FileText },
              { id: "lots",    label: `Achats (${lots.length})`,  icon: ArrowDownToLine },
              { id: "sells",   label: `Ventes (${sells.length})`, icon: ArrowUpFromLine },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5" style={{
                padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: tab === t.id ? T.blue : "transparent",
                color:      tab === t.id ? "#fff" : T.muted,
              }}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* Cessions */}
          {tab === "summary" && (
            sessionsInYear.length === 0 ? (
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center" }}>
                <FileText size={36} style={{ color: T.muted, opacity: 0.3, margin: "0 auto 16px", display: "block" }} />
                <div style={{ color: T.text, fontWeight: 600, marginBottom: 8 }}>Aucune cession en {taxYear}</div>
                <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Saisissez vos achats puis vos ventes, ou chargez les données démo</div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={loadDemo} style={{ background: T.blue, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <FlaskConical size={14} /> Données démo
                  </button>
                  <button onClick={() => setTab("lots")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, color: T.muted, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                    Saisir des achats
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {isExonere && (
                <div className="flex items-start gap-2" style={{
                  background: "rgba(34,199,154,0.08)", border: `1px solid rgba(34,199,154,0.25)`,
                  borderRadius: 12, padding: "12px 16px", fontSize: 12, color: T.text, lineHeight: 1.6,
                }}>
                  <CheckCircle2 size={14} style={{ color: T.green, flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: T.green }}>Plus-value exonérée d'impôt.</strong>{" "}
                    Le total des prix de cession en {taxYear} ({eur(totalProceeds)}) ne dépasse pas le seuil de {SEUIL_EXONERATION_CESSION} €/an (art. 150 VH bis CGI) — aucun PFU n'est dû sur ces cessions, quel que soit le gain réalisé.
                  </p>
                </div>
              )}
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "visible" }}>
                <div style={{ display: "grid", gridTemplateColumns: "92px 56px 82px 108px 108px 110px 88px", padding: "10px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  <span>Date</span><span>Actif</span>
                  <span style={{ textAlign: "right" }}>Qté</span>
                  <span style={{ textAlign: "right" }}>Cession</span>
                  <span style={{ textAlign: "right" }}>Coût FIFO<InfoTooltip text="FIFO (First In, First Out) : le coût retenu ici est celui des unités achetées en premier. La méthode légale française (PMCA — prix moyen pondéré d'acquisition du portefeuille global, art. 150 VH bis CGI) donne un coût différent : ces montants sont indicatifs, pas votre déclaration officielle." align="right" /></span>
                  <span style={{ textAlign: "right" }}>+/- value</span>
                  <span style={{ textAlign: "right" }}>PFU 30 %</span>
                </div>
                {sessionsInYear.map(c => (
                  <div key={c.id} className="hover:bg-white/[0.025] transition-colors" style={{ display: "grid", gridTemplateColumns: "92px 56px 82px 108px 108px 110px 88px", padding: "11px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: T.muted }}>{c.date}</span>
                    <span style={{ color: T.text, fontWeight: 700 }}>{c.symbol}</span>
                    <span style={{ textAlign: "right", color: T.muted }}>{c.amount.toFixed(4)}</span>
                    <span style={{ textAlign: "right", color: T.text }}>{eur(c.proceeds)}</span>
                    <span style={{ textAlign: "right", color: T.muted }}>{eur(c.costBasis)}</span>
                    <span style={{ textAlign: "right", fontWeight: 700, color: c.gain >= 0 ? T.green : T.red }}>
                      {c.gain >= 0 ? "+" : ""}{eur(c.gain)}
                    </span>
                    <span style={{ textAlign: "right", color: isExonere ? T.green : c.tax > 0 ? T.red : T.muted, fontWeight: 600 }}>
                      {isExonere ? "Exonéré" : c.tax > 0 ? eur(c.tax) : "0 €"}
                    </span>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "92px 56px 82px 108px 108px 110px 88px", padding: "12px 16px", borderTop: `2px solid ${T.border}`, fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: T.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>TOTAL</span>
                  <span /><span />
                  <span style={{ textAlign: "right", color: T.text }}>{eur(sessionsInYear.reduce((s, c) => s + c.proceeds, 0))}</span>
                  <span style={{ textAlign: "right", color: T.muted }}>{eur(sessionsInYear.reduce((s, c) => s + c.costBasis, 0))}</span>
                  <span style={{ textAlign: "right", color: netGain >= 0 ? T.green : T.red }}>{netGain >= 0 ? "+" : ""}{eur(netGain)}</span>
                  <span style={{ textAlign: "right", color: isExonere ? T.green : T.red }}>{isExonere ? "Exonéré" : eur(estimTax)}</span>
                </div>
              </div>
              </div>
            )
          )}

          {/* Achats */}
          {tab === "lots" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowLotForm(true)} style={{ background: T.blue, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={15} /> Ajouter un achat
                </button>
              </div>
              {lots.length === 0 ? (
                <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(91,141,239,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <ArrowDownToLine size={24} style={{ color: T.blue }} />
                  </div>
                  <div style={{ color: T.text, fontWeight: 600, marginBottom: 8 }}>Aucun lot d'achat</div>
                  <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Ajoutez vos achats ou chargez les données démo</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setShowLotForm(true)} style={{ background: T.blue, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <Plus size={14} /> Ajouter un achat
                    </button>
                    <button onClick={loadDemo} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, color: T.muted, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <FlaskConical size={14} /> Données démo
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "90px 70px 110px 110px 108px 1fr 36px", padding: "10px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    <span>Date</span><span>Symbole</span><span>Nom</span>
                    <span style={{ textAlign: "right" }}>Quantité</span>
                    <span style={{ textAlign: "right" }}>Prix/unité (€)</span>
                    <span style={{ textAlign: "right" }}>Coût total</span>
                    <span />
                  </div>
                  {lots.map(l => (
                    <div key={l.id} className="hover:bg-white/[0.025] transition-colors" style={{ display: "grid", gridTemplateColumns: "90px 70px 110px 110px 108px 1fr 36px", padding: "11px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: T.muted }}>{l.date}</span>
                      <span style={{ color: T.text, fontWeight: 700 }}>{l.symbol}</span>
                      <span style={{ color: T.muted }}>{l.name}</span>
                      <span style={{ textAlign: "right", color: T.text }}>{l.amount.toFixed(6)}</span>
                      <span style={{ textAlign: "right", color: T.muted }}>{eur(l.costPerUnit)}</span>
                      <span style={{ textAlign: "right", color: T.text, fontWeight: 600 }}>{eur(l.amount * l.costPerUnit)}</span>
                      <button onClick={() => deleteLot(l.id)} aria-label="Supprimer le lot" className="hover:text-[#ff5c7a] transition-colors" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "90px 70px 110px 110px 108px 1fr 36px", padding: "12px 16px", borderTop: `2px solid ${T.border}`, fontSize: 13, fontWeight: 700 }}>
                    <span style={{ color: T.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>TOTAL</span>
                    <span /><span /><span /><span />
                    <span style={{ textAlign: "right", color: T.text }}>{eur(lots.reduce((s, l) => s + l.amount * l.costPerUnit, 0))}</span>
                    <span />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ventes */}
          {tab === "sells" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setShowSellForm(true)} style={{ background: T.red, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={15} /> Enregistrer une vente
                </button>
              </div>
              {sells.length === 0 ? (
                <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,92,122,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <ArrowUpFromLine size={24} style={{ color: T.red }} />
                  </div>
                  <div style={{ color: T.text, fontWeight: 600, marginBottom: 8 }}>Aucune vente</div>
                  <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Saisissez vos cessions pour calculer l'impôt</div>
                  <button onClick={() => setShowSellForm(true)} style={{ background: T.red, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6, margin: "0 auto" }}>
                    <Plus size={14} /> Enregistrer une vente
                  </button>
                </div>
              ) : (
                <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "90px 70px 100px 110px 1fr 36px", padding: "10px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    <span>Date</span><span>Symbole</span>
                    <span style={{ textAlign: "right" }}>Quantité</span>
                    <span style={{ textAlign: "right" }}>Prix/unité (€)</span>
                    <span style={{ textAlign: "right" }}>Produit cession</span>
                    <span />
                  </div>
                  {sells.map(s => (
                    <div key={s.id} className="hover:bg-white/[0.025] transition-colors" style={{ display: "grid", gridTemplateColumns: "90px 70px 100px 110px 1fr 36px", padding: "11px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: T.muted }}>{s.date}</span>
                      <span style={{ color: T.text, fontWeight: 700 }}>{s.symbol}</span>
                      <span style={{ textAlign: "right", color: T.muted }}>{s.amount.toFixed(6)}</span>
                      <span style={{ textAlign: "right", color: T.muted }}>{eur(s.pricePerUnit)}</span>
                      <span style={{ textAlign: "right", color: T.green, fontWeight: 600 }}>{eur(s.amount * s.pricePerUnit)}</span>
                      <button onClick={() => deleteSell(s.id)} aria-label="Supprimer la vente" className="hover:text-[#ff5c7a] transition-colors" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
            <span style={{ color: T.text, fontWeight: 600 }}>Tableau FIFO</span> = aperçu interne indicatif ·
            Le <strong>Formulaire 2086</strong> (bouton en haut) applique la méthode légale <strong>PMCA</strong> (art. 150 VH bis CGI), quote-part du portefeuille global ·
            PFU 30 % (art. 200 A CGI) · Document d'aide à la déclaration — vérifiez vos montants avant report
            {serverOk && <span style={{ color: T.green, marginLeft: 8 }}>· Serveur connecté</span>}
          </div>
        </>
      )}

      {/* ══ PEA & CTO ═══════════════════════════════════════════════════ */}
      {envelope === "pea_cto" && (
        <div className="flex flex-col gap-5">

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "PEA ≥ 5 ans — IR",     value: "0 %",    sub: "+ 17,2 % PS",          color: T.green },
              { label: "PEA < 5 ans / CTO",     value: "30 %",   sub: "12,8 % IR + 17,2 % PS", color: T.red },
              { label: "Plafond PEA",            value: "150 k€", sub: "225 k€ avec PEA-PME",   color: T.cyan },
              { label: "Dividendes dans PEA",    value: "0 %",    sub: "Tant qu'ils restent",    color: T.green },
            ].map(c => (
              <div key={c.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                <div style={{ color: c.color, fontSize: 26, fontWeight: 800 }}>{c.value}</div>
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Règles clés */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              {
                icon: <Landmark size={16} style={{ color: T.cyan }} />,
                title: "PEA — Plan d'Épargne en Actions",
                color: "rgba(0,180,216,0.08)",
                border: "rgba(0,180,216,0.25)",
                items: [
                  ["good",   "≥ 5 ans : 0 % IR, seulement 17,2 % PS sur les gains"],
                  ["bad",    "< 5 ans : PFU 30 % + clôture OBLIGATOIRE du plan"],
                  ["tip",    "Ouvrir un PEA dès aujourd'hui même avec 1 € — le délai de 5 ans commence à l'ouverture"],
                  ["cycle",  "Après 5 ans : retraits partiels sans clôture, le plan continue de capitaliser"],
                  ["global", "Limité aux actions zone UE/EEE + quelques ETF éligibles (MSCI World via synthétique)"],
                ],
              },
              {
                icon: <TrendingUp size={16} style={{ color: T.amber }} />,
                title: "CTO — Compte-Titres Ordinaire",
                color: "rgba(245,166,35,0.06)",
                border: "rgba(245,166,35,0.2)",
                items: [
                  ["info",   "PFU 30 % sur toutes les plus-values et dividendes"],
                  ["tip",    "Option barème progressif si votre TMI < 12,8 % (cases déclaration 2042-C)"],
                  ["global", "Aucun plafond, accès à toutes les bourses mondiales"],
                  ["down",   "Moins-values imputables sur plus-values de même nature pendant 10 ans"],
                  ["warn",   "Titres acquis avant 2018 : abattements 50 % (>2 ans) / 65 % (>8 ans) encore possibles"],
                ],
              },
            ].map(card => (
              <div key={card.title} style={{ background: card.color, border: `1px solid ${card.border}`, borderRadius: 14, padding: "16px 18px" }}>
                <div className="flex items-center gap-2 mb-3">
                  {card.icon}
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{card.title}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {card.items.map(([kind, text], i) => (
                    <RuleItem key={i} kind={kind}>{text}</RuleItem>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Calculateur */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 24px" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} style={{ color: T.blue }} />
              <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Simulateur PEA vs CTO</span>
            </div>
            <div className="flex gap-4 flex-wrap mb-4">
              <div style={{ flex: "1 1 180px" }}>
                <label style={LBL}>Gain net à encaisser (€)</label>
                <input type="number" value={peaCalc.gain} onChange={e => setPeaCalc(p => ({ ...p, gain: e.target.value }))}
                  placeholder="Ex. 50 000" className={INPUT_FOCUS_CLASS} style={INPUT} />
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <label style={LBL}>Ancienneté du PEA</label>
                <div className="flex gap-2">
                  {[["<5", "Moins de 5 ans"], ["5+", "5 ans ou plus"]].map(([val, lbl]) => (
                    <button key={val} onClick={() => setPeaCalc(p => ({ ...p, years: val }))} style={{
                      flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${peaCalc.years === val ? T.blue : T.border}`,
                      background: peaCalc.years === val ? "rgba(91,141,239,0.15)" : "transparent",
                      color: peaCalc.years === val ? T.blue : T.muted, fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
            </div>

            {peaResult && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 8 }}>
                {[
                  {
                    label: peaCalc.years === "5+" ? "PEA ≥ 5 ans" : "PEA < 5 ans",
                    total: peaCalc.years === "5+" ? peaResult.peaGe5.total : peaResult.peaLt5.total,
                    detail: peaCalc.years === "5+" ? `IR : 0 € · PS : ${eur(peaResult.peaGe5.ps)}` : `IR : ${eur(peaResult.peaLt5.ir)} · PS : ${eur(peaResult.peaLt5.ps)}`,
                    note: peaCalc.years === "5+" ? peaResult.peaGe5.note : peaResult.peaLt5.note,
                    color: peaCalc.years === "5+" ? T.green : T.red,
                    bg: peaCalc.years === "5+" ? "rgba(34,199,154,0.08)" : "rgba(239,68,68,0.08)",
                    border: peaCalc.years === "5+" ? "rgba(34,199,154,0.25)" : "rgba(239,68,68,0.25)",
                  },
                  {
                    label: "CTO",
                    total: peaResult.cto.total,
                    detail: `IR : ${eur(peaResult.cto.ir)} · PS : ${eur(peaResult.cto.ps)}`,
                    note: "Standard",
                    color: T.red,
                    bg: "rgba(239,68,68,0.06)",
                    border: "rgba(239,68,68,0.2)",
                  },
                  ...(peaCalc.years === "5+" && peaResult.saving > 0 ? [{
                    label: "Économie PEA vs CTO",
                    total: peaResult.saving,
                    detail: `Soit ${((peaResult.saving / peaResult.cto.total) * 100).toFixed(0)} % d'impôt en moins`,
                    note: "Grâce à l'exonération IR",
                    color: T.amber,
                    bg: "rgba(245,166,35,0.08)",
                    border: "rgba(245,166,35,0.25)",
                  }] : []),
                ].map(r => (
                  <div key={r.label} style={{ background: r.bg, border: `1px solid ${r.border}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>{r.label}</div>
                    <div style={{ color: r.color, fontSize: 22, fontWeight: 800, marginBottom: 2 }}>{eur(r.total)}</div>
                    <div style={{ color: T.muted, fontSize: 11 }}>{r.detail}</div>
                    <div style={{ color: T.muted, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>{r.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stratégie */}
          <div style={{ background: "rgba(91,141,239,0.07)", border: `1px solid rgba(91,141,239,0.2)`, borderRadius: 12, padding: "14px 18px", fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
            <span style={{ color: T.blue, fontWeight: 700 }}>Stratégie optimale :</span> Ouvrez un PEA dès maintenant (même avec 100 €) pour lancer le compteur des 5 ans. Investissez les actions mondiales via un ETF MSCI World synthétique (Amundi, Lyxor) éligible PEA. En parallèle, gardez le CTO pour les titres hors UE (Chine, Inde, Small Caps US) et les obligations. La combinaison PEA + CTO + PEA-PME offre 375 k€ de capacité de versement et une fiscalité optimisée.
          </div>
        </div>
      )}

      {/* ══ ASSURANCE-VIE ════════════════════════════════════════════════ */}
      {envelope === "av" && (
        <div className="flex flex-col gap-5">

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "AV ≥ 8 ans — IR",         value: "7,5 %",   sub: "+ 17,2 % PS",                  color: T.green },
              { label: "Abattement annuel (seul)",  value: "4 600 €", sub: "9 200 € pour un couple",       color: T.cyan },
              { label: "AV < 8 ans",                value: "30 %",    sub: "Même taux que le CTO",          color: T.amber },
              { label: "Avantage succession",        value: "152 500 €", sub: "Hors droits par bénéficiaire", color: T.green },
            ].map(c => (
              <div key={c.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                <div style={{ color: c.color, fontSize: c.value.length > 6 ? 18 : 26, fontWeight: 800 }}>{c.value}</div>
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Règles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              {
                icon: <Shield size={16} style={{ color: T.green }} />,
                title: "Fiscalité des rachats",
                color: "rgba(34,199,154,0.06)",
                border: "rgba(34,199,154,0.2)",
                items: [
                  ["time", "< 8 ans : PFU 30 % (12,8 % IR + 17,2 % PS) — comme un CTO"],
                  ["good", "≥ 8 ans : 7,5 % IR + 17,2 % PS APRÈS abattement 4 600 € / an"],
                  ["warn", "Si primes > 150 k€ (tous contrats) : 12,8 % IR sur la fraction dépassant 150 k€"],
                  ["calc", "Seule la part de gains est imposée, pas le capital : rachat partiel → gains * (rachat / valeur totale)"],
                  ["cycle","Les PS (17,2 %) s'appliquent sur les gains BRUTS, sans abattement"],
                ],
              },
              {
                icon: <Shield size={16} style={{ color: T.amber }} />,
                title: "Avantage successoral",
                color: "rgba(245,166,35,0.06)",
                border: "rgba(245,166,35,0.2)",
                items: [
                  ["gift", "Primes versées avant 70 ans : 152 500 € exonérés par bénéficiaire, hors droits de succession"],
                  ["stat", "Au-delà : 20 % jusqu'à 700 k€, puis 31,25 % (vs 45 % pour la succession classique)"],
                  ["age",  "Primes après 70 ans : seuls les intérêts sont exonérés ; le capital >30 500 € (global) rentre dans la succession"],
                  ["note", "Rédiger une clause bénéficiaire précise (nominatif + quote-part) — une clause standard 'conjoint ou enfants' peut bloquer les fonds des années"],
                ],
              },
            ].map(card => (
              <div key={card.title} style={{ background: card.color, border: `1px solid ${card.border}`, borderRadius: 14, padding: "16px 18px" }}>
                <div className="flex items-center gap-2 mb-3">
                  {card.icon}
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{card.title}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {card.items.map(([kind, text], i) => (
                    <RuleItem key={i} kind={kind}>{text}</RuleItem>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Calculateur */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 24px" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} style={{ color: T.blue }} />
              <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Simulateur Assurance-Vie</span>
            </div>
            <div className="flex gap-4 flex-wrap mb-2">
              <div style={{ flex: "1 1 160px" }}>
                <label style={LBL}>Total versements (€)</label>
                <input type="number" value={avCalc.versements} onChange={e => setAvCalc(p => ({ ...p, versements: e.target.value }))}
                  placeholder="Ex. 100 000" className={INPUT_FOCUS_CLASS} style={INPUT} />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label style={LBL}>Gains à encaisser (€)</label>
                <input type="number" value={avCalc.gains} onChange={e => setAvCalc(p => ({ ...p, gains: e.target.value }))}
                  placeholder="Ex. 30 000" className={INPUT_FOCUS_CLASS} style={INPUT} />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label style={LBL}>Ancienneté du contrat</label>
                <div className="flex gap-2">
                  {[["<8", "< 8 ans"], ["8+", "≥ 8 ans"]].map(([val, lbl]) => (
                    <button key={val} onClick={() => setAvCalc(p => ({ ...p, age: val }))} style={{
                      flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${avCalc.age === val ? T.blue : T.border}`,
                      background: avCalc.age === val ? "rgba(91,141,239,0.15)" : "transparent",
                      color: avCalc.age === val ? T.blue : T.muted, fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label style={LBL}>Situation</label>
                <div className="flex gap-2">
                  {[[false, "Seul"], [true, "Couple"]].map(([val, lbl]) => (
                    <button key={String(val)} onClick={() => setAvCalc(p => ({ ...p, couple: val }))} style={{
                      flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${avCalc.couple === val ? T.blue : T.border}`,
                      background: avCalc.couple === val ? "rgba(91,141,239,0.15)" : "transparent",
                      color: avCalc.couple === val ? T.blue : T.muted, fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
            </div>

            {avResult && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
                {[
                  {
                    label: avCalc.age === "8+" ? "AV ≥ 8 ans" : "AV < 8 ans",
                    ir: avResult.ir, ps: avResult.ps, total: avResult.total,
                    note: avCalc.age === "8+" ? `Abattement ${eur(avResult.abattement)} appliqué` : "PFU standard",
                    color: avResult.total < avResult.cto ? T.green : T.amber,
                    bg: "rgba(34,199,154,0.07)", border: "rgba(34,199,154,0.2)",
                  },
                  {
                    label: "CTO (référence)",
                    ir: avResult.cto * (0.128 / 0.30), ps: avResult.cto * (0.172 / 0.30), total: avResult.cto,
                    note: "PFU 30 % sans abattement",
                    color: T.red, bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.2)",
                  },
                  ...(avResult.total < avResult.cto ? [{
                    label: "Économie vs CTO",
                    total: avResult.cto - avResult.total,
                    note: `Soit ${(((avResult.cto - avResult.total) / avResult.cto) * 100).toFixed(0)} % d'impôt économisé`,
                    color: T.amber, bg: "rgba(245,166,35,0.08)", border: "rgba(245,166,35,0.25)",
                  }] : []),
                ].map(r => (
                  <div key={r.label} style={{ background: r.bg, border: `1px solid ${r.border}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>{r.label}</div>
                    <div style={{ color: r.color, fontSize: 22, fontWeight: 800, marginBottom: 2 }}>{eur(r.total)}</div>
                    {r.ir != null && <div style={{ color: T.muted, fontSize: 11 }}>IR : {eur(r.ir)} · PS : {eur(r.ps)}</div>}
                    <div style={{ color: T.muted, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>{r.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conseil */}
          <div style={{ background: "rgba(91,141,239,0.07)", border: `1px solid rgba(91,141,239,0.2)`, borderRadius: 12, padding: "14px 18px", fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
            <span style={{ color: T.blue, fontWeight: 700 }}>Stratégie optimale :</span> Ouvrez un contrat AV dès maintenant pour lancer le compteur des 8 ans. Privilégiez les contrats multisupports (ETF en unités de compte) à frais d'entrée et de gestion réduits. Effectuez vos rachats après 8 ans par tranches annuelles pour maximiser l'abattement de 4 600 € / 9 200 €. En matière de succession, l'AV est l'outil le plus puissant : chaque bénéficiaire peut recevoir 152 500 € sans aucun impôt.
          </div>
        </div>
      )}

      {/* ══ IMMOBILIER ═══════════════════════════════════════════════════ */}
      {envelope === "immo" && (
        <div className="flex flex-col gap-5">

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "Résidence principale",  value: "0 %",    sub: "Exonération totale",          color: T.green },
              { label: "Locatif — taux PV",      value: "36,2 %", sub: "19 % IR + 17,2 % PS",         color: T.red },
              { label: "Exonération IR",         value: "22 ans", sub: "Abattements progressifs",      color: T.cyan },
              { label: "Exonération PS",         value: "30 ans", sub: "1,65 %/an puis 9 %/an",        color: T.amber },
            ].map(c => (
              <div key={c.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                <div style={{ color: c.color, fontSize: 24, fontWeight: 800 }}>{c.value}</div>
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Modes calcul */}
          <div className="flex gap-2">
            {[["pv", "Plus-values immobilières"], ["loc", "Revenus locatifs"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setImmoMode(val)} style={{
                padding: "9px 18px", borderRadius: 10, border: `1px solid ${immoMode === val ? T.blue : T.border}`,
                background: immoMode === val ? "rgba(91,141,239,0.15)" : "transparent",
                color: immoMode === val ? T.blue : T.muted, fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}>{lbl}</button>
            ))}
          </div>

          {/* Calculateur Plus-values */}
          {immoMode === "pv" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  {
                    title: "Abattements IR (exonération à 22 ans)",
                    color: "rgba(0,180,216,0.07)", border: "rgba(0,180,216,0.2)",
                    rows: [
                      ["< 6 ans", "0 %"], ["6 → 21 ans", "6 % / an"], ["22ème année", "+ 4 % → 100 %"], ["≥ 22 ans", "Exonéré IR"],
                    ],
                  },
                  {
                    title: "Abattements PS (exonération à 30 ans)",
                    color: "rgba(245,166,35,0.06)", border: "rgba(245,166,35,0.2)",
                    rows: [
                      ["< 6 ans", "0 %"], ["6 → 21 ans", "1,65 % / an"], ["22ème année", "+ 1,6 %"], ["23 → 30 ans", "9 % / an → 100 %"],
                    ],
                  },
                ].map(card => (
                  <div key={card.title} style={{ background: card.color, border: `1px solid ${card.border}`, borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{card.title}</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <tbody>
                        {card.rows.map(([période, taux]) => (
                          <tr key={période} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ color: T.muted, padding: "5px 0" }}>{période}</td>
                            <td style={{ color: T.text, fontWeight: 700, textAlign: "right", padding: "5px 0" }}>{taux}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 24px" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calculator size={16} style={{ color: T.blue }} />
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Calculateur de plus-value immobilière</span>
                </div>
                <div className="flex gap-4 flex-wrap mb-4">
                  {[
                    { key: "achat", label: "Prix d'acquisition (€)", placeholder: "200 000" },
                    { key: "vente", label: "Prix de vente (€)",       placeholder: "320 000" },
                    { key: "duree", label: "Durée de détention (ans)", placeholder: "12" },
                    { key: "travaux", label: "Travaux réels (€, optionnel)", placeholder: "Forfait 15 % si >5 ans" },
                  ].map(f => (
                    <div key={f.key} style={{ flex: "1 1 180px" }}>
                      <label style={LBL}>{f.label}</label>
                      <input type="number" value={immoCalc[f.key]} placeholder={f.placeholder}
                        onChange={e => setImmoCalc(p => ({ ...p, [f.key]: e.target.value }))} className={INPUT_FOCUS_CLASS} style={INPUT} />
                    </div>
                  ))}
                </div>

                {immoResult && (
                  immoResult.pvBrute <= 0 ? (
                    <div style={{ background: "rgba(34,199,154,0.1)", border: `1px solid rgba(34,199,154,0.3)`, borderRadius: 12, padding: "14px 18px" }}>
                      <span style={{ color: T.green, fontWeight: 700 }}>Pas de plus-value imposable.</span>
                      <span style={{ color: T.muted, fontSize: 12, marginLeft: 8 }}>
                        Prix de revient (achat + frais + travaux) : {eur(immoResult.prixRevient)} — vous vendez moins cher ou au même prix.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                        {[
                          { label: "Plus-value brute",      value: eur(immoResult.pvBrute),  color: T.amber },
                          { label: `IR 19 % (abat. ${immoResult.abatIR} %)`, value: eur(immoResult.ir), color: T.red },
                          { label: `PS 17,2 % (abat. ${immoResult.abatPS.toFixed(1)} %)`, value: eur(immoResult.ps), color: T.red },
                          { label: "TOTAL À PAYER",         value: eur(immoResult.total),    color: immoResult.total > 0 ? T.red : T.green },
                        ].map(r => (
                          <div key={r.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
                            <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>{r.label}</div>
                            <div style={{ color: r.color, fontSize: 20, fontWeight: 800 }}>{r.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, padding: "8px 0" }}>
                        Prix de revient retenu : {eur(immoResult.prixRevient)} (acquisition + frais notaire 7,5 % forfait
                        {parseFloat(immoCalc.travaux) > 0 ? ` + ${eur(parseFloat(immoCalc.travaux))} travaux réels` : immoResult.duree >= 5 ? " + travaux forfait 15 %" : ""})
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* Calculateur Revenus locatifs */}
          {immoMode === "loc" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  {
                    title: "Location nue — régimes",
                    color: "rgba(0,180,216,0.07)", border: "rgba(0,180,216,0.2)",
                    items: [
                      ["info", "Micro-foncier : revenus ≤ 15 000 €/an → abattement 30 % forfaitaire"],
                      ["stat", "Régime réel : déduction charges réelles (intérêts, travaux, gestion, assurance…)"],
                      ["tip",  "Déficit foncier réel imputable sur revenu global à hauteur de 10 700 €/an"],
                      ["warn", "Micro-foncier interdit si vous avez des parts de SCPI ou un Monument Historique"],
                    ],
                  },
                  {
                    title: "LMNP — Meublé non professionnel",
                    color: "rgba(245,166,35,0.06)", border: "rgba(245,166,35,0.2)",
                    items: [
                      ["sofa", "Micro-BIC : revenus ≤ 77 700 €/an → abattement 50 % (71 % si meublé classé)"],
                      ["job",  "LMNP réel : amortissement comptable du bien + travaux → résultat souvent nul ou déficitaire"],
                      ["best", "Meilleur régime fiscal locatif : les amortissements permettent souvent 0 € d'impôt pendant 20-30 ans"],
                      ["note", "Nécessite un expert-comptable et une déclaration 2031 + bilan"],
                    ],
                  },
                ].map(card => (
                  <div key={card.title} style={{ background: card.color, border: `1px solid ${card.border}`, borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{card.title}</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {card.items.map(([kind, text], i) => (
                        <RuleItem key={i} kind={kind}>{text}</RuleItem>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 24px" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calculator size={16} style={{ color: T.blue }} />
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Calculateur revenus locatifs (location nue)</span>
                </div>
                <div className="flex gap-4 flex-wrap mb-4">
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={LBL}>Loyers annuels bruts (€)</label>
                    <input type="number" value={locCalc.loyers} onChange={e => setLocCalc(p => ({ ...p, loyers: e.target.value }))}
                      placeholder="Ex. 12 000" className={INPUT_FOCUS_CLASS} style={INPUT} />
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={LBL}>Régime</label>
                    <div className="flex gap-2">
                      {[["micro", "Micro"], ["reel", "Réel"]].map(([val, lbl]) => (
                        <button key={val} onClick={() => setLocCalc(p => ({ ...p, regime: val }))} style={{
                          flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${locCalc.regime === val ? T.blue : T.border}`,
                          background: locCalc.regime === val ? "rgba(91,141,239,0.15)" : "transparent",
                          color: locCalc.regime === val ? T.blue : T.muted, fontWeight: 600, fontSize: 12, cursor: "pointer",
                        }}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  {locCalc.regime === "reel" && (
                    <div style={{ flex: "1 1 160px" }}>
                      <label style={LBL}>Charges déductibles (€)</label>
                      <input type="number" value={locCalc.charges} onChange={e => setLocCalc(p => ({ ...p, charges: e.target.value }))}
                        placeholder="Intérêts + travaux…" className={INPUT_FOCUS_CLASS} style={INPUT} />
                    </div>
                  )}
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={LBL}>Votre TMI (%)</label>
                    <select value={locCalc.tmi} onChange={e => setLocCalc(p => ({ ...p, tmi: +e.target.value }))} className={INPUT_FOCUS_CLASS} style={{ ...INPUT, cursor: "pointer" }}>
                      {[0, 11, 30, 41, 45].map(t => <option key={t} value={t} style={{ background: T.card }}>{t} %</option>)}
                    </select>
                  </div>
                </div>

                {locResult && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10, marginTop: 4 }}>
                    {[
                      { label: locCalc.regime === "micro" ? "Revenu net (−30 %)" : "Revenu imposable", value: eur(locResult.net), color: T.text },
                      { label: `IR (${locCalc.tmi} %)`, value: eur(locResult.ir), color: T.amber },
                      { label: "PS (17,2 %)",            value: eur(locResult.ps), color: T.amber },
                      { label: "Total charges fiscales", value: eur(locResult.total), color: T.red },
                      { label: "Net après impôt",        value: eur((parseFloat(locCalc.loyers) || 0) - locResult.total), color: T.green },
                    ].map(r => (
                      <div key={r.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>{r.label}</div>
                        <div style={{ color: r.color, fontSize: 20, fontWeight: 800 }}>{r.value}</div>
                      </div>
                    ))}
                    {locResult.deficit > 0 && (
                      <div style={{ background: "rgba(34,199,154,0.08)", border: `1px solid rgba(34,199,154,0.25)`, borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>Déficit foncier</div>
                        <div style={{ color: T.green, fontSize: 20, fontWeight: 800 }}>{eur(locResult.deficit)}</div>
                        <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>Imputable sur revenu global (max 10 700 €)</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* IFI */}
              <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 14, padding: "16px 18px" }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={15} style={{ color: T.red }} />
                  <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>IFI — Impôt sur la Fortune Immobilière</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, fontSize: 12, color: T.muted }}>
                  {[
                    { Icon: Zap,       color: T.red,   content: <>Déclenché si patrimoine immobilier net &gt; <strong style={{ color: T.text }}>800 000 €</strong></> },
                    { Icon: Home,      color: T.blue,  content: <>Résidence principale : abattement <strong style={{ color: T.text }}>30 %</strong></> },
                    { Icon: BarChart3, color: T.amber, content: "Taux : 0,5 % → 0,7 % → 1 % → 1,25 % → 1,5 % (progressif)" },
                    { Icon: Lightbulb, color: T.amber, content: <>Actions, crypto, liquidités : <strong style={{ color: T.green }}>hors IFI</strong> (uniquement l'immobilier)</> },
                  ].map((row, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <row.Icon size={13} style={{ color: row.color, opacity: 0.85, flexShrink: 0, marginTop: 1 }} />
                      <span>{row.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Conseil */}
          <div style={{ background: "rgba(91,141,239,0.07)", border: `1px solid rgba(91,141,239,0.2)`, borderRadius: 12, padding: "14px 18px", fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
            <span style={{ color: T.blue, fontWeight: 700 }}>Stratégie optimale :</span> Pour la location longue durée, le LMNP au réel est presque toujours supérieur à la location nue : l'amortissement comptable du bien (2-4 % / an) génère un déficit BIC qui efface les loyers pendant 20-30 ans. Pour les plus-values, conserver un bien locatif 22 ans efface 100 % de l'IR, et 30 ans efface 100 % des PS. Sur la résidence principale, toute plus-value est totalement exonérée sans aucun délai ni aucun plafond.
          </div>
        </div>
      )}

      {/* ══ Modals ═══════════════════════════════════════════════════════ */}
      {showLotForm && (
        <div className="wt-fade-in" onClick={() => setShowLotForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="wt-scale-in" onClick={e => e.stopPropagation()} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28, width: "100%", maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: T.text, fontWeight: 700, fontSize: 18 }}>Ajouter un achat</h2>
              <button onClick={() => setShowLotForm(false)} aria-label="Fermer" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><X size={18} /></button>
            </div>
            {[
              { label: "Symbole",            key: "symbol",      placeholder: "BTC, ETH, SOL…" },
              { label: "Nom (optionnel)",     key: "name",        placeholder: "Bitcoin" },
              { label: "Quantité",            key: "amount",      placeholder: "0.5", type: "number" },
              { label: "Prix par unité (€)",  key: "costPerUnit", placeholder: "45000", type: "number" },
              { label: "Date d'achat",        key: "date",        type: "date" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={LBL}>{f.label}</label>
                <input type={f.type || "text"} value={lotForm[f.key]} placeholder={f.placeholder || ""} onChange={e => setLotForm(p => ({ ...p, [f.key]: e.target.value }))} className={INPUT_FOCUS_CLASS} style={INPUT} />
              </div>
            ))}
            {lotForm.amount && lotForm.costPerUnit && (
              <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>
                Coût total : <span style={{ color: T.text, fontWeight: 700 }}>{eur(parseFloat(lotForm.amount) * parseFloat(lotForm.costPerUnit))}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLotForm(false)} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, color: T.muted, padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
              <button onClick={addLot} disabled={!lotForm.symbol || !lotForm.amount || !lotForm.costPerUnit}
                style={{ flex: 2, background: T.blue, color: "#fff", border: "none", padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: (!lotForm.symbol || !lotForm.amount || !lotForm.costPerUnit) ? 0.5 : 1 }}>
                Enregistrer l'achat
              </button>
            </div>
          </div>
        </div>
      )}

      {showSellForm && (
        <div className="wt-fade-in" onClick={() => setShowSellForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="wt-scale-in" onClick={e => e.stopPropagation()} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28, width: "100%", maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: T.text, fontWeight: 700, fontSize: 18 }}>Enregistrer une vente</h2>
              <button onClick={() => setShowSellForm(false)} aria-label="Fermer" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><X size={18} /></button>
            </div>
            {[
              { label: "Symbole",                   key: "symbol",       placeholder: "BTC, ETH, SOL…" },
              { label: "Quantité vendue",            key: "amount",       placeholder: "0.1", type: "number" },
              { label: "Prix de vente (€ / unité)",  key: "pricePerUnit", placeholder: "55000", type: "number" },
              { label: "Valeur globale du portefeuille à cette date (€)", key: "portfolioValue", placeholder: "ex. 45000", type: "number", hint: "Valeur de TOUTES vos cryptos au jour de la vente. Requis par la méthode légale (PMCA, formulaire 2086)." },
              { label: "Date de cession",            key: "date",         type: "date" },
              { label: "Notes (optionnel)",          key: "notes",        placeholder: "ex. Binance → EUR" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={LBL}>{f.label}</label>
                <input type={f.type || "text"} value={sellForm[f.key]} placeholder={f.placeholder || ""} onChange={e => setSellForm(p => ({ ...p, [f.key]: e.target.value }))} className={INPUT_FOCUS_CLASS} style={INPUT} />
                {f.hint && <div style={{ color: T.muted, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{f.hint}</div>}
              </div>
            ))}
            {sellForm.amount && sellForm.pricePerUnit && (
              <div style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>
                Produit de cession : <span style={{ color: T.green, fontWeight: 700 }}>{eur(parseFloat(sellForm.amount) * parseFloat(sellForm.pricePerUnit))}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowSellForm(false)} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, color: T.muted, padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 600 }}>Annuler</button>
              <button onClick={addSell} disabled={!sellForm.symbol || !sellForm.amount || !sellForm.pricePerUnit}
                style={{ flex: 2, background: T.red, color: "#fff", border: "none", padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: (!sellForm.symbol || !sellForm.amount || !sellForm.pricePerUnit) ? 0.5 : 1 }}>
                Enregistrer la vente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
