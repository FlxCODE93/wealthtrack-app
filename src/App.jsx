import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { C, glow, ASSET } from "./theme.js";
import { useT } from "./ThemeProvider.jsx";
import InfoTooltip from "./InfoTooltip.jsx";
import Landing from "./Landing.jsx";
import TransactionImportTab from "./TransactionImportTab.jsx";
import Plans   from "./Plans.jsx";
import Crypto  from "./Crypto.jsx";
import Tax     from "./Tax.jsx";
import FI      from "./FI.jsx";
import Or      from "./Or.jsx";
import {
  FinTechLineChart, FinTechAreaChart, FinTechBarChart,
  FinTechPieChart, FinTechScatterChart, FinTechComposedChart,
} from "./ChartComponents.jsx";
import {
  BarChart3, TrendingUp, TrendingDown, Shield, Zap, Wallet, PiggyBank, Home,
  User, LayoutDashboard, ListTree, Plus, Upload, Sparkles, Activity,
  ArrowUpRight, ArrowDownRight, Search, Lock, Sun, LogOut,
  Users, Building2, Briefcase, Check, X, RefreshCw,
  ExternalLink, Landmark, ChevronDown, ChevronUp, CreditCard,
  MessageCircle, Lightbulb, Bitcoin, AlertTriangle, AlertCircle, Calculator, Flag, Info,
  Crown, Star, FileText, ChevronRight, Calendar,
  Trash2, Pencil, Target, Bell, Globe, Repeat, GripVertical,
  Fingerprint, ShieldCheck, Gift, Flame, Trophy, Key,
  Plane, Palmtree, Car, GraduationCap, Coins,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart,
} from "recharts";
import {
  RATE_A, RATE_C, RATE_DISCLAIMER,
  SAVINGS_RATE_CRITICAL, SAVINGS_RATE_TARGET, RATE_SCENARIOS,
  IMMO_DOWN_FRAC, IMMO_NOTARY_FRAC, IMMO_LOAN_RATE, IMMO_LOAN_YEARS, loanPayment,
  fv, fvMonthly, fvDetailedSeries, fvBandSeries, immoDetailedSeries,
  loanFromPayment, longTermGain,
  repayVsInvest, breakevenInvestRate, repayVsInvestSeries, monthlyPaymentFromRemaining,
  perSimulation, perSeries,
  smoothedMonthlyIncome, isIncomeVariable,
  creditMensualite, creditCapitalRestant, creditInteretsRestants,
  creditCoutTotal, creditDateFin, creditsToPassifCategory, creditRemainingMonths,
  creditRevolvingStuck, creditProjectedRestant,
} from "./finance.js";
import { gsap, useGSAP, usePrevious, AnimatedNumber, GrowthValue, celebrate, useCelebrationToast, CONFETTI_COLORS, prefersReducedMotion, ScrollProgressBar } from "./lib/motion.jsx";
import { useLocalStorage } from "./storage.js";
import { API_URL } from "./config.js";
import { authHeader } from "./supabaseClient.js";
import { TX, HISTO, WHATIF, TEST_PROFILES, DEFAULT_PATRIMOINE } from "./seedData.js";
import { MSCI_HISTORY, BTC_HISTORY, ETH_HISTORY } from "./marketHistory.js";
import { calculateHealthScore, getScoreBadge, calculateWhatIfScenarios } from "./healthScore.js";
import { supabase } from "./supabaseClient.js";
import AIChatWidget from "./AIChatWidget.jsx";
import { Card, Stat, Badge, KpiCard, Pill, Field, MiniStat, makeChartTip, renderDonutPctLabel, makeInputStyle } from "./ui.jsx";

/* ------------------------------------------------------------------ */
/*  Icône d'alerte par niveau (remplace les emojis 🔴🟡💡)            */
/* ------------------------------------------------------------------ */
const ALERT_LEVEL_ICON = {
  red:   { Icon: AlertCircle,   color: "#ef4444" },
  amber: { Icon: AlertTriangle, color: "#f59e0b" },
  info:  { Icon: Lightbulb,     color: "#38bdf8" },
};
function AlertLevelIcon({ level = "info", size = 15 }) {
  const { Icon, color } = ALERT_LEVEL_ICON[level] || ALERT_LEVEL_ICON.info;
  return <Icon size={size} style={{ color, flexShrink: 0 }} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/*  Persistence — centralisée dans storage.js (point de swap Supabase)  */
/* ------------------------------------------------------------------ */
// `useLocalStorage` est ré-exporté depuis ./storage.js (cf. import en tête).

const CAT_COLORS = {
  Logement: "#2f9bff", WPEA: "#22c79a", Bourse: "#f5a623", Alimentation: "#a855f7",
  Loisirs: "#ff5a5f", "Frais pro": "#14b8a6", Assurances: "#ec4899",
  Transport: "#eab308", Abonnements: "#8b5cf6", Épargne: "#38bdf8", Santé: "#6366f1",
};

/* ------------------------------------------------------------------ */
/*  Multi-devise — taux de change indicatifs (mis à jour manuellement)*/
/* ------------------------------------------------------------------ */
const FX_RATES    = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.06, CAD: 0.67, JPY: 0.0062, BTC: 95000, ETH: 3200 };
const CURRENCIES  = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY", "BTC", "ETH"];
const toEUR = (native, cur) => (native || 0) * (FX_RATES[cur] || 1);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const eur = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(n) ? n : 0)) + " €";
const pct = (n) => (Number.isFinite(n) ? n : 0).toFixed(1).replace(".", ",") + " %";

// Décale un libellé "Mois AAAA" (ex: "Juil 2025") de `delta` mois (peut être négatif)
const MOIS_ABBR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
function shiftMonthLabel(label, delta) {
  const [moisStr, anneeStr] = label.split(" ");
  let idx = MOIS_ABBR.indexOf(moisStr);
  let annee = parseInt(anneeStr, 10);
  idx += delta;
  while (idx < 0) { idx += 12; annee -= 1; }
  while (idx > 11) { idx -= 12; annee += 1; }
  return `${MOIS_ABBR[idx]} ${annee}`;
}

// Garantit au moins `minMonths` points dans l'historique de patrimoine, en
// extrapolant en arrière (taux de croissance moyen observé) si nécessaire —
// évite que les sélecteurs "2 ans" / "3 ans" affichent toujours les mêmes
// mois quand l'historique réel est plus court que la période demandée.
function ensureHistoriqueDepth(historique, minMonths = 36) {
  if (!historique || historique.length === 0) return historique || [];
  if (historique.length >= minMonths) return historique;

  const first = historique[0];
  const last = historique[historique.length - 1];
  const months = historique.length - 1;
  const growth = months > 0 && first.v > 0 ? Math.pow(last.v / first.v, 1 / months) : 1;
  const safeGrowth = isFinite(growth) && growth > 0 ? growth : 1;

  const missing = minMonths - historique.length;
  const extra = [];
  let v = first.v;
  let label = first.m;
  for (let i = 0; i < missing; i++) {
    v = v / safeGrowth;
    label = shiftMonthLabel(label, -1);
    extra.unshift({ m: label, v: Math.round(v) });
  }
  return [...extra, ...historique];
}

// Détection du type de profil à partir des transactions
function detectProfileType(transactions) {
  const revenues = transactions.filter((t) => t.type === "revenu");
  if (revenues.some((t) => t.cat === "Freelance") || transactions.some((t) => t.cat === "Frais pro")) {
    return "independant";
  }
  if (revenues.some((t) => /int[ée]rim/i.test(t.label))) return "interimaire";
  return "salarie_stable";
}
const PROFILE_CONFIG = {
  salarie_stable: { label: "Salarié CDI", color: "#22c79a", revenueRatio: 1.0, capacityMult: 1.0,
    note: null },
  interimaire:    { label: "Intérimaire / Variable", color: "#f5a623", revenueRatio: 0.85, capacityMult: 0.7,
    note: "Revenu variable : les banques retiennent 85 % de vos revenus et réduisent la capacité de 30 %. Un apport conséquent améliorait votre dossier." },
  independant:    { label: "Indépendant / Freelance", color: "#f5a623", revenueRatio: 0.70, capacityMult: 0.5,
    note: "Statut indépendant : les banques retiennent 70 % des revenus déclarés et exigent 2–3 ans de bilans comptables." },
};

/* ------------------------------------------------------------------ */
/*  Constantes financières & simulation                               */
/* ------------------------------------------------------------------ */
const SIM_START_YEAR = 2026;

const logFmt = (v) => {
  const n = Math.round(Math.pow(10, v));
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + "M€";
  if (n >= 1_000)     return (n / 1_000).toFixed(0)     + "k€";
  return "€" + n;
};

/* Échelle Y intelligente — paliers adaptés à la plage de données ──── */
function generateSmartYTicks(max) {
  if (max <= 0) return [0];
  const target = 6;
  const raw    = max / target;
  const mag    = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm   = raw / mag;
  let step;
  if      (norm <= 1)   step = 1   * mag;
  else if (norm <= 2)   step = 2   * mag;
  else if (norm <= 2.5) step = 2.5 * mag;
  else if (norm <= 5)   step = 5   * mag;
  else                  step = 10  * mag;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v));
  return ticks;
}
const simsYFmt = (v) => {
  if (v >= 1_000_000) return (v / 1_000_000 % 1 === 0 ? (v / 1_000_000).toFixed(0) : (v / 1_000_000).toFixed(1)) + " M";
  if (v >= 1_000)     return Math.round(v / 1_000) + " k";
  return String(v);
};

/* Données d'exemple / seed : extraites dans ./seedData.js (cf. import en tête). */

/* Atomes UI (Card, Stat, Badge, KpiCard, Pill, Field, MiniStat, helpers)
   extraits dans ./ui.jsx — cf. import en tête. */

/* ------------------------------------------------------------------ */
/*  NAVIGATION                                                         */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  PLAN                                                                */
/* ------------------------------------------------------------------ */
const PLANS = {
  free:   { label: "Gratuit", color: "#94a3b8", icon: null },
  pro:    { label: "Pro",     color: "#f59e0b", icon: Crown },
  couple: { label: "Couple",  color: "#a855f7", icon: Users },
};

const PLAN_ACCESS = {
  free:   ["dashboard", "finances", "credits", "patrimoine", "profil", "pricing", "objectifs"],
  pro:    ["dashboard", "finances", "credits", "patrimoine", "profil", "pricing", "simulations", "fi", "immobilier", "or", "crypto", "fiscalite", "objectifs", "plans"],
  couple: ["dashboard", "finances", "credits", "patrimoine", "profil", "pricing", "simulations", "fi", "immobilier", "or", "crypto", "fiscalite", "couple", "objectifs", "plans"],
};

function canAccess(plan, feature) {
  return (PLAN_ACCESS[plan] || PLAN_ACCESS.free).includes(feature);
}

function PaywallBanner({ feature, plan, onUpgrade }) {
  const T = useT();
  const FEATURE_DETAILS = {
    simulations: {
      title: "Simulations avancées",
      hook: "Visualisez la trajectoire de votre patrimoine sur 30 ans, arbitrage par arbitrage.",
      bullets: ["Comparez ETF World, immobilier, Livret A, Bitcoin et Ethereum sur un même horizon", "Décomposez chaque projection entre apports versés et intérêts composés, année après année", "Cours BTC/ETH actualisés en direct, intégrés à vos simulations"],
    },
    fi: {
      title: "Indépendance Financière",
      hook: "Déterminez avec précision la date à laquelle votre patrimoine peut subvenir à vos besoins.",
      bullets: ["Rendement projeté calculé à partir de votre allocation réelle — immobilier, ETF, liquidités, crypto", "Jalons patrimoniaux datés, avec votre âge à chaque étape et seuil Coast FI", "« Et si tout était en ETF World ? » — mesurez le gain d'une allocation pleinement investie"],
    },
    immobilier: {
      title: "Simulateur Immobilier",
      hook: "Achat ou location : un arbitrage patrimonial qui se chiffre en dizaines de milliers d'euros.",
      bullets: ["Capacité d'emprunt calculée selon les normes bancaires en vigueur (HCSF, taux d'endettement 35 %)", "Comparatif achat vs location sur 20 ans, visualisé graphiquement", "Rentabilité nette après charges, fiscalité et remboursement de crédit"],
    },
    or: {
      title: "Simulateur Or & Métaux précieux",
      hook: "L'or, valeur refuge peu corrélée aux actions, protège votre patrimoine en période de crise.",
      bullets: ["Projection d'accumulation d'or physique : capital initial + versements mensuels", "Rendement net des frais de stockage (coffre, assurance), avec bande d'incertitude", "Trajectoire visualisée sur votre horizon, du scénario prudent au favorable"],
    },
    fiscalite: {
      title: "Fiscalité Patrimoniale",
      hook: "Une fiscalité mal arbitrée coûte souvent plusieurs points de rendement chaque année.",
      bullets: ["Calcul de vos plus-values en méthode FIFO, lot par lot, actif par actif", "Comparateur PEA vs compte-titres selon votre durée de détention", "Détection d'opportunités d'arbitrage fiscal et export de votre récapitulatif annuel"],
    },
    crypto: {
      title: "Analyse Crypto",
      hook: "Vos crypto-actifs méritent le même niveau de suivi que le reste de votre patrimoine.",
      bullets: ["Suivi en temps réel de votre portefeuille — valorisation, plus-values et performance par actif", "Cours et marchés en direct sur l'ensemble des crypto-actifs majeurs", "Comparatif des meilleures offres de staking et suivi de vos positions"],
    },
    assistant: {
      title: "Assistant financier",
      hook: "Un conseiller patrimonial disponible à tout moment, qui connaît vos chiffres mieux que quiconque.",
      bullets: ["Réponses personnalisées fondées sur votre budget et votre patrimoine réels", "Recommandations d'optimisation de votre allocation mensuelle", "Calculs instantanés : capacité d'emprunt, indépendance financière, fiscalité"],
    },
    couple: {
      title: "Mode Couple / Famille",
      hook: "Pilotez votre patrimoine à deux, avec une vision commune et des objectifs partagés.",
      bullets: ["Vue consolidée de vos patrimoines respectifs et combinés", "Objectifs communs et jalons partagés, avec simulation comparée", "Partage de compte sécurisé, chiffré de bout en bout"],
    },
    plans: {
      title: "Plan d'action",
      hook: "Trois feuilles de route concrètes, construites à partir de votre situation réelle.",
      bullets: ["Plans personnalisés — épargne, investissement, acquisition immobilière", "Étapes chiffrées avec impact estimé sur votre trajectoire patrimoniale", "Suivi de votre progression, étape par étape"],
    },
  };
  const details = FEATURE_DETAILS[feature] || { title: feature, hook: "Fonctionnalité Pro.", bullets: [] };
  const needed = ["simulations","fi","immobilier","or","crypto","fiscalite","plans"].includes(feature) ? "pro" : "couple";
  const P = PLANS[needed];
  const price = needed === "pro" ? "5,99 €" : "8,99 €";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 420, gap: 28, padding: "52px 32px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: `${P.color}18`, border: `1.5px solid ${P.color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Lock size={24} style={{ color: P.color }} />
      </div>
      <div>
        <div style={{ color: T.text, fontWeight: 800, fontSize: 22, marginBottom: 10 }}>{details.title}</div>
        <div style={{ color: P.color, fontWeight: 600, fontSize: 14, marginBottom: 16, fontStyle: "italic" }}>{details.hook}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          {details.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 18, height: 18, borderRadius: 10, background: `${P.color}22`, border: `1px solid ${P.color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <div style={{ width: 5, height: 5, borderRadius: 10, background: P.color }} />
              </div>
              <span style={{ color: "#b0b8c8", fontSize: 13, lineHeight: 1.55 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        <button
          onClick={onUpgrade}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 28px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15, background: `linear-gradient(135deg, ${P.color}, ${P.color}cc)`, color: "#fff" }}
        >
          <Crown size={18} /> Passer à {P.label} — {price}/mois
        </button>
        <div style={{ color: "#5a6478", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Gift size={12} /> Essai gratuit 7 jours · Sans engagement · Annulable à tout moment
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PRICING PAGE                                                        */
/* ------------------------------------------------------------------ */
function PricingPage({ plan, setPlan }) {
  const T = useT();
  const [billing, setBilling] = useState("monthly"); // "monthly" | "annual"
  const [loading, setLoading] = useState(null); // tier.id en cours de chargement

  async function handleCheckout(tier) {
    if (tier.id === "free") { setPlan("free"); return; }
    setLoading(tier.id);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      // L'Edge Function identifie l'utilisateur via ce JWT (header obligatoire,
      // sinon 401). L'identité ne transite jamais par le corps de la requête.
      const auth = await authHeader();
      if (!auth.Authorization) { alert("Connectez-vous pour vous abonner."); setLoading(null); return; }
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          ...auth,
        },
        body: JSON.stringify({ plan: tier.id, billing }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { alert(data.error || "Erreur Stripe"); setLoading(null); }
    } catch (e) {
      alert("Erreur réseau : " + e.message);
      setLoading(null);
    }
  }
  const tiers = [
    {
      id: "free",
      label: "Gratuit",
      priceMonthly: "0 €",
      priceAnnual: "0 €",
      period: "pour toujours",
      color: "#94a3b8",
      features: [
        "Tableau de bord",
        "Suivi des finances",
        "Patrimoine (consultation)",
        "Simulation ETF basique",
      ],
      locked: ["Indépendance Financière", "Fiscalité patrimoniale", "Crypto", "Immobilier", "Simulations avancées", "Assistant financier", "Mode Couple"],
      cta: "Plan actuel",
    },
    {
      id: "pro",
      label: "Pro",
      priceMonthly: "5,99 €",
      priceAnnual: "59,90 €",
      annualEquiv: "4,99 €/mois",
      color: "#f59e0b",
      badge: "⭐ Populaire",
      trial: "Essai gratuit 7 jours",
      features: [
        "Tout le plan Gratuit",
        "Indépendance Financière",
        "Simulations (tous scénarios)",
        "Fiscalité patrimoniale",
        "Crypto",
        "Simulateur Immobilier",
        "Assistant financier",
        "Historique illimité",
        "Support prioritaire",
      ],
      locked: ["Mode Couple / Famille"],
      cta: "Activer Pro",
    },
    {
      id: "couple",
      label: "Couple",
      priceMonthly: "8,99 €",
      priceAnnual: "89,90 €",
      annualEquiv: "7,49 €/mois",
      color: "#a855f7",
      badge: "👫 Pour deux",
      trial: "Essai gratuit 7 jours",
      features: [
        "Tout le plan Pro",
        "Patrimoine combiné & objectifs communs",
        "Simulation comparée — ensemble vs séparément",
        "Partage de compte sécurisé (chiffrement de bout en bout)",
        "Support prioritaire",
        "Accès bêta aux nouvelles fonctionnalités",
        "Export données Excel",
      ],
      locked: [],
      cta: "Activer Couple",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: T.text }}>Choisissez votre formule</h1>
        <p style={{ color: T.muted, marginTop: 6 }}>Sans engagement · Résiliable à tout moment · Données locales par défaut</p>
      </div>

      {/* Toggle mensuel / annuel */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full self-start" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}` }}>
        <button onClick={() => setBilling("monthly")} style={{
          padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
          background: billing === "monthly" ? T.gradientPrimary : "transparent",
          color: billing === "monthly" ? "#fff" : T.muted,
          transition: "all 0.2s",
        }}>
          Mensuel
        </button>
        <button onClick={() => setBilling("annual")} className="flex items-center gap-2" style={{
          padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
          background: billing === "annual" ? T.gradientPrimary : "transparent",
          color: billing === "annual" ? "#fff" : T.muted,
          transition: "all 0.2s",
        }}>
          Annuel
          <span style={{
            fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 10,
            background: billing === "annual" ? "rgba(255,255,255,0.22)" : `${T.green}22`,
            color: billing === "annual" ? "#fff" : T.green,
          }}>
            -17 %
          </span>
        </button>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {tiers.map((tier) => {
          const active = plan === tier.id;
          const isFree = tier.id === "free";
          const price  = billing === "annual" && !isFree ? tier.priceAnnual : tier.priceMonthly;
          const period = isFree ? tier.period : billing === "annual" ? "an" : "mois";
          return (
            <div key={tier.id} style={{
              background: T.panel,
              border: `2px solid ${active ? tier.color : tier.id === "pro" ? tier.color + "44" : T.border}`,
              borderRadius: 20, padding: "28px 24px",
              display: "flex", flexDirection: "column", gap: 20,
              position: "relative",
              transform: tier.id === "pro" ? "scale(1.02)" : "none",
              boxShadow: tier.id === "pro" ? `0 0 32px ${tier.color}18` : "none",
            }}>
              {tier.badge && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: tier.color, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  {tier.badge}
                </div>
              )}
              {active && (
                <div style={{ position: "absolute", top: 16, right: 16, background: tier.color + "22", border: `1px solid ${tier.color}`, borderRadius: 8, padding: "2px 8px", fontSize: 12, fontWeight: 700, color: tier.color }}>
                  ACTIF
                </div>
              )}

              {/* En-tête */}
              <div>
                <div style={{ color: tier.color, fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{tier.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ color: T.text, fontWeight: 900, fontSize: 32 }}>{price}</span>
                  <span style={{ color: T.muted, fontSize: 13 }}>/{period}</span>
                </div>
                {billing === "annual" && !isFree && (
                  <div style={{ color: T.green, fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                    ≈ {tier.annualEquiv} · 2 mois offerts
                  </div>
                )}
                {tier.trial && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "3px 10px", borderRadius: 20, background: `${tier.color}18`, color: tier.color, fontSize: 12, fontWeight: 700 }}>
                    <Gift size={11} /> {tier.trial}
                  </div>
                )}
              </div>

              {/* Features incluses */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {tier.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <Check size={14} style={{ color: tier.color, flexShrink: 0 }} />
                    <span style={{ color: T.text }}>{f}</span>
                  </div>
                ))}
                {tier.locked.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.4 }}>
                    <Lock size={13} style={{ color: T.muted, flexShrink: 0 }} />
                    <span style={{ color: T.muted, textDecoration: "line-through" }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleCheckout(tier)}
                disabled={active || loading === tier.id}
                style={{
                  padding: "13px 20px", borderRadius: 12, border: "none", cursor: (active || loading === tier.id) ? "default" : "pointer",
                  fontWeight: 700, fontSize: 14,
                  background: active ? tier.color + "22" : `linear-gradient(135deg, ${tier.color}, ${tier.color}bb)`,
                  color: active ? tier.color : "#fff",
                  transition: "all 0.2s",
                  opacity: loading && loading !== tier.id ? 0.5 : 1,
                }}
              >
                {active ? "✓ Plan actuel" : loading === tier.id ? "Chargement…" : tier.cta}
              </button>
            </div>
          );
        })}
      </div>

      {/* Garanties sécurité */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(91,141,239,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Fingerprint size={18} style={{ color: T.blue }} />
          </div>
          <div>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Connexion biométrique</div>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>Face ID / empreinte digitale, disponible sur tous les plans dès l'activation.</div>
          </div>
        </div>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Gift size={18} style={{ color: T.green }} />
          </div>
          <div>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Essai gratuit 7 jours</div>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>Sur Pro et Couple. Carte bancaire requise pour l'activation (pré-autorisation), débit automatique à l'issue des 7 jours sauf annulation.</div>
          </div>
        </div>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(168,85,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldCheck size={18} style={{ color: "#a855f7" }} />
          </div>
          <div>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Partage de compte vérifié</div>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>En mode Couple, l'accès partagé est chiffré de bout en bout et son architecture est vérifiée par un audit de sécurité indépendant.</div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20, padding: "28px 32px" }}>
        <h2 style={{ color: T.text, fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Questions fréquentes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { q: "Mes données sont-elles en sécurité ?", r: "Par défaut, toutes vos données restent locales sur votre appareil et ne sont transmises à aucun serveur tiers." },
            { q: "Puis-je annuler à tout moment ?", r: "Oui. Aucun engagement, annulation en un clic. Vous conservez vos données locales." },
            { q: "Le plan Gratuit est-il vraiment gratuit ?", r: "Oui, pour toujours. Les fonctionnalités de base restent accessibles sans limite de durée." },
            { q: "Comment fonctionne l'essai gratuit ?", r: "Activez Pro ou Couple gratuitement pendant 7 jours en renseignant votre carte bancaire (pré-autorisation, aucun débit immédiat). Passé ce délai, l'abonnement démarre automatiquement sauf annulation. Si vous ne l'activez pas, un rappel s'affiche une fois par mois pour vous le proposer." },
            { q: "Comment fonctionne le partage de compte en mode Couple ?", r: "La connexion entre les deux comptes est chiffrée de bout en bout et son architecture est vérifiée par un audit de sécurité indépendant — vos données restent privées." },
          ].map(({ q, r }) => (
            <div key={q} style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 14 }}>
              <div style={{ color: T.text, fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{q}</div>
              <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>{r}</div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: T.muted, fontSize: 12, textAlign: "center" }}>
        WealthTrack n'est pas un Conseiller en Investissement Financier. Les simulations sont fournies à titre indicatif.
      </p>
    </div>
  );
}

function Sidebar({ view, setView, profile, plan, setPlan }) {
  const T = useT();
  const items = [
    { id: "dashboard",   label: "Tableau de bord",   icon: LayoutDashboard },
    { id: "finances",    label: "Finances",           icon: ListTree },
    { id: "credits",     label: "Mes crédits",        icon: CreditCard },
    { id: "simulations", label: "Simulations",        icon: TrendingUp },
    { id: "patrimoine",  label: "Patrimoine",         icon: Wallet },
    { id: "fi",          label: "FIRE",               icon: Flag },
    { id: "crypto",      label: "Crypto",             icon: Bitcoin },
    { id: "immobilier",  label: "Immobilier",         icon: Building2 },
    { id: "or",          label: "Or",                 icon: Coins },
    { id: "objectifs",   label: "Objectifs",          icon: Target },
    { id: "fiscalite",   label: "Fiscalité",          icon: Calculator },
    ...(profile?.coupleMode && plan === "couple" ? [{ id: "couple", label: "Couple / Famille", icon: Users }] : []),
    { id: "plans",       label: "Plan d'action",      icon: Star },
    { id: "pricing",     label: "Tarifs",             icon: Crown },
    { id: "profil",      label: "Profil",             icon: User },
  ];
  const planInfo = PLANS[plan] || PLANS.free;
  return (
    <aside
      className="hidden md:flex flex-col gap-1 p-4 shrink-0 wt-glass"
      style={{ width: 270, borderRight: `1px solid ${T.border}`, borderRadius: 0 }}
    >
      <div className="flex items-center gap-3 px-3 py-5 mb-1">
        <div className="rounded-lg p-1.5" style={{ background: "rgba(91,141,239,0.12)", border: "1px solid rgba(91,141,239,0.2)" }}>
          <BarChart3 size={18} style={{ color: T.blue }} />
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight" style={{ color: T.text, fontFamily: "'Lora', Georgia, serif" }}>WealthTrack</span>
          <div className="text-xs" style={{ color: T.muted }}>Gestion patrimoniale</div>
        </div>
      </div>
      {items.map((it) => {
        const active = view === it.id;
        const locked = !canAccess(plan, it.id);
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => setView(it.id)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition"
            style={{
              background: active ? T.gradientPrimary : "transparent",
              boxShadow: active ? glow(T.violet, 24, "33") : "none",
              color: active ? "#fff" : locked ? T.muted + "88" : T.muted,
              fontWeight: active ? 600 : 500,
            }}
          >
            <Icon size={20} />
            <span style={{ flex: 1 }}>{it.label}</span>
            {locked && <Lock size={12} style={{ color: T.muted, opacity: 0.5 }} />}
          </button>
        );
      })}

      <div className="mt-auto border-t" style={{ borderColor: T.border }}>
        {/* Upgrade CTA */}
        {plan !== "couple" && (
          <button
            onClick={() => setView("pricing")}
            style={{ margin: "12px 12px 0", width: "calc(100% - 24px)", padding: "10px 14px", borderRadius: 12, border: `1px solid ${PLANS[plan === "free" ? "pro" : "couple"].color}44`, background: `${PLANS[plan === "free" ? "pro" : "couple"].color}10`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <Crown size={14} style={{ color: PLANS[plan === "free" ? "pro" : "couple"].color, flexShrink: 0 }} />
            <span style={{ color: PLANS[plan === "free" ? "pro" : "couple"].color, fontSize: 12, fontWeight: 700 }}>
              {plan === "free" ? "Passer à Pro →" : "Passer à Couple →"}
            </span>
          </button>
        )}
        <div className="px-3 py-4 flex items-center gap-3">
          <div className="rounded-full w-8 h-8 flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: "rgba(91,141,239,0.12)", color: T.blue, border: `1px solid ${T.blue}22` }}>
            {((profile.firstName?.[0] || "") + (profile.lastName?.[0] || "")).toUpperCase() || "—"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: T.text }}>
              {profile.firstName ? `${profile.firstName} ${profile.lastName}`.trim() : "Mon compte"}
            </div>
            <div className="text-xs truncate" style={{ color: planInfo.color, fontWeight: 600 }}>
              {planInfo.label}
            </div>
          </div>
        </div>
        <div className="px-3 pb-4">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
            <Shield size={11} />
            <span>Données locales par défaut</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  ÉCRAN : TABLEAU DE BORD                                            */
/* ------------------------------------------------------------------ */
function Dashboard({ totals, breakdown, patrimoine, simParams, setView, histo, transactions, plan, profile, snapshots = [], incomeRef = totals.revenus, incomeIsSmoothed = false }) {
  const T = useT();
  const { revenus, chargesFixes, depensesVar, invest, restant, tauxEpargne } = totals;
  const savingsRateColor = tauxEpargne >= SAVINGS_RATE_TARGET ? T.green : tauxEpargne >= SAVINGS_RATE_CRITICAL ? T.amber : T.red;
  const savingsRateLabel = tauxEpargne >= SAVINGS_RATE_TARGET ? "Excellent" : tauxEpargne >= SAVINGS_RATE_CRITICAL ? "Correct" : "À renforcer";
  const [active, setActive] = useState({});
  const [shareOpen, setShareOpen] = useState(false);
  const [histoRange, setHistoRange] = useState(12);

  // Taux d'épargne mensuel reconstitué à partir de l'historique réel (rev/dep)
  const savingHisto = useMemo(
    () => histo.map((h) => ({ m: h.m, v: h.rev > 0 ? Math.round(((h.rev - h.dep) / h.rev) * 1000) / 10 : 0 })),
    [histo]
  );

  // Série d'épargne positive : nombre de mois consécutifs (les plus récents) où rev > dep
  const savingsStreak = useMemo(() => {
    let streak = 0;
    for (let i = histo.length - 1; i >= 0; i--) {
      if (histo[i].rev > histo[i].dep) streak++;
      else break;
    }
    return streak;
  }, [histo]);

  const [bestStreak, setBestStreak] = useLocalStorage("wt_best_streak", 0);
  const isNewStreakRecord = savingsStreak > 0 && savingsStreak > bestStreak;
  useEffect(() => {
    if (savingsStreak > bestStreak) setBestStreak(savingsStreak);
  }, [savingsStreak, bestStreak, setBestStreak]);

  // Célébration GSAP quand la série d'épargne progresse
  const streakRef = useRef(null);
  const streakRingRef = useRef(null);
  const streakConfettiRef = useRef(null);
  const prevStreak = usePrevious(savingsStreak);
  const prevIsNewRecord = usePrevious(isNewStreakRecord);
  const [streakToast, triggerStreakToast] = useCelebrationToast();
  useGSAP(() => {
    if (prevStreak != null && savingsStreak > prevStreak && streakRef.current) {
      const newRecord = isNewStreakRecord && !prevIsNewRecord;
      celebrate({
        cardEl: streakRef.current, ringEl: streakRingRef.current,
        confettiEl: streakConfettiRef.current,
        color: newRecord ? T.amber : T.green,
        confettiColors: newRecord ? [T.amber, T.green, "#ffd166"] : CONFETTI_COLORS,
      });
      if (newRecord) {
        triggerStreakToast({
          icon: <Trophy size={18} style={{ color: T.amber }} />,
          title: `Nouveau record : ${savingsStreak} mois d'épargne consécutifs !`,
          subtitle: "Votre meilleure série jusqu'ici.",
          color: T.amber,
        });
      }
    }
  }, { dependencies: [savingsStreak] });

  const profileType = useMemo(() => detectProfileType(transactions || []), [transactions]);
  const isSalarie = profileType === "salarie_stable" || profileType === "interimaire";
  const visibleWhatIf = useMemo(
    () => WHATIF.filter((w) => w.id !== "salaire" || isSalarie),
    [isSalarie]
  );

  const healthScore = useMemo(() => calculateHealthScore(totals, patrimoine, simParams), [totals, patrimoine, simParams]);
  const badge = getScoreBadge(healthScore.overall);
  const scenarios = useMemo(() => calculateWhatIfScenarios(totals, simParams), [totals, simParams]);

  const gainTotal = visibleWhatIf.reduce((s, w) => (active[w.id] ? s + w.gain : s), 0);
  const ltGainTotal = visibleWhatIf.reduce((s, w) => (active[w.id] ? s + longTermGain(w.gain) : s), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: T.text, fontFamily: "'Lora', Georgia, serif" }}>Tableau de bord</h1>
        <p style={{ color: T.muted }}>Vue d'ensemble de vos finances — Juin 2026</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Stat label="Revenus" value={eur(revenus)} color={T.green} icon={ArrowUpRight} />
        <Stat label="Charges fixes" value={eur(chargesFixes)} color={T.red} icon={ArrowDownRight} />
        <Stat label="Dépenses variables" value={eur(depensesVar)} color={T.amber} icon={ArrowDownRight} />
        <Stat label="Investissements" value={eur(invest)} color={T.cyan} icon={PiggyBank} />
      </div>

      {/* Évolution réelle du patrimoine net (snapshots mensuels auto) */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: T.green }} />
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Évolution de votre patrimoine net</h2>
          </div>
          {snapshots.length > 0 && (
            <span className="text-sm" style={{ color: T.muted }}>{eur(snapshots[snapshots.length - 1].v)} aujourd'hui</span>
          )}
        </div>
        {snapshots.length >= 2 ? (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={snapshots} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.green} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: T.muted }} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)} k€`} tick={{ fontSize: 12, fill: T.muted }} width={48} />
                <Tooltip {...makeChartTip(T)} formatter={v => [eur(v), "Patrimoine net"]} />
                <Area type="monotone" dataKey="v" stroke={T.green} strokeWidth={2.5} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
            <Calendar size={18} style={{ color: T.blue, flexShrink: 0 }} />
            <span>Votre patrimoine net est enregistré chaque mois automatiquement. Revenez le mois prochain pour voir votre courbe réelle se construire — pas une projection, vos vraies valeurs.</span>
          </div>
        )}
      </Card>

      {/* Score de santé gamifié */}
      <Card style={{ border: `2px solid ${badge.color}55` }}>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Gauche : chiffre + breakdown */}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: badge.ring, border: `2px solid ${badge.color}` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: badge.color }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: T.text, fontFamily: "'Lora', Georgia, serif" }}>Santé financière</h2>
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: badge.color + "18", color: badge.color }}>
                    {badge.level}
                  </span>
                </div>
              </div>
              {streakToast}
              {savingsStreak > 0 && (
                <div ref={streakRef} style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999,
                  background: "rgba(240,168,72,0.12)", border: `1px solid ${T.amber}44`,
                }}>
                  <div ref={streakConfettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} />
                  <div ref={streakRingRef} style={{
                    position: "absolute", inset: -3, borderRadius: 999,
                    border: `2px solid ${T.amber}`, opacity: 0, pointerEvents: "none",
                  }} />
                  <Flame size={14} style={{ color: T.amber }} />
                  <span style={{ color: T.amber, fontWeight: 800, fontSize: 13 }}>
                    <AnimatedNumber value={savingsStreak} />
                  </span>
                  <span style={{ color: T.muted, fontSize: 12 }}>
                    mois d'épargne {isNewStreakRecord && <b style={{ color: T.amber }}>· record !</b>}
                  </span>
                </div>
              )}
            </div>
            <div className="mb-4">
              <span className="font-black" style={{ fontSize: 52, color: badge.color }}>{healthScore.overall}</span>
              <span className="text-2xl font-normal" style={{ color: T.muted }}>/100</span>
            </div>
            <div className="text-xs font-semibold mb-2" style={{ color: T.muted, letterSpacing: 1 }}>
              DÉTAIL PAR CRITÈRE
            </div>
            {Object.values(healthScore.breakdown).map((b) => (
              <div key={b.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: T.text }}>{b.label}</span>
                  <span style={{ color: badge.color }}>{b.score}/{b.max} pts</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-1.5 rounded-full"
                    style={{ width: `${(b.score / b.max) * 100}%`, background: badge.color }} />
                </div>
              </div>
            ))}
          </div>
          {/* Droite : actions */}
          <div className="flex flex-col gap-3" style={{ minWidth: 170 }}>
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-xl py-3 px-4 font-semibold text-sm"
              style={{ background: badge.color, color: "#fff" }}>
              Partager mon score
            </button>
            <div className="rounded-xl p-3 text-xs flex-1" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div className="font-semibold mb-2" style={{ color: T.text }}>Pour progresser :</div>
              <ul style={{ color: T.muted, paddingLeft: 14, lineHeight: 1.8, margin: 0 }}>
                {tauxEpargne < SAVINGS_RATE_TARGET && <li>Épargner {(SAVINGS_RATE_TARGET - tauxEpargne).toFixed(0)} % de plus</li>}
                {healthScore.breakdown.diversification.score < 25 && <li>Diversifier vos placements</li>}
                {healthScore.breakdown.investment.score < 15 && <li>Investir ≥ 10 % de vos revenus</li>}
                {healthScore.breakdown.health.score < 7 && <li>Réduire votre ratio dettes/actifs</li>}
              </ul>
            </div>
          </div>
        </div>
        {shareOpen && <ShareScoreModal score={healthScore.overall} badge={badge} onClose={() => setShareOpen(false)} />}
      </Card>

      {/* Restant à vivre + taux épargne */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card style={{ background: "rgba(34,199,154,0.06)", borderColor: "rgba(34,199,154,0.25)" }}>
          <div className="flex justify-between items-start">
            <span style={{ color: T.muted }}>Restant à vivre</span>
            <Wallet size={28} style={{ color: T.green, opacity: 0.5 }} />
          </div>
          <div className="text-4xl font-bold mt-3" style={{ color: T.green }}>{eur(restant)}</div>
        </Card>
        <Card style={{ background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.25)" }}>
          <div className="flex justify-between items-start">
            <span style={{ color: T.muted }}>Taux d'épargne</span>
            <ArrowUpRight size={28} style={{ color: T.blue, opacity: 0.6 }} />
          </div>
          <div className="text-4xl font-bold mt-3" style={{ color: savingsRateColor }}>{pct(tauxEpargne)}</div>
          <div className="text-sm mt-1" style={{ color: savingsRateColor }}>{savingsRateLabel}</div>
        </Card>
      </div>

      {/* Et si ? */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} style={{ color: T.amber }} />
          <h2 className="text-xl font-bold" style={{ color: T.text, fontFamily: "'Lora', Georgia, serif" }}>Scénarios d'optimisation</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: T.muted }}>
          Activez un scénario pour mesurer son impact sur votre capacité d'épargne mensuelle.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleWhatIf.map((w) => {
            const on = !!active[w.id];
            return (
              <button key={w.id}
                onClick={() => setActive((a) => ({ ...a, [w.id]: !a[w.id] }))}
                className="text-left rounded-xl p-4 flex items-start gap-3 transition"
                style={{
                  background: on ? "rgba(39,163,122,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${on ? T.green : T.border}`,
                }}>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: T.text }}>{w.label}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: T.green }}>+{w.gain} €/mois</span>
                    <span style={{ color: T.muted, fontSize: 12 }}>·</span>
                    <span className="text-xs flex items-center gap-1" style={{ color: T.muted }}>
                      <TrendingUp size={10} /> 20 ans : +{eur(longTermGain(w.gain))}
                    </span>
                  </div>
                </div>
                <div className="w-4 h-4 rounded-full mt-0.5 shrink-0"
                  style={{ border: `1.5px solid ${on ? T.green : T.muted}`, background: on ? T.green : "transparent" }} />
              </button>
            );
          })}
        </div>
        {gainTotal > 0 && (
          <div className="mt-4 rounded-xl p-4"
            style={{ background: "rgba(34,199,154,0.08)", border: `1px solid ${T.green}` }}>
            <div className="flex flex-wrap gap-6 justify-between items-center">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: T.muted, letterSpacing: 0.5 }}>IMPACT MENSUEL COMBINÉ</div>
                <div className="text-2xl font-bold" style={{ color: T.green }}>+{gainTotal} €/mois</div>
                <div className="text-sm mt-1" style={{ color: T.muted }}>soit +{eur(gainTotal * 12)} par an</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold mb-1" style={{ color: T.muted, letterSpacing: 0.5 }}>SI INVESTI 20 ANS · MSCI WORLD 10,5%</div>
                <div className="text-2xl font-bold" style={{ color: T.cyan }}>+{eur(ltGainTotal)}</div>
                <div className="text-sm mt-1" style={{ color: T.muted }}>de gain généré par intérêts composés</div>
              </div>
            </div>
            <div className="text-xs mt-3 pt-3 flex items-start gap-1.5" style={{ color: T.muted, borderTop: `1px solid ${T.border}` }}>
              <AlertTriangle size={12} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} aria-hidden="true" /> <span>{RATE_DISCLAIMER}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Historique mensuel */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Historique mensuel</h2>
          <select value={histoRange} onChange={(e) => setHistoRange(+e.target.value)}
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.text, borderRadius: 9999, padding: "6px 14px", fontSize: 12, outline: "none", cursor: "pointer" }}>
            <option value={6}>6 derniers mois</option>
            <option value={12}>12 derniers mois</option>
            <option value={24}>2 ans</option>
            <option value={36}>3 ans</option>
          </select>
        </div>
        <FinTechBarChart
          data={histo.slice(-histoRange)}
          bars={[
            { dataKey: "rev", fill: T.green, name: "Revenus" },
            { dataKey: "dep", fill: T.red, name: "Dépenses" },
            { dataKey: "inv", fill: T.cyan, name: "Investissements" },
          ]}
          format={(v) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : eur(v))}
          ariaLabel="Monthly revenue, expenses, and investments"
        />
      </Card>

      {/* Répartition + catégories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-bold mb-2" style={{ color: T.text }}>Répartition dépenses</h2>
          <div className="relative">
            <FinTechPieChart
              data={breakdown.map((b) => ({ name: b.cat, value: b.amount }))}
              colors={breakdown.map((b) => CAT_COLORS[b.cat] || T.muted)}
              innerRadius={60}
              ariaLabel="Expense breakdown by category"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm" style={{ color: T.muted }}>Total</span>
              <span className="text-2xl font-bold" style={{ color: T.text }}>
                {eur(breakdown.reduce((s, b) => s + b.amount, 0))}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>Détail par catégorie</h2>
          {breakdown.map((b) => {
            const total = breakdown.reduce((s, x) => s + x.amount, 0);
            const p = (b.amount / total) * 100;
            return (
              <div key={b.cat} className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2" style={{ color: T.text }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[b.cat] }} />
                    {b.cat}
                  </span>
                  <span><b style={{ color: T.text }}>{eur(b.amount)}</b>
                    <span style={{ color: T.muted }}> &nbsp;{Math.round(p)}%</span></span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${p}%`, background: CAT_COLORS[b.cat] }} />
                </div>
              </div>
            );
          })}
          <button
            onClick={() => window.dispatchEvent(new Event("wt:open-chat"))}
            className="w-full mt-4 rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(90deg,#7c3aed,#8b5cf6)", color: "#fff" }}>
            <Sparkles size={18} /> Optimiser mon mois par IA
          </button>
        </Card>
      </div>

      {/* Évolution taux épargne */}
      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Évolution du taux d'épargne</h2>
          <p className="text-sm" style={{ color: T.muted }}>Calculé à partir de votre historique mensuel — période sélectionnée ci-dessus</p>
        </div>
        <FinTechAreaChart
          data={savingHisto.slice(-histoRange)}
          areas={[{ dataKey: "v", fill: T.cyan, stroke: T.cyan }]}
          format={(v) => v.toFixed(1) + "%"}
          stacked={false}
          ariaLabel="Savings rate evolution over time"
        />
      </Card>

      {/* Teaser Premium — visible en Free uniquement */}
      {plan === "free" && (
        <PremiumTeaser
          totals={totals}
          patrimoine={patrimoine}
          simParams={simParams}
          profile={profile}
          healthScore={healthScore}
          setView={setView}
          incomeRef={incomeRef}
          incomeIsSmoothed={incomeIsSmoothed}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PREMIUM TEASER — affiché en Free dans le Dashboard                */
/* ------------------------------------------------------------------ */
function PremiumTeaser({ totals, patrimoine, simParams, profile, healthScore, setView, incomeRef = totals.revenus, incomeIsSmoothed = false }) {
  const T = useT();
  const netWorth = useMemo(() => {
    const a = (patrimoine?.actifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
    const p = (patrimoine?.passifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
    return a - p;
  }, [patrimoine]);

  const monthly = simParams?.monthly || totals.invest || 0;
  const expenses = Math.max((totals.revenus || 0) - (totals.invest || 0), 500);
  const ifTarget = expenses * 12 * 25;
  const r7 = 0.07 / 12;

  // Années pour atteindre l'IF à 7%/an
  let ifYears = null;
  for (let y = 0; y <= 80; y++) {
    const n = y * 12;
    const fvP = netWorth * Math.pow(1 + r7, n) + (r7 > 0 ? monthly * (Math.pow(1 + r7, n) - 1) / r7 : monthly * n);
    if (fvP >= ifTarget) { ifYears = y; break; }
  }
  const ifAge = ifYears != null && profile?.age ? profile.age + ifYears : null;
  const ifAgeStr = ifAge != null ? `${ifAge} ans` : "> 80 ans";

  // Patrimoine projeté à 10 ans (base 7%)
  const n10 = 120;
  const fv10 = Math.round(netWorth * Math.pow(1 + r7, n10) + (r7 > 0 ? monthly * (Math.pow(1 + r7, n10) - 1) / r7 : monthly * n10));
  const fv10ETF = Math.round(fv(netWorth, monthly, RATE_A, 10));

  // Points d'attention personnalisés
  const alerts = [];
  if (totals.tauxEpargne < SAVINGS_RATE_CRITICAL) alerts.push({ level: "red", msg: `Taux d'épargne critique (${totals.tauxEpargne.toFixed(1)}%) — sous le seuil recommandé de ${SAVINGS_RATE_CRITICAL} %`, feature: "simulations" });
  else if (totals.tauxEpargne < SAVINGS_RATE_TARGET) alerts.push({ level: "amber", msg: `Taux d'épargne de ${totals.tauxEpargne.toFixed(1)}% — chaque +1% représente des dizaines de k€ sur 20 ans`, feature: "simulations" });
  if (healthScore.breakdown.diversification.score < 20) alerts.push({ level: "red", msg: "Actifs trop concentrés — un crash sectoriel peut effacer une part importante de votre patrimoine", feature: "fi" });
  if (healthScore.breakdown.investment.score < 15) alerts.push({ level: "amber", msg: "Investissement insuffisant — vos liquidités perdent de la valeur face à l'inflation (2–3%/an)", feature: "fiscalite" });
  if (incomeRef > 0 && totals.chargesFixes > incomeRef * 0.55) alerts.push({ level: "red", msg: `Charges fixes élevées (${Math.round((totals.chargesFixes / incomeRef) * 100)}% des revenus${incomeIsSmoothed ? ", moyenne 12 mois" : ""}) — marge de manœuvre réduite`, feature: "simulations" });
  if (netWorth < 0) alerts.push({ level: "red", msg: "Patrimoine net négatif — priorité au désendettement avant tout investissement", feature: "fi" });
  if (alerts.length < 2) alerts.push({ level: "info", msg: `En basculant vers ETF World (10%/an), votre patrimoine atteindrait ${fv10ETF >= 1e6 ? (fv10ETF / 1e6).toFixed(1) + " M€" : Math.round(fv10ETF / 1e3) + " k€"} dans 10 ans`, feature: "simulations" });

  const topAlerts = alerts.slice(0, 3);

  return (
    <div style={{ borderRadius: 20, border: "1px solid rgba(245,158,11,0.2)", background: "linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(168,85,247,0.04) 100%)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Crown size={18} style={{ color: "#f59e0b" }} />
        <span style={{ color: T.text, fontWeight: 700, fontSize: 15 }}>Aperçu Pro — basé sur vos données</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted }}>Dès 5,99 €/mois · Essai gratuit 7 jours</span>
      </div>

      <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Metric 1 — IF teaser */}
        <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Votre Indépendance Financière projetée</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f59e0b", filter: "blur(6px)", userSelect: "none" }}>{ifAgeStr}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4, filter: "blur(5px)", userSelect: "none" }}>
            dans {ifYears != null ? `${ifYears} ans` : "plus de 80 ans"} — scénario base 7%/an
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,18,27,0.5)", borderRadius: 12 }}>
            <button onClick={() => setView("pricing")} style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "7px 14px", color: "#f59e0b", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={12} /> Voir ma projection
            </button>
          </div>
        </div>

        {/* Metric 2 — Patrimoine projeté 10 ans */}
        <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Votre patrimoine dans 10 ans (3 scénarios)</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#22c55e", filter: "blur(6px)", userSelect: "none" }}>
            {fv10 >= 1e6 ? (fv10 / 1e6).toFixed(1) + " M€" : Math.round(fv10 / 1e3) + " k€"}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4, filter: "blur(5px)", userSelect: "none" }}>
            scénario base — pessimiste et optimiste inclus
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,18,27,0.5)", borderRadius: 12 }}>
            <button onClick={() => setView("pricing")} style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "7px 14px", color: "#22c55e", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={12} /> Voir les simulations
            </button>
          </div>
        </div>
      </div>

      {/* Points d'attention personnalisés */}
      <div style={{ padding: "0 22px 18px" }}>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {topAlerts.filter(a => a.level !== "info").length} point{topAlerts.filter(a => a.level !== "info").length > 1 ? "s" : ""} d'attention détecté{topAlerts.filter(a => a.level !== "info").length > 1 ? "s" : ""} sur votre profil
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {topAlerts.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><AlertLevelIcon level={a.level} size={14} /></span>
              <span style={{ fontSize: 13, color: "#8a97b0", lineHeight: 1.5, flex: 1 }}>{a.msg}</span>
              <button onClick={() => setView("pricing")} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", padding: "2px 0", flexShrink: 0 }}>
                Corriger →
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setView("pricing")}
          style={{ width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Crown size={16} /> Passer à Pro — 5,99 €/mois · Essai gratuit 7 jours
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SHARE MODAL                                                        */
/* ------------------------------------------------------------------ */
function ShareScoreModal({ score, badge, onClose }) {
  const T = useT();
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const shareText = `Mon score de santé financière : ${score}/100 (${badge.level}) — Et toi, c'est combien ? #WealthTrack`;
  const shareUrl = "https://wealthtrack.app";

  const copy = () => {
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    alert("Copié ! Prêt à partager.");
  };

  return (
    <div
      onClick={onClose}
      className="wt-fade-in"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-2xl p-6 wt-scale-in wt-glass"
        style={{ maxWidth: 400, width: "90%" }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>Partager votre score</h2>
        <div className="rounded-xl p-4 mb-4 text-center" style={{ background: T.bg }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: badge.ring, border: `2px solid ${badge.color}` }}>
              <div className="w-4 h-4 rounded-full" style={{ background: badge.color }} />
            </div>
          </div>
          <div className="text-4xl font-black mb-1" style={{ color: badge.color }}>{score}/100</div>
          <div className="text-sm" style={{ color: T.muted }}>Niveau {badge.level}</div>
        </div>
        <p className="text-sm mb-4" style={{ color: T.muted }}>"{shareText}"</p>
        <div className="flex flex-col gap-3">
          <button onClick={copy} className="rounded-xl py-3 font-bold"
            style={{ background: badge.color, color: "#0a0f1e" }}>
            Copier le texte
          </button>
          <button
            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`)}
            className="rounded-xl py-3 font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", color: T.text, border: `1px solid ${T.border}` }}>
            Partager sur Twitter
          </button>
          <button
            onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)}
            className="rounded-xl py-3 font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", color: T.text, border: `1px solid ${T.border}` }}>
            Partager sur LinkedIn
          </button>
          <button onClick={onClose} className="rounded-xl py-2 text-sm"
            style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}` }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function TrialPopup({ onDiscover, onClose }) {
  const T = useT();
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="wt-fade-in"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-2xl p-6 text-center wt-scale-in wt-glass"
        style={{ maxWidth: 400, width: "90%" }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(245,158,11,0.12)" }}>
          <Gift size={26} style={{ color: "#f59e0b" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: T.text }}>Essayez Pro gratuitement</h2>
        <p className="text-sm mb-4" style={{ color: T.muted }}>
          7 jours d'accès complet aux simulations avancées, à la fiscalité, au suivi crypto et à l'assistant financier. Carte bancaire requise (pré-autorisation), débit automatique à l'issue de l'essai sauf annulation.
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={onDiscover} className="rounded-xl py-3 font-bold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff" }}>
            <Crown size={16} /> Découvrir Pro
          </button>
          <button onClick={onClose} className="rounded-xl py-2 text-sm"
            style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}` }}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  ÉCRAN : FINANCES                                                   */
/* ------------------------------------------------------------------ */
function Finances({ totals, tx, setView, onAdd, onDelete, onUpdate, budgets, setBudgets, plan }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const TYPE_META = {
    revenu: { label: "Revenu", color: T.green },
    charge_fixe: { label: "Charge fixe", color: T.red },
    depense_variable: { label: "Dépense variable", color: T.amber },
    investissement: { label: "Investissement", color: T.cyan },
  };
  const [mainTab, setMainTab]  = useState("transactions");
  const [filter, setFilter]    = useState("tout");
  const [showAdd, setShowAdd]  = useState(false);
  const [editId, setEditId]    = useState(null);
  const [editBuf, setEditBuf]  = useState({});
  const [newTx, setNewTx]      = useState({ label: "", cat: "Alimentation", type: "depense_variable", amount: "", recurring: false });

  const list = filter === "tout" ? tx : filter === "recurring" ? tx.filter(t => t.recurring) : tx.filter((t) => t.type === filter);

  const handleAdd = () => {
    const amount = parseFloat(newTx.amount);
    if (!newTx.label.trim() || !amount) return;
    const signed = newTx.type === "revenu" ? Math.abs(amount) : -Math.abs(amount);
    onAdd?.({ ...newTx, amount: signed, id: Date.now() });
    setNewTx({ label: "", cat: "Alimentation", type: "depense_variable", amount: "", recurring: false });
    setShowAdd(false);
  };

  const startEdit = (t) => { setEditId(t.id); setEditBuf({ ...t, amount: Math.abs(t.amount) }); };
  const saveEdit = () => {
    const amount = parseFloat(editBuf.amount);
    if (!editBuf.label?.trim() || !amount) { setEditId(null); return; }
    const signed = editBuf.type === "revenu" ? Math.abs(amount) : -Math.abs(amount);
    onUpdate?.(editId, { ...editBuf, amount: signed });
    setEditId(null);
  };

  // Pour Budgets tab : calcul du dépensé par catégorie
  const spentByCat = useMemo(() => {
    const map = {};
    tx.filter(t => t.amount < 0).forEach(t => { map[t.cat] = (map[t.cat] || 0) + Math.abs(t.amount); });
    return map;
  }, [tx]);
  const allCats = Object.keys({ ...CAT_COLORS, ...Object.fromEntries(tx.map(t => [t.cat, true])) });

  // Détection indicative de crédits à la consommation / LOA à taux élevé dans les libellés
  const highInterestDebts = useMemo(() => {
    const re = /cofidis|cetelem|sofinco|oney|floa|younited|cofinoga|franfinance|sygma|cashper|crédit conso|credit conso|crédit renouvelable|credit renouvelable|revolving|\bloa\b/i;
    return tx.filter(t => t.amount < 0 && re.test(t.label));
  }, [tx]);

  const inpSt = { ...inputStyle, padding: "6px 10px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>Finances</h1>
          <p style={{ color: T.muted }}>Transactions, budgets et récurrences</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setView("importer")} className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ border: `1px solid ${T.border}`, color: T.text }}>
            <Upload size={18} /> Importer
          </button>
          <button className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold"
            style={{ border: "1px solid rgba(139,92,246,0.5)", color: "#a78bfa", background: "rgba(139,92,246,0.08)" }}>
            <Landmark size={18} /> Connexion Bancaire
            {plan === "free" && <span className="text-xs font-bold px-1.5 py-0.5 rounded-md ml-1"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", fontSize: 12, letterSpacing: 0.5 }}>PREMIUM</span>}
          </button>
          <button onClick={() => setShowAdd((s) => !s)} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold"
            style={{ background: T.blue, color: "#fff" }}>
            <Plus size={18} /> Ajouter
          </button>
        </div>
      </div>

      {showAdd && (
        <Card style={{ borderColor: `${T.blue}44` }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: T.muted }}>NOUVELLE TRANSACTION</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Libellé">
              <input value={newTx.label} placeholder="Ex : Courses Lidl" style={inputStyle}
                onChange={(e) => setNewTx((t) => ({ ...t, label: e.target.value }))} />
            </Field>
            <Field label="Catégorie">
              <select value={newTx.cat} style={inputStyle} onChange={(e) => setNewTx((t) => ({ ...t, cat: e.target.value }))}>
                {Object.keys(CAT_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={newTx.type} style={inputStyle} onChange={(e) => setNewTx((t) => ({ ...t, type: e.target.value }))}>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Montant (€)">
              <input type="number" value={newTx.amount} placeholder="0" style={inputStyle}
                onChange={(e) => setNewTx((t) => ({ ...t, amount: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: T.muted, fontSize: 13 }}>
              <input type="checkbox" checked={!!newTx.recurring} onChange={e => setNewTx(t => ({ ...t, recurring: e.target.checked }))}
                style={{ accentColor: T.blue, width: 15, height: 15 }} />
              <Repeat size={13} /> Récurrente (mensuelle)
            </label>
            <button onClick={handleAdd} className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: T.blue, color: "#fff" }}>
              <Check size={14} className="inline mr-1.5" />Confirmer
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: `1px solid ${T.border}`, color: T.muted }}>Annuler</button>
          </div>
        </Card>
      )}

      <div className="flex gap-4 flex-wrap">
        <Stat label="Revenu" value={eur(totals.revenus)} color={T.green} icon={TrendingUp} />
        <Stat label="Charge fixe" value={eur(totals.chargesFixes)} color={T.text} icon={Home} />
        <Stat label="Dépense variable" value={eur(totals.depensesVar)} color={T.text} icon={ArrowDownRight} />
        <Stat label="Investissement" value={eur(totals.invest)} color={T.text} icon={PiggyBank} />
      </div>

      {highInterestDebts.length > 0 && (
        <Card style={{ borderColor: `${T.amber}44`, background: "rgba(240,168,72,0.06)" }}>
          <div className="flex items-start gap-3">
            <Lightbulb size={18} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                {highInterestDebts.length === 1 ? "Crédit à taux potentiellement élevé détecté" : `${highInterestDebts.length} crédits à taux potentiellement élevé détectés`}
              </div>
              <div style={{ color: T.muted, fontSize: 12.5, lineHeight: 1.6 }}>
                {highInterestDebts.map(t => t.label).join(", ")} — ce type de financement (LOA, crédit conso, crédit renouvelable...) dépasse souvent 15 à 20 % de TAEG.
                Vérifiez le taux de votre contrat et envisagez un remboursement anticipé avant d'investir davantage.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Onglets principaux */}
      <div className="flex gap-2">
        <Pill active={mainTab === "transactions"} onClick={() => setMainTab("transactions")}>Transactions</Pill>
        <Pill active={mainTab === "budgets"} onClick={() => setMainTab("budgets")}>Budgets par catégorie</Pill>
      </div>

      {mainTab === "transactions" && (
        <>
          <div className="flex gap-3 flex-wrap">
            <Pill active={filter === "tout"} onClick={() => setFilter("tout")}>Tout</Pill>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>{v.label}</Pill>
            ))}
            <Pill active={filter === "recurring"} onClick={() => setFilter("recurring")}>
              <Repeat size={13} className="inline mr-1" />Récurrentes
            </Pill>
          </div>

          <Card>
            <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>
              Transactions ({list.length})
            </h2>
            {list.length === 0 && <p style={{ color: T.muted, fontSize: 13 }}>Aucune transaction dans ce filtre.</p>}
            {list.map((t) => {
              const meta = TYPE_META[t.type] || { label: t.type, color: T.muted };
              const isEditing = editId === t.id;
              return (
                <div key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  {isEditing ? (
                    <div className="py-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                      <input value={editBuf.label} style={inpSt} onChange={e => setEditBuf(b => ({ ...b, label: e.target.value }))} />
                      <select value={editBuf.cat} style={inpSt} onChange={e => setEditBuf(b => ({ ...b, cat: e.target.value }))}>
                        {Object.keys(CAT_COLORS).map(c => <option key={c}>{c}</option>)}
                      </select>
                      <select value={editBuf.type} style={inpSt} onChange={e => setEditBuf(b => ({ ...b, type: e.target.value }))}>
                        {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <div className="flex gap-2 items-center">
                        <input type="number" value={editBuf.amount} style={{ ...inpSt, width: 90 }} onChange={e => setEditBuf(b => ({ ...b, amount: e.target.value }))} />
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: T.muted, fontSize: 12 }}>
                          <input type="checkbox" checked={!!editBuf.recurring} onChange={e => setEditBuf(b => ({ ...b, recurring: e.target.checked }))} style={{ accentColor: T.blue }} />
                          <Repeat size={11} />
                        </label>
                        <button onClick={saveEdit} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>OK</button>
                        <button onClick={() => setEditId(null)} aria-label="Annuler l'édition" style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: T.muted, fontSize: 12, display: "inline-flex", alignItems: "center" }}><X size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-3">
                      <div className="rounded-xl w-10 h-10 flex items-center justify-center shrink-0"
                        style={{ background: "rgba(139,92,246,0.08)" }}>
                        {t.type === "revenu" ? <TrendingUp size={18} style={{ color: T.green }} />
                          : t.type === "investissement" ? <PiggyBank size={18} style={{ color: T.cyan }} />
                          : <Home size={18} style={{ color: T.muted }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-sm" style={{ color: T.text }}>
                          {t.label}
                          {t.recurring && <span style={{ marginLeft: 6, fontSize: 12, color: T.blue, background: "rgba(91,141,239,0.12)", borderRadius: 6, padding: "1px 6px" }}><Repeat size={9} className="inline" /> récurrente</span>}
                        </div>
                        <div className="text-xs" style={{ color: T.muted }}>{t.cat}</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium shrink-0"
                        style={{ background: meta.color + "22", color: meta.color }}>{meta.label}</span>
                      <span className="font-bold text-base shrink-0 w-24 text-right"
                        style={{ color: t.amount >= 0 ? T.green : T.text }}>
                        {t.amount >= 0 ? "+" : ""}{eur(t.amount)}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(t)}
                          style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: T.muted }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => onDelete?.(t.id)} aria-label="Supprimer la transaction"
                          style={{ background: "none", border: "1px solid rgba(255,90,95,0.3)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: T.red }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </>
      )}

      {mainTab === "budgets" && (
        <Card>
          <h2 className="text-xl font-bold mb-1" style={{ color: T.text }}>Budgets par catégorie</h2>
          <p className="text-sm mb-5" style={{ color: T.muted }}>Fixez un plafond mensuel par catégorie de dépense. Laissez vide = pas de limite.</p>
          <div className="flex flex-col gap-4">
            {allCats.map(cat => {
              const spent   = spentByCat[cat] || 0;
              const limit   = budgets?.[cat] || 0;
              const pctUsed = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
              const color   = pctUsed >= 100 ? T.red : pctUsed >= 80 ? T.amber : T.green;
              const catCol  = CAT_COLORS[cat] || T.muted;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catCol }} />
                    <span className="text-sm font-semibold flex-1" style={{ color: T.text }}>{cat}</span>
                    <span className="text-sm font-bold" style={{ color: spent > 0 ? T.text : T.muted }}>{eur(spent)}</span>
                    <span style={{ color: T.muted, fontSize: 12 }}>/</span>
                    <input
                      type="number"
                      placeholder="illimité"
                      value={budgets?.[cat] || ""}
                      onChange={e => setBudgets(b => ({ ...b, [cat]: +e.target.value || 0 }))}
                      style={{ width: 90, padding: "4px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)", color: T.text, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: T.muted, fontSize: 12 }}>€ max</span>
                  </div>
                  {limit > 0 && (
                    <div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pctUsed}%`, background: color }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span style={{ fontSize: 12, color: T.muted }}>{pctUsed.toFixed(0)}% utilisé</span>
                        {pctUsed >= 100
                          ? <span style={{ fontSize: 12, color: T.red, fontWeight: 700 }}>Plafond dépassé de {eur(spent - limit)}</span>
                          : <span style={{ fontSize: 12, color: T.muted }}>Reste {eur(limit - spent)}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PER — économie d'impôt + arbitrage vs CTO                          */
/* ------------------------------------------------------------------ */
const TMI_BRACKETS = [
  ["0 %", 0], ["11 %", 0.11], ["30 %", 0.30], ["41 %", 0.41], ["45 %", 0.45],
];

function PERSimulator({ monthly = 200, years = 20 }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);

  const [tmiNow, setTmiNow]           = useState(0.30);
  const [tmiRetraite, setTmiRetraite] = useState(0.11);
  const [returnPct, setReturnPct]     = useState(5);
  const [chartRef, chartW]            = useElementWidth();

  const opts = { monthly, years, tmiNow, tmiRetraite, annualReturn: returnPct / 100 };
  const r      = useMemo(() => perSimulation(opts), [monthly, years, tmiNow, tmiRetraite, returnPct]);
  const series = useMemo(() => perSeries(opts), [monthly, years, returnPct, tmiNow]);

  const perWins = r.winner === "per";
  const accent  = perWins ? T.green : T.amber;

  const Num = ({ label, val, color }) => (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: color || T.text, fontWeight: 800, fontSize: 18 }}>{val}</div>
    </div>
  );

  const TmiSelect = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(+e.target.value)}
      style={{ ...inputStyle, paddingRight: 34,
        appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23${(T.muted || '#94a3b8').replace('#','')}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}>
      {TMI_BRACKETS.map(([lbl, v]) => <option key={v} value={v}>{lbl}</option>)}
    </select>
  );

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank size={20} style={{ color: T.violet }} />
        <h2 className="text-xl font-bold" style={{ color: T.text }}>PER — économie d'impôt</h2>
      </div>
      <p className="text-sm mb-5" style={{ color: T.muted }}>
        Vos versements sur un Plan Épargne Retraite sont déductibles de votre revenu imposable. Comparez avec un investissement direct (CTO).
        {" "}Le versement ({eur(monthly)}/mois) et l'horizon ({years} ans) viennent des <b style={{ color: T.text }}>Paramètres</b> ci-dessus.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <Field label="Rendement (%/an)">
          <input type="number" step="0.5" min={0} value={returnPct} onChange={e => setReturnPct(Math.max(0, +e.target.value || 0))} style={inputStyle} />
        </Field>
        <Field label="Votre TMI aujourd'hui">
          <TmiSelect value={tmiNow} onChange={setTmiNow} />
        </Field>
        <Field label="TMI estimée à la retraite">
          <TmiSelect value={tmiRetraite} onChange={setTmiRetraite} />
        </Field>
      </div>

      {/* Économie d'impôt — le chiffre vedette */}
      <div style={{ background: T.violet + "12", border: `1px solid ${T.violet}44`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ color: T.muted, fontSize: 13 }}>Économie d'impôt dès cette année</div>
        <div style={{ color: T.violet, fontWeight: 800, fontSize: 28 }}>{eur(r.economieImpotAnnuelle)}</div>
        <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
          soit {eur(r.economieImpotTotale)} sur {years} ans (versement {eur(monthly * 12)}/an × TMI {(tmiNow * 100).toFixed(0)} %)
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
        <Num label={`Net PER (capital, dans ${years} ans)`} val={eur(r.netPER)} color={perWins ? accent : T.text} />
        <Num label={`Net CTO (même versement brut)`} val={eur(r.netCTO)} color={!perWins ? accent : T.text} />
        <Num label="Avantage du meilleur choix" val={eur(Math.abs(r.avantage))} color={accent} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {perWins ? <TrendingUp size={18} style={{ color: accent }} /> : <AlertTriangle size={18} style={{ color: accent }} />}
        <span style={{ color: accent, fontWeight: 700, fontSize: 14 }}>
          {perWins
            ? "Le PER est plus avantageux — surtout si votre TMI baisse à la retraite."
            : "Le CTO l'emporte ici — votre TMI à la retraite est trop élevée pour profiter de la déduction."}
        </span>
      </div>

      <div ref={chartRef} style={{ width: "100%", height: 240 }}>
        {chartW > 0 && (
          <AreaChart width={chartW} height={240} data={series} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="perGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.violet} stopOpacity={0.35} />
                <stop offset="100%" stopColor={T.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: T.muted }} />
            <YAxis tickFormatter={v => `${Math.round(v / 1000)} k€`} tick={{ fontSize: 12, fill: T.muted }} width={48} />
            <Tooltip {...chartTip} formatter={(v, n) => [eur(v), n]} />
            <Legend />
            <Area type="monotone" dataKey="per" name="PER + éco. impôt réinvestie" stroke={T.violet} strokeWidth={2.5} fill="url(#perGrad)" />
            <Area type="monotone" dataKey="cto" name="CTO (versements seuls)" stroke={T.muted} strokeWidth={2} fill="none" strokeDasharray="5 4" />
          </AreaChart>
        )}
      </div>
      <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: T.muted }}>
        <AlertTriangle size={12} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span>Hypothèse : sortie en capital (versements imposés au barème, plus-values au PFU 30 %), versements dans le plafond épargne retraite, TMI supposée constante (pas de changement de tranche), économie d'impôt réinvestie. Estimation pédagogique, pas un conseil fiscal.</span>
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  ÉCRAN : SIMULATIONS                                                */
/* ------------------------------------------------------------------ */
function Simulations({ totals, simParams, setSimParams, age, transactions }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);
  const { monthly, initial, price, horizon } = simParams;
  const setMonthly = (v) => setSimParams((p) => ({ ...p, monthly: v }));
  const setInitial = (v) => setSimParams((p) => ({ ...p, initial: v }));
  const setPrice = (v) => setSimParams((p) => ({ ...p, price: v }));
  const setHorizon = (v) => setSimParams((p) => ({ ...p, horizon: v }));
  const [fee, setFee] = useState(1.8);
  const [activeTab, setActiveTab] = useState("etf");
  const [inflationRate, setInflationRate] = useState(0.02);
  const [cryptoTip, setCryptoTip] = useState(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [liveTs, setLiveTs] = useState(null);
  const [liveCountdown, setLiveCountdown] = useState(30);
  const tipTimer = useRef(null);

  const fetchLivePrices = async () => {
    setLiveLoading(true);
    setLiveError(null);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur,usd&include_24hr_change=true",
        { signal: ctrl.signal }
      );
      if (!res.ok) throw new Error(res.status === 429 ? "rate-limit" : "network");
      const data = await res.json();
      if (!data?.bitcoin?.eur) throw new Error("payload");
      setLiveData(data);
      setLiveTs(new Date().toLocaleTimeString("fr-FR"));
      setLiveCountdown(30);
    } catch (_) {
      setLiveError("Service indisponible — vérifiez votre connexion ou réessayez.");
    }
    finally { clearTimeout(timeout); setLiveLoading(false); }
  };
  useEffect(() => {
    if (!liveOpen) return;
    fetchLivePrices();
    const iv = setInterval(fetchLivePrices, 30000);
    return () => clearInterval(iv);
  }, [liveOpen]);
  useEffect(() => {
    if (!liveOpen) return;
    const tick = setInterval(() => setLiveCountdown((c) => (c > 0 ? c - 1 : 30)), 1000);
    return () => clearInterval(tick);
  }, [liveOpen]);

  const showCryptoTip = (e, coin) => {
    clearTimeout(tipTimer.current);
    const r = e.currentTarget.getBoundingClientRect();
    setCryptoTip({ coin, x: Math.min(r.left, window.innerWidth - 520), y: r.bottom + 8 });
  };
  const hideCryptoTip = () => { tipTimer.current = setTimeout(() => setCryptoTip(null), 200); };
  const keepCryptoTip = () => clearTimeout(tipTimer.current);

  // Immobilier : amortissement RÉEL d'un achat à crédit (apport + frais de
  // notaire + crédit amorti). L'equity = valeur du bien − capital restant dû.
  // Série unique réutilisée par le graphique et le comparatif.
  const immoSeries = useMemo(
    () => immoDetailedSeries(price, horizon, SIM_START_YEAR),
    [price, horizon]
  );
  const immoEquityAt = (y) => immoSeries[Math.min(y, immoSeries.length - 1)]?.capital ?? 0;

  const sim = useMemo(() => {
    const apports = initial + monthly * 12 * horizon;
    const capA = fv(initial, monthly, RATE_A, horizon);
    const capC = fv(initial, monthly, RATE_C, horizon);
    const detailedB = immoSeries;
    const lastB = detailedB[detailedB.length - 1];
    const capB = lastB.capital;
    const apportB = lastB.apports;            // cash réellement sorti (apport + notaire + mensualités)
    const capBTC = fv(initial, monthly, RATE_SCENARIOS.btc.base, horizon);
    const capETH = fv(initial, monthly, RATE_SCENARIOS.eth.base, horizon);
    // Bandes d'incertitude pess/base/opt (l'historique crypto = borne HAUTE, pas la base).
    const detailedA   = fvBandSeries(initial, monthly, RATE_SCENARIOS.etf,    horizon, SIM_START_YEAR);
    const detailedC   = fvBandSeries(initial, monthly, RATE_SCENARIOS.livret, horizon, SIM_START_YEAR);
    const detailedBTC = fvBandSeries(initial, monthly, RATE_SCENARIOS.btc,    horizon, SIM_START_YEAR);
    const detailedETH = fvBandSeries(initial, monthly, RATE_SCENARIOS.eth,    horizon, SIM_START_YEAR);
    return {
      apports,
      A: { cap: capA, gain: capA - apports },
      B: { cap: capB, apport: apportB, gain: capB - apportB, cashflow: -102 },
      C: { cap: capC, gain: capC - apports, passif: (capC * RATE_C) / 12 },
      BTC: { cap: capBTC, gain: capBTC - apports },
      ETH: { cap: capETH, gain: capETH - apports },
      detailedA, detailedB, detailedC, detailedBTC, detailedETH,
    };
  }, [monthly, initial, price, horizon, immoSeries]);

  // Détecteur de frais cachés
  const fees = useMemo(() => {
    const wpea = initial * Math.pow(1 + RATE_A, horizon);
    const bank = initial * Math.pow(1 + (RATE_A - fee / 100), horizon);
    return { wpea, bank, manque: wpea - bank };
  }, [initial, fee, horizon]);

  // Capacité d'emprunt — détection profil + règles bancaires françaises
  const profileType = useMemo(() => detectProfileType(transactions || []), [transactions]);
  const bCfg = PROFILE_CONFIG[profileType];
  const revenueForBank = Math.round(totals.revenus * bCfg.revenueRatio);
  const mensualiteMax = Math.max(0, Math.round(revenueForBank * 0.35 * bCfg.capacityMult));
  const loan20 = Math.round(loanFromPayment(mensualiteMax, 0.035, 20));
  const loan25 = Math.round(loanFromPayment(mensualiteMax, 0.037, 25));

  // FIRE — taux réel = taux nominal − inflation (pouvoir d'achat constant)
  const fireAge = useMemo(() => {
    const annualNeeds = (totals.chargesFixes + totals.depensesVar) * 12;
    const fireTarget  = annualNeeds * 25;
    const realRate    = (1 + RATE_A) / (1 + inflationRate) - 1;
    for (let y = 0; y <= 50; y++) {
      if (fv(initial, monthly, realRate, y) >= fireTarget) return age + y;
    }
    return "—";
  }, [totals.chargesFixes, totals.depensesVar, initial, monthly, age, inflationRate]);

  const comboSeries = useMemo(() => sim.detailedA.map((p, idx) => {
    const BTC = sim.detailedBTC[idx].capital;
    const ETH = sim.detailedETH[idx].capital;
    return {
      year: p.year,
      A: p.capital,
      B: sim.detailedB[idx].capital,
      C: sim.detailedC[idx].capital,
      BTC, ETH,
      // Échelle log pour l'axe crypto : à 25-30 %/an, BTC/ETH écrasent les
      // 20 premières années à 0 sur un axe linéaire (cf. Math.log10 plus bas).
      logBTC: BTC > 1 ? +Math.log10(BTC).toFixed(3) : 0,
      logETH: ETH > 1 ? +Math.log10(ETH).toFixed(3) : 0,
    };
  }), [sim]);

  const { nonCryptoTicks, nonCryptoDomMax } = useMemo(() => {
    const mx    = Math.max(...comboSeries.map(p => Math.max(p.A, p.B, p.C)));
    const ticks = generateSmartYTicks(mx);
    return { nonCryptoTicks: ticks, nonCryptoDomMax: ticks[ticks.length - 1] };
  }, [comboSeries]);

  // Domaine log de l'axe crypto, basé sur le capital initial (point de départ
  // commun) jusqu'au plus haut des deux capitaux finaux BTC/ETH.
  const { logDomMin, logDomMax, logTicks } = useMemo(() => {
    const domMin = Math.floor(Math.log10(Math.max(initial, 1)));
    const domMax = Math.ceil(Math.log10(Math.max(sim.ETH.cap, sim.BTC.cap)));
    const ticks  = Array.from({ length: domMax - domMin + 1 }, (_, i) => domMin + i);
    return { logDomMin: domMin, logDomMax: domMax, logTicks: ticks };
  }, [initial, sim]);

  const compare = useMemo(() => [
    { name: "ETF PEA",    tab: "etf",      rate: "10,5 %", color: ASSET.etf, risk: "Faible",        vol: "15 %",  drawdown: "−35 %", y10: fv(initial, monthly, RATE_A, 10),   yN: sim.A.cap },
    { name: "Immobilier", tab: "immo",     rate: "≈2 %/an", color: ASSET.immo, risk: "Faible",        vol: "20 %",  drawdown: "−40 %", y10: immoEquityAt(10), yN: sim.B.cap },
    { name: "Livret A",   tab: "defensif", rate: "1,5 %",  color: ASSET.livret, risk: "Très faible",   vol: "5 %",   drawdown: "−5 %",  y10: fv(initial, monthly, RATE_C, 10),   yN: sim.C.cap },
    { name: "Bitcoin",    tab: "btc",      rate: "12 % méd.",   color: ASSET.btc, risk: "Extrême",       vol: "65 %",  drawdown: "−80 %", y10: fv(initial, monthly, RATE_SCENARIOS.btc.base, 10), yN: sim.BTC.cap },
    { name: "Ethereum",   tab: "eth",      rate: "10 % méd.",   color: ASSET.eth, risk: "Extrême+",      vol: "75 %",  drawdown: "−85 %", y10: fv(initial, monthly, RATE_SCENARIOS.eth.base, 10), yN: sim.ETH.cap },
  ], [initial, monthly, price, sim]);

  const TABS = [
    { id: "etf",      label: "ETF World",  color: ASSET.etf },
    { id: "immo",     label: "Immobilier", color: ASSET.immo },
    { id: "defensif", label: "Livret A",   color: ASSET.livret },
    { id: "per",      label: "PER",        color: T.violet },
    { id: "btc",      label: "Bitcoin",    color: ASSET.btc },
    { id: "eth",      label: "Ethereum",   color: ASSET.eth },
    { id: "compare",  label: "Comparatif", color: T.blue },
  ];
  const activeColor = TABS.find((t) => t.id === activeTab)?.color || T.blue;

  const allocs = useMemo(() => age >= 55
    ? { label: "Conservateur · 55+ ans", pcts: [{ n: "ETF World", p: 60, c: ASSET.etf }, { n: "Immobilier", p: 25, c: ASSET.immo }, { n: "Livret A", p: 10, c: ASSET.livret }, { n: "Bitcoin", p: 5, c: ASSET.btc }, { n: "Ethereum", p: 0, c: ASSET.eth }] }
    : age >= 40
    ? { label: "Équilibré · 40–54 ans", pcts: [{ n: "ETF World", p: 50, c: ASSET.etf }, { n: "Immobilier", p: 30, c: ASSET.immo }, { n: "Livret A", p: 5, c: ASSET.livret }, { n: "Bitcoin", p: 10, c: ASSET.btc }, { n: "Ethereum", p: 5, c: ASSET.eth }] }
    : age >= 30
    ? { label: "Dynamique · 30–39 ans", pcts: [{ n: "ETF World", p: 40, c: ASSET.etf }, { n: "Immobilier", p: 25, c: ASSET.immo }, { n: "Livret A", p: 10, c: ASSET.livret }, { n: "Bitcoin", p: 15, c: ASSET.btc }, { n: "Ethereum", p: 10, c: ASSET.eth }] }
    : { label: "Agressif · −30 ans", pcts: [{ n: "ETF World", p: 30, c: ASSET.etf }, { n: "Immobilier", p: 15, c: ASSET.immo }, { n: "Livret A", p: 10, c: ASSET.livret }, { n: "Bitcoin", p: 20, c: ASSET.btc }, { n: "Ethereum", p: 25, c: ASSET.eth }] }
  , [age]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center flex-wrap gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>Simulations</h1>
          <p style={{ color: T.muted }}>Projetez la croissance de votre capital sur le long terme.</p>
        </div>
        <button
          onClick={() => setLiveOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shrink-0 wt-button-press"
          style={{
            background: T.gradientPrimary,
            color: "#fff", border: "none", cursor: "pointer",
            boxShadow: glow(T.violet, 40, "33"),
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px) scale(1.015)"; e.currentTarget.style.boxShadow = glow(T.violet, 56, "55"); }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = glow(T.violet, 40, "33"); }}
        >
          {liveLoading
            ? <RefreshCw size={14} className="animate-spin" />
            : <TrendingUp size={14} />}
          Cours en temps réel
          <RefreshCw size={12} style={{ opacity: 0.7 }} />
        </button>
      </div>

      {/* Paramètres communs */}
      <Card>
        <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>Paramètres</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Investissement mensuel (€)">
            <input type="number" value={monthly} style={inputStyle}
              onChange={(e) => setMonthly(+e.target.value || 0)} />
          </Field>
          <Field label="Épargne / apport initial (€)">
            <input type="number" value={initial} style={inputStyle}
              onChange={(e) => setInitial(+e.target.value || 0)} />
          </Field>
          <Field label="Horizon">
            <select value={horizon} onChange={(e) => setHorizon(+e.target.value)}
              style={{ ...inputStyle, paddingRight: 34,
                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23${(T.muted || '#94a3b8').replace('#','')}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}>
              <option value={1}>1 an</option>
              <option value={2}>2 ans</option>
              <option value={5}>5 ans</option>
              <option value={10}>10 ans</option>
              <option value={20}>20 ans</option>
              <option value={30}>30 ans</option>
            </select>
          </Field>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm" style={{ color: T.muted }}>Inflation</span>
              <span className="font-bold text-sm" style={{ color: inflationRate > 0 ? T.amber : T.muted }}>
                {(inflationRate * 100).toFixed(1).replace(".", ",")} % / an
              </span>
            </div>
            <input type="range" min={0} max={0.05} step={0.001} value={inflationRate}
              onChange={(e) => setInflationRate(+e.target.value)}
              className="w-full" style={{ accentColor: T.amber }} />
            <div className="flex justify-between text-xs mt-1" style={{ color: T.muted }}>
              <span>0 %</span><span>2,5 %</span><span>5 %</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const hasHoverChart = t.id === "btc" || t.id === "eth" || t.id === "etf";
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              onMouseEnter={hasHoverChart ? (e) => showCryptoTip(e, t.id) : undefined}
              onMouseLeave={hasHoverChart ? hideCryptoTip : undefined}
              title={hasHoverChart ? "Survol : voir l'historique des cours" : undefined}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: activeTab === t.id ? `${t.color}18` : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${activeTab === t.id ? t.color : T.border}`,
                color: activeTab === t.id ? t.color : T.muted,
                cursor: hasHoverChart ? "help" : "pointer",
              }}>
              {t.label}
              {hasHoverChart && <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.5 }}>ℹ</span>}
            </button>
          );
        })}
      </div>

      {/* ── TAB: ETF ── */}
      {activeTab === "etf" && <>
        <ScenarioCard
          title="ETF PEA — MSCI World"
          rate="médian 10,5 %/an" accent={ASSET.etf}
          stats={[
            { label: "Capital final", value: eur(sim.A.cap), color: ASSET.etf },
            { label: "Apports totaux", value: eur(sim.apports), color: T.text },
            { label: "Intérêts générés", value: eur(sim.A.gain), color: T.green },
            { label: "Âge d'indépendance", value: typeof fireAge === "number" ? fireAge + " ans" : fireAge, color: T.amber },
          ]}
          detailedData={sim.detailedA} lineColor={ASSET.etf} chartKey="A" inflationRate={inflationRate} showBand={false}
          note="Performance historique annualisée du WPEA (MSCI World PEA) sur 10 ans ≈ 10,5 % / an. Les performances passées ne garantissent pas les performances futures."
        />

        {/* Détecteur de frais cachés */}
        <Card style={{ borderColor: "rgba(255,90,95,0.3)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold" style={{ color: T.text }}>Analyse des frais</h2>
            </div>
            <span className="text-sm" style={{ color: T.muted }}>vs WPEA sur {horizon} ans</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Field label="Capital investi (€)">
                <input type="number" value={initial} style={inputStyle}
                  onChange={(e) => setInitial(+e.target.value || 0)} />
              </Field>
              <div className="mt-5">
                <div className="flex justify-between mb-2">
                  <span className="text-sm" style={{ color: T.muted }}>Frais annuels de votre banque</span>
                  <span className="font-bold" style={{ color: T.red }}>{fee.toFixed(1).replace(".", ",")} %</span>
                </div>
                <input type="range" min={0} max={3} step={0.1} value={fee}
                  onChange={(e) => setFee(+e.target.value)}
                  className="w-full" style={{ accentColor: T.blue }} />
                <div className="flex justify-between text-xs mt-1" style={{ color: T.muted }}>
                  <span>0 %</span><span>1,5 %</span><span>3 %</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-5"
              style={{ background: "rgba(255,90,95,0.06)", border: "1px solid rgba(255,90,95,0.3)" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: T.red }}>
                MANQUE À GAGNER SUR {horizon} ANS
              </div>
              <div className="text-4xl font-bold mb-4" style={{ color: T.red }}>− {eur(fees.manque)}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="text-xs" style={{ color: T.muted }}>Avec votre banque</div>
                  <div className="font-bold" style={{ color: T.text }}>{eur(fees.bank)}</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "rgba(34,199,154,0.08)" }}>
                  <div className="text-xs" style={{ color: T.green }}>Avec le WPEA</div>
                  <div className="font-bold" style={{ color: T.green }}>{eur(fees.wpea)}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

      </>}

      {/* ── TAB: IMMO ── */}
      {activeTab === "immo" && <ImmoCard price={price} setPrice={setPrice} horizon={horizon} />}

      {/* ── TAB: DÉFENSIF ── */}
      {activeTab === "defensif" && (
        <ScenarioCard
          title="Livret A — Livret A & Épargne Sécurisée"
          rate="médian 1,5 %/an · capital garanti" accent={ASSET.livret}
          stats={[
            { label: "Capital final", value: eur(sim.C.cap), color: ASSET.livret },
            { label: "Apports totaux", value: eur(sim.apports), color: T.text },
            { label: "Intérêts générés", value: eur(sim.C.gain), color: T.green },
            { label: "Revenu passif/mois", value: eur(sim.C.passif), color: T.text },
          ]}
          detailedData={sim.detailedC} lineColor={ASSET.livret} chartKey="C" inflationRate={inflationRate} showBand={false}
          note="Intérêts composés sur Livret A, LDDS ou épargne de précaution — capital garanti et disponible à tout moment."
        />
      )}

      {/* ── TAB: PER ── */}
      {activeTab === "per" && <PERSimulator monthly={monthly} years={horizon} />}

      {/* ── TAB: BITCOIN ── */}
      {activeTab === "btc" && (
        <ScenarioCard
          title="Bitcoin"
          rate="médian 12 %/an · EXTRÊME" accent={ASSET.btc}
          lineColor={ASSET.btc} chartKey="BTC" inflationRate={inflationRate} logScale showBand={false}
          warning={{
            title: "VOLATILITÉ EXTRÊME — LIRE AVANT D'INVESTIR",
            points: [
              "Chutes historiques : −80 % en 2018, −77 % en 2022 — récupération : 2 à 3 ans",
              "Risque réglementaire : interdiction possible dans certains pays",
              "Allocation max recommandée : 5 à 10 % du portefeuille UNIQUEMENT",
            ],
            disclaimer: "Cette simulation montre un rendement théorique. En réalité, la majorité des investisseurs panic-sell avant le gain. Ne pas investir l'argent dont vous avez besoin avant 5 ans.",
          }}
          riskBadges={[
            { label: "Volatilité 65 %",      color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
            { label: "Drawdown −80 %",        color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
            { label: "Max 10 % portfolio",    color: "#f97316", bg: "rgba(249,115,22,0.08)" },
            { label: "Horizon 5 ans min",      color: "#f97316", bg: "rgba(249,115,22,0.08)" },
          ]}
          stats={[
            { label: "Capital projeté",    value: eur(sim.BTC.cap),                       color: ASSET.btc },
            { label: "Apports totaux",     value: eur(sim.apports),                       color: T.text },
            { label: "Gains potentiels",   value: eur(sim.BTC.gain),                      color: T.green },
            { label: "Multiple",           value: (sim.BTC.cap / sim.apports).toFixed(1) + "×", color: ASSET.btc },
          ]}
          detailedData={sim.detailedBTC}
          note="Rendement annualisé moyen de Bitcoin sur 10 ans. N'intègre pas les cycles de −80 %. Purement indicatif — les performances passées ne préjugent pas de l'avenir."
        />
      )}

      {/* ── TAB: ETHEREUM ── */}
      {activeTab === "eth" && (
        <ScenarioCard
          title="Ethereum"
          rate="médian 10 %/an · EXTRÊME+" accent={ASSET.eth}
          lineColor={ASSET.eth} chartKey="ETH" inflationRate={inflationRate} logScale showBand={false}
          warning={{
            title: "RISQUE EXTRÊME — RÉSERVÉ AUX UTILISATEURS AVERTIS",
            points: [
              "Chutes historiques : −85 % en 2018, −81 % en 2022",
              "Risque technologique : si le protocole Ethereum échoue ou est supplanté",
              "Allocation max recommandée : 2 à 5 % du portefeuille UNIQUEMENT",
            ],
            disclaimer: "Ethereum est encore plus spéculatif que Bitcoin. Réservé aux investisseurs qui comprennent la blockchain et acceptent une perte totale de leur mise.",
          }}
          riskBadges={[
            { label: "Volatilité 75 %",     color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
            { label: "Drawdown −85 %",       color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
            { label: "Max 5 % portfolio",    color: "#f97316", bg: "rgba(249,115,22,0.08)" },
            { label: "Risque technologique", color: "#eab308", bg: "rgba(234,179,8,0.08)" },
          ]}
          stats={[
            { label: "Capital projeté",  value: eur(sim.ETH.cap),                       color: ASSET.eth },
            { label: "Apports totaux",   value: eur(sim.apports),                       color: T.text },
            { label: "Gains potentiels", value: eur(sim.ETH.gain),                      color: T.green },
            { label: "Multiple",         value: (sim.ETH.cap / sim.apports).toFixed(1) + "×", color: ASSET.eth },
          ]}
          detailedData={sim.detailedETH}
          note="Rendement annualisé moyen d'Ethereum sur 8 ans. Plus volatil que Bitcoin, moins de recul historique. Purement indicatif."
        />
      )}

      {/* ── TAB: COMPARATIF ── */}
      {activeTab === "compare" && (
        <Card>
          {/* En-tête */}
          <div className="flex items-center flex-wrap gap-3 mb-2">
            <TrendingUp size={20} style={{ color: T.blue }} />
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Comparatif — 5 scénarios</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: T.muted }}>
            Axe gauche · scénarios sûrs (échelle linéaire) &nbsp;|&nbsp; Axe droit · crypto (échelle logarithmique, ×10 par graduation) — même horizon, deux échelles pour tout lire d'un coup.
          </p>

          {/* Légende manuelle */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs">
            {[
              { label: "ETF World (10,5 %)",  color: "#22c55e", dash: false, axis: "←" },
              { label: "Immobilier (≈2 %/an)", color: "#f59e0b", dash: false, axis: "←" },
              { label: "Livret A (1,5 %)",     color: "#94a3b8", dash: false, axis: "←" },
              { label: "Bitcoin (30 %)",       color: "#ef4444", dash: true,  axis: "→ log" },
              { label: "Ethereum (25 %)",      color: "#a855f7", dash: true,  axis: "→ log" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span style={{
                  display: "inline-block", width: 24, height: 2,
                  background: l.dash
                    ? `repeating-linear-gradient(to right,${l.color} 0,${l.color} 5px,transparent 5px,transparent 9px)`
                    : l.color,
                }} />
                <span style={{ color: T.muted }}>{l.label}</span>
                <span style={{ color: T.muted, opacity: 0.45, fontSize: 12 }}>{l.axis}</span>
              </span>
            ))}
          </div>

          {/* Graphique double axe */}
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={comboSeries} margin={{ top: 8, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval={0} />

              {/* Axe gauche — scénarios sûrs */}
              <YAxis
                yAxisId="safe"
                orientation="left"
                domain={[0, nonCryptoDomMax]}
                ticks={nonCryptoTicks}
                stroke={T.muted}
                tick={{ fontSize: 12 }}
                tickFormatter={simsYFmt}
                width={54}
              />

              {/* Axe droit — crypto, échelle log (chaque graduation = ×10) */}
              <YAxis
                yAxisId="crypto"
                orientation="right"
                domain={[logDomMin, logDomMax]}
                ticks={logTicks}
                stroke={`${ASSET.btc}44`}
                tick={{ fontSize: 12, fill: `${ASSET.btc}99` }}
                tickFormatter={logFmt}
                width={58}
              />

              <Tooltip
                {...chartTip}
                formatter={(v, name, props) => {
                  const key = props.dataKey;
                  const raw = key === "logBTC" ? props.payload.BTC
                    : key === "logETH" ? props.payload.ETH
                    : v;
                  return [eur(raw), name];
                }}
              />

              {/* Courbes sûres — axe gauche, échelle linéaire */}
              <Line yAxisId="safe" type="monotone" dataKey="A" name="ETF World"  stroke={ASSET.etf}    strokeWidth={3}   dot={false} />
              <Line yAxisId="safe" type="monotone" dataKey="B" name="Immobilier" stroke={ASSET.immo}   strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
              <Line yAxisId="safe" type="monotone" dataKey="C" name="Livret A"   stroke={ASSET.livret} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />

              {/* Courbes crypto — axe droit, échelle log */}
              <Line yAxisId="crypto" type="monotone" dataKey="logBTC" name="Bitcoin"  stroke={ASSET.btc} strokeWidth={2.5} dot={false} strokeDasharray="10 4" />
              <Line yAxisId="crypto" type="monotone" dataKey="logETH" name="Ethereum" stroke={ASSET.eth} strokeWidth={2}   dot={false} strokeDasharray="3 4" />
            </LineChart>
          </ResponsiveContainer>

          {/* Tableau récapitulatif */}
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Scénario", "Rendement", "À 10 ans", `À ${horizon} ans`, "Multiple", "Risque"].map((h) => (
                    <th key={h} className="py-2 px-3 text-left text-xs font-semibold" style={{ color: T.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.map((c) => (
                  <tr key={c.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setActiveTab(c.tab)}
                        className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                        style={{ color: c.color, border: `1px solid ${c.color}44` }}
                      >{c.name}</button>
                    </td>
                    <td className="py-3 px-3 font-bold text-xs" style={{ color: c.color }}>{c.rate}</td>
                    <td className="py-3 px-3 font-bold" style={{ color: c.color }}>{eur(c.y10)}</td>
                    <td className="py-3 px-3 font-bold" style={{ color: c.color }}>{eur(c.yN)}</td>
                    <td className="py-3 px-3 font-bold" style={{ color: c.color }}>{(c.yN / sim.apports).toFixed(1)}×</td>
                    <td className="py-3 px-3 text-xs" style={{ color: T.muted }}>{c.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3" style={{ color: T.muted }}>
            Rendements basés sur les performances historiques annualisées de chaque actif. Les performances passées ne garantissent pas les rendements futurs. Cliquez sur un scénario pour accéder à son analyse détaillée.
          </p>
        </Card>
      )}

      {/* ── MODAL: Prix Live ── */}
      {liveOpen && (
        <div
          className="wt-fade-in"
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLiveOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="wt-scale-in"
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, width: 480, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} style={{ color: T.blue }} />
                <span className="text-lg font-bold" style={{ color: T.text }}>Cours en temps réel</span>
              </div>
              <button onClick={() => setLiveOpen(false)} aria-label="Fermer" style={{ background: "rgba(255,255,255,0.07)", border: "none", color: T.muted, borderRadius: 10, minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {liveLoading && !liveData && (
              <div className="flex items-center justify-center gap-3 py-8" style={{ color: T.muted }}>
                <RefreshCw size={18} className="animate-spin" />
                <span>Chargement des prix en direct…</span>
              </div>
            )}
            {!liveLoading && !liveData && liveError && (
              <div className="flex flex-col items-center gap-3 py-8">
                <AlertTriangle size={28} style={{ color: T.red }} />
                <span className="text-sm text-center" style={{ color: T.red }}>{liveError}</span>
                <button onClick={fetchLivePrices} className="px-4 py-2 rounded-xl text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", color: T.muted, border: `1px solid ${T.border}` }}>
                  Réessayer
                </button>
              </div>
            )}

            {liveData && (() => {
              const coins = [
                { key: "bitcoin", label: "Bitcoin (BTC)", color: "#f7931a" },
                { key: "ethereum", label: "Ethereum (ETH)", color: "#627eea" },
              ];
              return (
                <div className="flex flex-col gap-4">
                  {coins.map((coin) => {
                    const d = liveData[coin.key];
                    if (!d) return null;
                    const chg = Number.isFinite(d.eur_24h_change) ? d.eur_24h_change : 0;
                    const up = chg >= 0;
                    return (
                      <div key={coin.key} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${coin.color}33` }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold" style={{ color: T.text }}>{coin.label}</span>
                          <span className="text-sm font-bold px-2 py-0.5 rounded-lg"
                            style={{ color: up ? "#22c55e" : "#ef4444", background: up ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                            {up ? "↑" : "↓"} {Math.abs(chg).toFixed(2)} %
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg p-3" style={{ background: `${coin.color}0d` }}>
                            <div className="text-xs mb-1" style={{ color: T.muted }}>EUR</div>
                            <div className="text-2xl font-bold" style={{ color: coin.color }}>
                              {d.eur >= 1000 ? "€" + d.eur.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "€" + d.eur.toFixed(2)}
                            </div>
                          </div>
                          <div className="rounded-lg p-3" style={{ background: "rgba(139,92,246,0.08)" }}>
                            <div className="text-xs mb-1" style={{ color: T.muted }}>USD</div>
                            <div className="text-2xl font-bold" style={{ color: T.blue }}>
                              {d.usd >= 1000 ? "$" + d.usd.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "$" + d.usd.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                    <div className="text-xs" style={{ color: T.muted }}>
                      Mis à jour : <span style={{ color: T.text }}>{liveTs}</span>
                      <span className="ml-3" style={{ color: T.muted }}>· Prochain dans {liveCountdown}s</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: T.green }}>
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" style={{ animation: "pulse 2s infinite" }} />
                      En direct
                    </div>
                  </div>
                  <button onClick={fetchLivePrices} disabled={liveLoading}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium"
                    style={{ border: `1px solid ${T.border}`, color: T.muted, background: "rgba(255,255,255,0.02)", cursor: liveLoading ? "default" : "pointer" }}>
                    <RefreshCw size={13} className={liveLoading ? "animate-spin" : ""} />
                    Actualiser maintenant
                  </button>
                  <p className="text-xs text-center" style={{ color: T.muted }}>
                    Source : CoinGecko (gratuit · aucune clé API)
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Floating crypto history tooltip */}
      {cryptoTip && (
        <div
          onMouseEnter={keepCryptoTip}
          onMouseLeave={hideCryptoTip}
          style={{
            position: "fixed",
            top: cryptoTip.y,
            left: cryptoTip.x,
            width: 500,
            zIndex: 1000,
            background: T.card,
            border: `2px solid ${cryptoTip.coin === "btc" ? "#f7931a" : cryptoTip.coin === "eth" ? "#627eea" : T.cyan}`,
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            padding: 20,
            overflowY: "auto",
            maxHeight: "80vh",
          }}
        >
          {cryptoTip.coin === "etf"
            ? <ETFHistoryTooltip />
            : <CryptoHistoryTooltip coin={cryptoTip.coin} />}
        </div>
      )}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CRYPTO HISTORY TOOLTIP                                             */
/* ------------------------------------------------------------------ */

function ETFHistoryTooltip() {
  const T = useT();
  const color = T.cyan;
  const currentPrice = 3640;
  const bottomPrice  = 580;
  const gainPct = Math.round((currentPrice / bottomPrice - 1) * 100);

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    if (payload.type === "peak")    return <circle cx={cx} cy={cy} r={5} fill="#ef4444" />;
    if (payload.type === "bottom")  return <circle cx={cx} cy={cy} r={5} fill="#22c55e" />;
    if (payload.type === "current") return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />;
    return <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.4} />;
  };

  const milestones = MSCI_HISTORY.filter((d) => d.type !== "neutral");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-bold" style={{ color }}>MSCI World — Historique de l'indice</div>
          <div className="text-xs" style={{ color: T.muted }}>WPEA (ETF PEA) · Depuis 2000 · En points d'indice (EUR)</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="text-xs mb-0.5" style={{ color: T.muted }}>Indice actuel</div>
          <div className="font-bold text-sm" style={{ color }}>{currentPrice.toLocaleString("fr-FR")} pts</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "rgba(34,197,94,0.06)" }}>
          <div className="text-xs mb-0.5" style={{ color: T.muted }}>Depuis le creux 2003</div>
          <div className="font-bold text-sm" style={{ color: T.green }}>+{gainPct.toLocaleString("fr-FR")} %</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={MSCI_HISTORY} margin={{ top: 5, right: 10, bottom: 5, left: 52 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" stroke={T.muted} tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, 4000]} stroke={T.muted} tick={{ fontSize: 12 }}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          />
          <Tooltip
            contentStyle={{ background: T.card, border: `1px solid ${color}55`, borderRadius: 8, fontSize: 12 }}
            formatter={(v, n, { payload }) => [`${v.toLocaleString("fr-FR")} pts`, payload.event]}
            labelFormatter={(l) => l}
          />
          <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2.5}
            dot={<CustomDot />} activeDot={{ r: 6, fill: color }} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 mb-3">
        <div className="text-xs font-semibold mb-2" style={{ color: T.muted, letterSpacing: 1 }}>DATES MARQUANTES</div>
        <div className="grid grid-cols-4 gap-1">
          {milestones.map((d) => (
            <div key={d.label + d.event} className="rounded-lg p-1.5 text-center"
              style={{
                background: d.type === "peak" ? "rgba(239,68,68,0.1)"
                  : d.type === "bottom" ? "rgba(34,197,94,0.1)"
                  : `${color}11`,
              }}>
              <div className="text-xs font-bold"
                style={{ color: d.type === "peak" ? "#ef4444" : d.type === "bottom" ? "#22c55e" : color }}>
                {d.label}
              </div>
              <div className="font-semibold" style={{ color: T.text, fontSize: 12 }}>{d.price.toLocaleString("fr-FR")} pts</div>
              <div style={{ color: T.muted, fontSize: 12 }}>{d.event}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: T.muted }}>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Peak</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Creux</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> Aujourd'hui</span>
      </div>

      {/* Description */}
      <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}` }}>
        <div className="font-bold mb-1.5" style={{ color }}>C'est quoi le MSCI World ?</div>
        <p style={{ color: T.muted, lineHeight: 1.6 }}>
          Le <span style={{ color: T.text, fontWeight: 600 }}>MSCI World</span> est un indice boursier qui regroupe{" "}
          <span style={{ color: T.text, fontWeight: 600 }}>~1 500 grandes entreprises</span> dans 23 pays développés
          (États-Unis, Europe, Japon…). Investi via un{" "}
          <span style={{ color: T.text, fontWeight: 600 }}>ETF PEA</span>, il réplique passivement cet indice
          à très faibles frais (TER ≈ 0,12–0,20 % / an) et bénéficie de la fiscalité avantageuse du PEA après 5 ans.
          Les États-Unis représentent environ <span style={{ color: T.text, fontWeight: 600 }}>70 %</span> du portefeuille,
          dominé par Apple, Microsoft, Nvidia, Amazon et Google.
        </p>
      </div>

      <div className="rounded-lg p-2.5 text-xs italic"
        style={{ background: "rgba(34,199,154,0.06)", border: "1px solid rgba(34,199,154,0.25)", color: "#6ee7b7" }}>
        Rendement annualisé ~10,5 % / an sur 15 ans (2009–2026). Les performances passées ne garantissent pas les performances futures.
      </div>
    </div>
  );
}

function CryptoHistoryTooltip({ coin }) {
  const T = useT();
  const isBTC = coin === "btc";
  const raw    = isBTC ? BTC_HISTORY : ETH_HISTORY;
  const color  = isBTC ? "#f7931a" : "#627eea";
  const name   = isBTC ? "Bitcoin" : "Ethereum";
  const createdPrice  = isBTC ? 0.30 : 1;
  const currentPrice  = isBTC ? 73469 : 1964;
  const gainPct = Math.round((currentPrice / createdPrice - 1) * 100);

  const logData = raw.map((d) => ({
    ...d,
    logPrice: parseFloat(Math.log10(d.price).toFixed(3)),
  }));
  const yMin = Math.floor(Math.log10(Math.min(...raw.map((d) => d.price))));
  const yMax = Math.ceil(Math.log10(Math.max(...raw.map((d) => d.price))));
  const yTicks = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    if (payload.type === "peak")    return <circle cx={cx} cy={cy} r={5} fill="#ef4444" />;
    if (payload.type === "bottom")  return <circle cx={cx} cy={cy} r={5} fill="#22c55e" />;
    if (payload.type === "current") return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />;
    return <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.4} />;
  };

  const milestones = raw.filter((d) => d.type !== "neutral");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-bold" style={{ color }}>{name} — Historique des cours</div>
          <div className="text-xs" style={{ color: T.muted }}>Depuis la création jusqu'au 8 juin 2026 · Échelle log</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="text-xs mb-0.5" style={{ color: T.muted }}>Prix actuel</div>
          <div className="font-bold text-sm" style={{ color }}>{eur(currentPrice)}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "rgba(34,197,94,0.06)" }}>
          <div className="text-xs mb-0.5" style={{ color: T.muted }}>Gain depuis création</div>
          <div className="font-bold text-sm" style={{ color: T.green }}>+{gainPct.toLocaleString("fr-FR")} %</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={logData} margin={{ top: 5, right: 10, bottom: 5, left: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" stroke={T.muted} tick={{ fontSize: 12 }} />
          <YAxis
            domain={[yMin, yMax]} ticks={yTicks}
            stroke={T.muted} tick={{ fontSize: 12 }}
            tickFormatter={(v) => {
              const val = Math.pow(10, v);
              if (val < 1)    return "€" + val.toFixed(1);
              if (val < 1000) return "€" + Math.round(val);
              return "€" + Math.round(val / 1000) + "k";
            }}
          />
          <Tooltip
            contentStyle={{ background: T.card, border: `1px solid ${color}55`, borderRadius: 8, fontSize: 12 }}
            formatter={(v, n, { payload }) => [eur(payload.price), payload.event]}
            labelFormatter={(l) => l}
          />
          <Line type="monotone" dataKey="logPrice" stroke={color} strokeWidth={2.5}
            dot={<CustomDot />} activeDot={{ r: 6, fill: color }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Milestones grid */}
      <div className="mt-3 mb-3">
        <div className="text-xs font-semibold mb-2" style={{ color: T.muted, letterSpacing: 1 }}>DATES MARQUANTES</div>
        <div className="grid grid-cols-4 gap-1">
          {milestones.map((d) => (
            <div key={d.label + d.event} className="rounded-lg p-1.5 text-center"
              style={{
                background: d.type === "peak" ? "rgba(239,68,68,0.1)"
                  : d.type === "bottom" ? "rgba(34,197,94,0.1)"
                  : `${color}11`,
              }}>
              <div className="text-xs font-bold"
                style={{ color: d.type === "peak" ? "#ef4444" : d.type === "bottom" ? "#22c55e" : color }}>
                {d.label}
              </div>
              <div className="font-semibold" style={{ color: T.text, fontSize: 12 }}>{eur(d.price)}</div>
              <div style={{ color: T.muted, fontSize: 12 }}>{d.event}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: T.muted }}>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Peak</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Creux</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> Aujourd'hui</span>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg p-2.5 text-xs italic"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
        Ce graphique montre l'historique passé uniquement. Le futur ne sera pas forcément identique.{" "}
        {isBTC ? "Bitcoin" : "Ethereum"} peut monter, descendre ou crasher à tout moment.
      </div>
    </div>
  );
}

function ImmoCard({ price, setPrice, horizon }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const DURATION = IMMO_LOAN_YEARS;
  const apport = Math.round(price * IMMO_DOWN_FRAC);
  const notary = Math.round(price * IMMO_NOTARY_FRAC);
  const monthlyPayment = Math.round(loanPayment(price - apport, IMMO_LOAN_RATE, DURATION));
  const years = Math.min(horizon, DURATION);
  const data = immoDetailedSeries(price, years, 2026);

  const last          = data[data.length - 1];
  const totalInvested = last.apports;        // apport + notaire + mensualités versées (cash réel)
  const gain          = last.gains;          // equity − cash réellement investi

  const fmt = (v) => v >= 1000000 ? `${(v/1000000).toFixed(2)} M€` : `${Math.round(v/1000)}k€`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 12, minWidth: 220 }}>
        <div style={{ color: T.muted, fontWeight: 700, marginBottom: 8 }}>En {d.year}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4 }}>
          <span style={{ color: ASSET.immo }}>Valeur du bien</span>
          <span style={{ color: T.text, fontWeight: 700 }}>{eur(d.propValue)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4 }}>
          <span style={{ color: "#ef4444" }}>Crédit restant</span>
          <span style={{ color: T.text, fontWeight: 700 }}>{eur(d.loanRemaining)}</span>
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", gap: 20 }}>
          <span style={{ color: T.green, fontWeight: 700 }}>Votre capital</span>
          <span style={{ color: T.green, fontWeight: 800 }}>{eur(d.equity)}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Saisie */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Prix du bien immobilier (€)">
              <input type="number" value={price} style={inputStyle}
                onChange={(e) => setPrice(+e.target.value || 0)} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[150000, 200000, 300000, 400000].map(p => (
              <button key={p} onClick={() => setPrice(p)}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: price === p ? T.amber + "22" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${price === p ? T.amber : T.border}`,
                  color: price === p ? T.amber : T.muted }}>
                {p/1000}k€
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {[
          { label: "Apport + notaire",            value: eur(apport + notary), sub: `dont ${eur(notary)} de frais de notaire`, color: T.text  },
          { label: "Mensualité crédit",           value: eur(monthlyPayment), sub: `sur ${DURATION} ans à 3,5 %`, color: T.amber },
          { label: `Bien vaut dans ${years} ans`, value: eur(last.propValue), sub: "+2 % / an de valorisation",   color: ASSET.immo },
          { label: "Gain net réel",               value: eur(gain),           sub: `capital ${eur(last.equity)} − cash investi`, color: gain >= 0 ? T.green : T.red },
        ].map(k => (
          <div key={k.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ color: T.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 22, fontWeight: 800 }}>{k.value}</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Graphique */}
      <Card style={{ borderColor: T.amber + "33" }}>
        <h2 style={{ color: T.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Comment votre capital se constitue</h2>
        <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
          Le bien prend de la valeur chaque année (+2 %), pendant que votre crédit fond. La différence entre les deux, c'est <strong style={{ color: T.green }}>votre capital</strong>.
        </p>

        {/* Légende */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16, fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 28, height: 3, background: ASSET.immo, borderRadius: 2, display: "inline-block" }} />
            <span style={{ color: T.muted }}>Valeur du bien</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 28, height: 3, background: "#ef4444", borderRadius: 2, display: "inline-block" }} />
            <span style={{ color: T.muted }}>Crédit restant à rembourser</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 28, height: 3, background: T.green, borderRadius: 2, display: "inline-block" }} />
            <span style={{ color: T.muted }}>Votre capital (ce que vous possédez vraiment)</span>
          </span>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval={0} />
            <YAxis stroke={T.muted} tick={{ fontSize: 12 }} tickFormatter={fmt} width={58} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="propValue"     name="Valeur du bien"    stroke={ASSET.immo} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="loanRemaining" name="Crédit restant"    stroke="#ef4444"   strokeWidth={2}   dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="equity"        name="Votre capital"     stroke={T.green}   strokeWidth={3}   dot={false} />
          </LineChart>
        </ResponsiveContainer>

        {/* Explication simple */}
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          {[
            { Icon: Home,         color: ASSET.immo, title: "Vous achetez", text: `Un bien à ${eur(price)} avec ${eur(apport)} d'apport. La banque prête le reste.` },
            { Icon: TrendingDown, color: "#ef4444",  title: "Le crédit fond", text: `Chaque mois vous remboursez ${eur(monthlyPayment)}. Le capital dû diminue progressivement.` },
            { Icon: TrendingUp,   color: ASSET.immo, title: "Le bien prend de la valeur", text: `+2 % par an en moyenne. Dans ${years} ans il vaut ${eur(last.propValue)}.` },
            { Icon: PiggyBank,    color: T.green,    title: "Votre capital croît", text: `Valeur − crédit = ${eur(last.equity)} dans ${years} ans. C'est votre enrichissement réel.` },
          ].map(b => (
            <div key={b.title} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ marginBottom: 6 }}><b.Icon size={20} style={{ color: b.color }} /></div>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{b.title}</div>
              <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>{b.text}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        Modèle simplifié · Taux fixe 3,5 % · Valorisation +2 %/an · Apport 10 % · Hors frais de notaire (~8 %), taxe foncière, charges de copropriété et fiscalité des loyers.
        À affiner avec un courtier pour votre situation réelle.
      </div>
    </>
  );
}

function ScenarioCard({ title, rate, accent, stats, detailedData, lineColor, note, chartKey, inflationRate = 0, warning = null, riskBadges = null, logScale = false, showBand = true }) {
  const T = useT();
  const chartTip = makeChartTip(T);
  const [showTable, setShowTable] = useState(true);
  const startYear = detailedData[0]?.year || 2026;
  const augmentedData = detailedData.map((row) => ({
    ...row,
    realCapital: inflationRate > 0
      ? Math.round(row.capital / Math.pow(1 + inflationRate, row.year - startYear))
      : undefined,
  }));

  // Échelle logarithmique : sur 20-30 ans, un rendement à 25-30 %/an multiplie le
  // capital par ×100 ou plus — en linéaire, les 20 premières années sont écrasées
  // à 0. En log, chaque graduation = capital ×10, et la courbe reste lisible
  // sur toute la période (cf. Math.log10, déjà utilisé pour l'historique BTC/ETH).
  let logData, logYMin, logYMax, logYTicks;
  // Bande d'incertitude pess/opt présente ? (séries fvBandSeries)
  const hasBand = showBand && augmentedData.length > 0 && augmentedData[0].capPess != null;
  const lg = (v) => (v > 1 ? +Math.log10(v).toFixed(3) : 0);

  if (logScale) {
    logData = augmentedData.map((row) => ({
      ...row,
      logCapital: row.capital > 1 ? +Math.log10(row.capital).toFixed(3) : 0,
      logApports: row.apports > 1 ? +Math.log10(row.apports).toFixed(3) : 0,
      logReal: row.realCapital > 1 ? +Math.log10(row.realCapital).toFixed(3) : undefined,
      logRange: hasBand ? [lg(row.capPess), lg(row.capOpt)] : undefined,
    }));
    const allPositive = augmentedData.flatMap((r) => [r.capital, r.apports, r.capPess, r.capOpt])
      .filter((v) => v != null && v > 1);
    logYMin = Math.floor(Math.log10(Math.min(...allPositive)));
    logYMax = Math.ceil(Math.log10(Math.max(...allPositive)));
    logYTicks = Array.from({ length: logYMax - logYMin + 1 }, (_, i) => logYMin + i);
  }

  return (
    <Card style={{ borderColor: accent + "33" }}>
      {warning && (
        <div className="rounded-xl p-4 mb-5 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.45)" }}>
          <div className="font-bold mb-2" style={{ color: "#ef4444" }}>{warning.title}</div>
          <ul className="space-y-1 mb-3" style={{ color: "#fca5a5" }}>
            {warning.points.map((p) => <li key={p}>· {p}</li>)}
          </ul>
          <p className="text-xs italic" style={{ color: "#f87171" }}>{warning.disclaimer}</p>
        </div>
      )}
      {riskBadges && (
        <div className="flex flex-wrap gap-2 mb-4">
          {riskBadges.map((b) => (
            <span key={b.label} className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}55` }}>
              {b.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-3 mb-5">
        <h2 className="text-xl font-bold" style={{ color: T.text }}>{title}</h2>
        <span className="text-sm" style={{ color: T.muted }}>{rate}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm" style={{ color: T.muted }}>{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5 mb-3 flex-wrap">
        {logScale ? (
          <>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
              <span className="inline-block w-7 border-t-2" style={{ borderColor: lineColor }} />
              Scénario médian
            </span>
            {hasBand && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
                <span className="inline-block w-7 h-3 rounded-sm" style={{ background: lineColor, opacity: 0.18 }} />
                Fourchette pessimiste → optimiste
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
              <span className="inline-block w-7 border-t border-dashed" style={{ borderColor: "#3b82f6" }} />
              Apports cumulés
            </span>
            {inflationRate > 0 && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
                <span className="inline-block w-7" style={{ borderTop: "1.5px dashed #ef4444" }} />
                Valeur réelle
              </span>
            )}
            <Badge tone="neutral" label="Échelle logarithmique — chaque graduation = ×10" />
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
              <span className="inline-block w-7 border-t border-dashed" style={{ borderColor: "#3b82f6" }} />
              Apports cumulés
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
              <span className="inline-block w-7 border-t-2" style={{ borderColor: lineColor }} />
              Gains composés
            </span>
            {hasBand && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
                <span className="inline-block w-7 h-3 rounded-sm" style={{ background: lineColor, opacity: 0.18 }} />
                Fourchette pess. → opt.
              </span>
            )}
            {inflationRate > 0 && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
                <span className="inline-block w-7" style={{ borderTop: "1.5px dashed #ef4444" }} />
                Valeur réelle
              </span>
            )}
            <span className="text-xs" style={{ color: T.muted }}>— Hauteur totale = Capital médian</span>
          </>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {logScale ? (
          <ComposedChart data={logData}>
            <defs>
              <linearGradient id={`gG${chartKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.45} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval={0} />
            <YAxis domain={[logYMin, logYMax]} ticks={logYTicks} stroke={T.muted} tick={{ fontSize: 12 }}
              tickFormatter={logFmt} width={64} />
            <Tooltip {...chartTip}
              formatter={(v, name, props) => {
                const key = props.dataKey;
                const raw = key === "logCapital" ? props.payload.capital
                  : key === "logApports" ? props.payload.apports
                  : props.payload.realCapital;
                return [eur(raw), name];
              }}
              labelFormatter={(y) => `Année ${y}`} />
            {hasBand && (
              <Area type="monotone" dataKey="logRange" name="Fourchette pess. → opt." legendType="none"
                stroke="none" fill={lineColor} fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
            )}
            <Area type="monotone" dataKey="logCapital" name="Capital total"
              stroke={lineColor} strokeWidth={2.5} fill={`url(#gG${chartKey})`} />
            <Line type="monotone" dataKey="logApports" name="Apports cumulés"
              stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            {inflationRate > 0 && (
              <Line type="monotone" dataKey="logReal"
                name={`Valeur réelle (−${(inflationRate * 100).toFixed(0)} % inflation / an)`}
                stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
            )}
          </ComposedChart>
        ) : (
          <ComposedChart data={augmentedData}>
            <defs>
              <linearGradient id={`gA${chartKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.12} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id={`gG${chartKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.52} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.12} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval={0} />
            <YAxis stroke={T.muted} tick={{ fontSize: 12 }}
              tickFormatter={(v) => (v >= 1000 ? Math.round(v / 1000) + "k€" : v)} />
            <Tooltip {...chartTip} formatter={(v) => eur(v)} labelFormatter={(y) => `Année ${y}`} />
            {hasBand && (
              <Area type="monotone" dataKey="range" name="Fourchette pess. → opt." legendType="none"
                stroke="none" fill={lineColor} fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
            )}
            <Area type="monotone" dataKey="apports" name="Apports cumulés" stackId="s"
              stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3"
              fill={`url(#gA${chartKey})`} />
            <Area type="monotone" dataKey="gains" name="Gains composés" stackId="s"
              stroke={lineColor} strokeWidth={2.5}
              fill={`url(#gG${chartKey})`} />
            {inflationRate > 0 && (
              <Line type="monotone" dataKey="realCapital"
                name={`Valeur réelle (−${(inflationRate * 100).toFixed(0)} % inflation / an)`}
                stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
            )}
          </ComposedChart>
        )}
      </ResponsiveContainer>

      <button
        onClick={() => setShowTable((s) => !s)}
        className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ border: `1px solid ${T.border}`, color: T.muted, background: "rgba(255,255,255,0.02)" }}>
        <Activity size={14} />
        {showTable ? "Masquer" : "Voir"} la timeline année par année
      </button>

      {showTable && (
        <div className="mt-3 overflow-y-auto rounded-xl" style={{ maxHeight: 320, border: `1px solid ${T.border}` }}>
          <table className="w-full text-xs">
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: T.panel }}>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Année", "Apports cumulés", "Capital total", "Gains générés", "Variation ann."].map((h) => (
                  <th key={h} className="py-2 px-3 text-left font-semibold" style={{ color: T.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailedData.map((row, idx) => {
                const prevCap = idx > 0 ? detailedData[idx - 1].capital : row.capital;
                const varPct = idx > 0 && prevCap > 0 ? ((row.capital - prevCap) / prevCap) * 100 : 0;
                const yearOffset = row.year - detailedData[0].year;
                const isMilestone = [0, 5, 10, 15, 20, 25, 30].includes(yearOffset);
                return (
                  <tr key={row.year}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      background: isMilestone ? `${lineColor}14` : "transparent",
                    }}>
                    <td className="py-2 px-3 font-semibold" style={{ color: isMilestone ? lineColor : T.text }}>
                      {row.year}{isMilestone && idx > 0 ? " ★" : ""}
                    </td>
                    <td className="py-2 px-3" style={{ color: T.muted }}>{eur(row.apports)}</td>
                    <td className="py-2 px-3 font-bold" style={{ color: lineColor }}>{eur(row.capital)}</td>
                    <td className="py-2 px-3" style={{ color: row.gains >= 0 ? T.green : T.red }}>
                      {row.gains >= 0 ? "+" : ""}{eur(row.gains)}
                    </td>
                    <td className="py-2 px-3" style={{ color: idx === 0 ? T.muted : varPct >= 0 ? T.green : T.red }}>
                      {idx === 0 ? "—" : (varPct > 0 ? "+" : "") + varPct.toFixed(1).replace(".", ",") + " %"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary at horizon */}
      {(() => {
        const last = detailedData[detailedData.length - 1];
        if (!last) return null;
        const years = last.year - startYear;
        const realCap = inflationRate > 0
          ? Math.round(last.capital / Math.pow(1 + inflationRate, years))
          : null;
        const realGains = realCap !== null ? realCap - last.apports : null;
        return (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Capital à l'horizon", value: eur(last.capital), color: lineColor },
                { label: "Vos apports", value: eur(last.apports), color: T.muted },
                { label: "Gains générés", value: "+" + eur(last.gains), color: T.green },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
                  <div className="text-xs mb-1" style={{ color: T.muted }}>{s.label}</div>
                  <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {realCap !== null && (
              <div className="mt-3 rounded-xl p-4"
                style={{ background: "rgba(203,213,225,0.04)", border: "1px solid rgba(203,213,225,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold tracking-wide" style={{ color: "#94a3b8" }}>
                    VALEUR RÉELLE · inflation {(inflationRate * 100).toFixed(1).replace(".", ",")} % / an
                  </span>
                  <span
                    title="Ces montants sont exprimés en euros d'aujourd'hui : ils tiennent compte de l'érosion monétaire liée à l'inflation. Un euro dans 20 ans aura moins de pouvoir d'achat qu'un euro aujourd'hui."
                    className="cursor-help text-xs" style={{ color: "#64748b" }}>ⓘ</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs mb-1" style={{ color: "#94a3b8" }}>Capital réel</div>
                    <div className="text-lg font-bold" style={{ color: "#cbd5e1" }}>{eur(realCap)}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>en € constants d'aujourd'hui</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: "#94a3b8" }}>Gains réels</div>
                    <div className="text-lg font-bold"
                      style={{ color: realGains >= 0 ? "#cbd5e1" : "#ff5a5f" }}>
                      {realGains >= 0 ? "+" : ""}{eur(realGains)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>vs apports en valeur constante</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="rounded-xl p-4 mt-4 text-sm" style={{ background: "rgba(139,92,246,0.04)", color: T.muted }}>
        {note}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURE 1: MODE COUPLE / FAMILLE                                   */
/* ------------------------------------------------------------------ */
function Couple({ transactions, simParams, patrimoine, profile }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);
  const [partnerId, setPartnerId] = useState(null);
  const [goalTarget, setGoalTarget] = useState(500000);
  const [sharedMonthly, setSharedMonthly] = useState(1000);

  const myNetWorth = useMemo(() => {
    const a = patrimoine.actifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    const p = patrimoine.passifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    return a - p;
  }, [patrimoine]);

  const partner = TEST_PROFILES.find((p) => p.id === partnerId);

  const partnerNetWorth = useMemo(() => {
    if (!partner) return 0;
    const a = partner.patrimoine.actifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    const p = partner.patrimoine.passifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    return a - p;
  }, [partner]);

  const combinedNW = myNetWorth + partnerNetWorth;
  const myMonthly = simParams.monthly;
  const partnerMonthly = partner ? partner.simParams.monthly : 0;
  const totalMonthly = myMonthly + partnerMonthly + sharedMonthly;
  const RATE = RATE_A;

  const yearsToGoal = useMemo(() => {
    for (let y = 1; y <= 50; y++) {
      if (fv(combinedNW, totalMonthly, RATE, y) >= goalTarget) return y;
    }
    return null;
  }, [combinedNW, totalMonthly, goalTarget]);

  const progressPct = Math.min(100, Math.round((combinedNW / goalTarget) * 100));
  const horizonY = Math.min(yearsToGoal || 20, 20);

  const projSeries = useMemo(() => Array.from({ length: horizonY + 1 }, (_, y) => ({
    year: 2026 + y,
    Ensemble: Math.round(fv(combinedNW, totalMonthly, RATE, y)),
    Séparément: partner
      ? Math.round(fv(myNetWorth, myMonthly, RATE, y) + fv(partnerNetWorth, partnerMonthly, RATE, y))
      : null,
  })), [combinedNW, totalMonthly, myNetWorth, partnerNetWorth, myMonthly, partnerMonthly, horizonY, partner]);

  const last = projSeries[projSeries.length - 1] || {};
  const synergyBonus = partner ? (last.Ensemble || 0) - (last.Séparément || 0) : 0;

  const milestones = [100000, 250000, 500000, 750000, 1000000].map((target) => {
    if (combinedNW >= target) return { target, status: "done" };
    let yr = null;
    for (let y = 1; y <= 50; y++) {
      if (fv(combinedNW, totalMonthly, RATE, y) >= target) { yr = y; break; }
    }
    return { target, status: "pending", years: yr };
  }).filter((m) => m.target >= combinedNW * 0.4 || m.status === "done");

  const myName = profile.firstName || "Moi";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: T.text }}>Mode Couple / Famille</h1>
        <p style={{ color: T.muted }}>Fusionnez vos patrimoines et planifiez ensemble.</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Choisir un partenaire</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEST_PROFILES.map((p) => (
            <button key={p.id} onClick={() => setPartnerId(partnerId === p.id ? null : p.id)}
              className="flex items-center gap-3 p-4 rounded-xl text-left transition"
              style={{ border: `1px solid ${partnerId === p.id ? T.blue : T.border}`, background: partnerId === p.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: "rgba(91,141,239,0.15)", color: T.blue }}>
                {p.profile.firstName[0]}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: T.text }}>{p.profile.firstName}</div>
                <div className="text-xs truncate" style={{ color: T.muted }}>{p.label}</div>
              </div>
              {partnerId === p.id && <Check size={14} className="ml-auto shrink-0" style={{ color: T.blue }} />}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-4" style={{ color: T.muted, letterSpacing: 1 }}>PATRIMOINES COMBINÉS</div>
        <div className="space-y-2 mb-5">
          <div className="flex justify-between"><span className="text-sm" style={{ color: T.muted }}>{myName}</span><span className="font-bold" style={{ color: T.cyan }}>{eur(myNetWorth)}</span></div>
          {partner && <div className="flex justify-between"><span className="text-sm" style={{ color: T.muted }}>{partner.profile.firstName}</span><span className="font-bold" style={{ color: T.green }}>{eur(partnerNetWorth)}</span></div>}
          <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
            <span className="font-semibold" style={{ color: T.text }}>Total combiné</span>
            <span className="text-2xl font-bold" style={{ color: T.blue }}>{eur(combinedNW)}</span>
          </div>
        </div>

        <div className="text-xs font-semibold mb-3 mt-5" style={{ color: T.muted, letterSpacing: 1 }}>OBJECTIF COMMUN</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Capital cible (€)">
            <input type="number" value={goalTarget} style={inputStyle} onChange={(e) => setGoalTarget(+e.target.value || 0)} />
          </Field>
          <Field label="Épargne commune supplémentaire (€/mois)">
            <input type="number" value={sharedMonthly} style={inputStyle} onChange={(e) => setSharedMonthly(+e.target.value || 0)} />
          </Field>
        </div>

        <div className="flex justify-between items-center mb-1 text-sm">
          <span style={{ color: T.muted }}>Progression</span>
          <span className="font-bold" style={{ color: T.blue }}>{progressPct} %</span>
        </div>
        <div className="rounded-full h-3 mb-1" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="rounded-full h-3 transition-all" style={{ width: progressPct + "%", background: `linear-gradient(90deg,${T.blue},${T.cyan})` }} />
        </div>
        <div className="flex justify-between text-xs mb-4" style={{ color: T.muted }}><span>{eur(combinedNW)}</span><span>{eur(goalTarget)}</span></div>

        {yearsToGoal !== null && (
          <div className="rounded-xl p-4 text-center" style={{ background: "rgba(139,92,246,0.08)", border: `1px solid ${T.blue}44` }}>
            <div className="text-sm mb-1" style={{ color: T.muted }}>Objectif atteint en</div>
            <div className="text-4xl font-bold" style={{ color: T.blue }}>{yearsToGoal} ans</div>
            <div className="text-xs mt-1" style={{ color: T.muted }}>À l'horizon {2026 + yearsToGoal} · {eur(goalTarget)}</div>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-4" style={{ color: T.muted, letterSpacing: 1 }}>MILESTONES</div>
        <div className="space-y-2">
          {milestones.map((m) => (
            <div key={m.target} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: m.status === "done" ? "rgba(34,199,154,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: m.status === "done" ? "rgba(39,163,122,0.2)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${m.status === "done" ? T.green : T.muted}` }}>
                {m.status === "done" && <Check size={10} style={{ color: T.green }} />}
              </div>
              <span className="font-bold text-sm" style={{ color: T.text }}>{eur(m.target)}</span>
              <span className="ml-auto text-sm" style={{ color: m.status === "done" ? T.green : T.muted }}>
                {m.status === "done" ? "Déjà atteint" : m.years ? `dans ${m.years} ans · ${2026 + m.years}` : "50+ ans"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {partner && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} style={{ color: T.blue }} />
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Simulation à {horizonY} ans</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={projSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval={0} />
              <YAxis stroke={T.muted} tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + "k€" : v} />
              <Tooltip {...chartTip} formatter={(v) => eur(v)} />
              <Line type="monotone" dataKey="Ensemble" stroke={T.blue} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Séparément" stroke={T.muted} strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Ensemble", value: eur(last.Ensemble || 0), color: T.blue },
              { label: "Séparément", value: eur(last.Séparément || 0), color: T.muted },
              { label: "Bonus synergie", value: "+" + eur(synergyBonus), color: T.green },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
                <div className="text-xs mb-1" style={{ color: T.muted }}>{s.label}</div>
                <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ background: "transparent" }}>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={15} style={{ color: T.muted }} />
          <span className="text-sm font-semibold" style={{ color: T.muted }}>Planification successorale (bientôt disponible)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Testament digital", "Donation au conjoint survivant", "Contrat de mariage"].map((l) => (
            <span key={l} className="px-3 py-1.5 rounded-lg text-xs cursor-default" style={{ border: `1px solid ${T.border}`, color: T.muted }}>{l} →</span>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURE 2: COMPARATEUR ETF / PORTEFEUILLE                          */
/* ------------------------------------------------------------------ */
const ETF_DB = [
  { name: "Vanguard FTSE All-World (VWRL)", ter: 0.22, class: "Actions Monde" },
  { name: "iShares Core MSCI World (IWDA)", ter: 0.20, class: "Actions Monde" },
  { name: "Amundi MSCI World PEA (CW8)", ter: 0.38, class: "Actions Monde" },
  { name: "Lyxor MSCI World PEA (WPEA)", ter: 0.38, class: "Actions Monde" },
  { name: "iShares Core S&P 500 (CSPX)", ter: 0.07, class: "Actions USA" },
  { name: "iShares MSCI World SRI", ter: 0.20, class: "Actions Monde ESG" },
  { name: "iShares Euro Aggregate Bond", ter: 0.10, class: "Obligations €" },
  { name: "Amundi Obligations Euro", ter: 0.45, class: "Obligations €" },
  { name: "iShares MSCI Emerging Markets", ter: 0.18, class: "Marchés émergents" },
  { name: "Lyxor S&P 500 PEA", ter: 0.15, class: "Actions USA" },
];

const DEFAULT_PORTFOLIO = [
  { id: 1, name: "Lyxor MSCI World PEA (WPEA)", amount: 40000, ter: 0.38 },
  { id: 2, name: "iShares Core S&P 500 (CSPX)", amount: 12000, ter: 0.07 },
  { id: 3, name: "Amundi Obligations Euro", amount: 8000, ter: 0.45 },
];

function Portefeuille() {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const [positions, setPositions] = useLocalStorage("wt_portfolio", DEFAULT_PORTFOLIO);
  const [nextId, setNextId] = useLocalStorage("wt_portfolio_next_id", 4);

  const totalAmount = positions.reduce((s, p) => s + (p.amount || 0), 0);
  const weightedTER = totalAmount > 0 ? positions.reduce((s, p) => s + (p.amount || 0) * (p.ter || 0), 0) / totalAmount : 0;
  const annualFees = Math.round(positions.reduce((s, p) => s + (p.amount || 0) * (p.ter || 0) / 100, 0));
  const BENCHMARK = 0.22;
  const surCostEur = Math.max(0, Math.round(totalAmount * (weightedTER - BENCHMARK) / 100));

  const feeImpact20y = (savingsAnnual) => {
    let total = 0;
    for (let y = 1; y <= 20; y++) total += savingsAnnual * Math.pow(1 + RATE_A, 20 - y);
    return Math.round(total);
  };

  const recommendations = positions
    .filter((p) => p.ter > 0.30)
    .map((p) => {
      const isOblig = p.name.toLowerCase().includes("obligation");
      const alt = ETF_DB.find((e) => (isOblig ? e.class === "Obligations €" : e.class === "Actions Monde") && e.ter < p.ter);
      if (!alt) return null;
      const savingsAnnual = Math.round((p.amount || 0) * (p.ter - alt.ter) / 100);
      return { position: p, alt, savingsAnnual, savings20y: feeImpact20y(savingsAnnual) };
    }).filter(Boolean);

  const totalSavings20y = recommendations.reduce((s, r) => s + r.savings20y, 0);
  const terColor = (t) => t > 0.40 ? T.red : t > 0.25 ? T.amber : T.green;

  const addPosition = () => {
    setPositions((ps) => [...ps, { id: nextId, name: ETF_DB[0].name, amount: 5000, ter: ETF_DB[0].ter }]);
    setNextId((n) => n + 1);
  };
  const updatePos = (id, field, value) => setPositions((ps) => ps.map((p) => {
    if (p.id !== id) return p;
    if (field === "name") { const e = ETF_DB.find((e) => e.name === value); return { ...p, name: value, ter: e ? e.ter : p.ter }; }
    return { ...p, [field]: value };
  }));
  const removePos = (id) => setPositions((ps) => ps.filter((p) => p.id !== id));

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: T.text }}>Comparateur ETF & Frais</h1>
        <p style={{ color: T.muted }}>Analysez vos TER, comparez au marché et optimisez vos frais sur 20 ans.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Mes positions</h2>
          <button onClick={addPosition} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: "rgba(139,92,246,0.15)", color: T.blue, border: `1px solid ${T.blue}44` }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="space-y-3">
          {positions.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: `1px dashed ${T.border}` }}>
              <p className="text-sm mb-3" style={{ color: T.muted }}>Aucune position. Ajoutez votre premier ETF.</p>
              <button onClick={addPosition} className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "rgba(139,92,246,0.15)", color: T.blue, border: `1px solid ${T.blue}44` }}>
                <Plus size={13} style={{ display: "inline", marginRight: 4 }} />Ajouter une position
              </button>
            </div>
          )}
          {positions.map((pos) => (
            <div key={pos.id} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: T.muted }}>ETF</label>
                  <select value={pos.name} style={inputStyle} onChange={(e) => updatePos(pos.id, "name", e.target.value)}>
                    {ETF_DB.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: T.muted }}>Montant (€)</label>
                  <input type="number" value={pos.amount} style={inputStyle} onChange={(e) => updatePos(pos.id, "amount", +e.target.value || 0)} />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-xl px-3 py-2.5 font-bold text-sm"
                    style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${terColor(pos.ter)}44`, color: terColor(pos.ter) }}>
                    TER {pos.ter.toFixed(2)} %
                  </div>
                  <button onClick={() => removePos(pos.id)} aria-label="Supprimer la position" className="rounded-lg p-2.5"
                    style={{ color: T.red, border: `1px solid ${T.border}` }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-xs" style={{ color: T.muted }}>
                <span>Frais/an : <b style={{ color: T.text }}>{eur(Math.round((pos.amount || 0) * pos.ter / 100))}</b></span>
                <span>Poids : <b style={{ color: T.text }}>{totalAmount > 0 ? Math.round((pos.amount || 0) / totalAmount * 100) : 0} %</b></span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-xs font-semibold mb-4" style={{ color: T.muted, letterSpacing: 1 }}>SYNTHÈSE PORTEFEUILLE</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MiniStat label="Actifs totaux" value={eur(totalAmount)} />
          <MiniStat label={<>TER moyen pondéré<InfoTooltip text="TER (Total Expense Ratio) : frais annuels totaux prélevés par le fonds (gestion, dépositaire…), exprimés en % de l'encours. Un TER de 0,20 % = 2 € de frais par an pour 1 000 € investis — ces frais réduisent directement votre rendement net, chaque année, par capitalisation." /></>} value={weightedTER.toFixed(2) + " %"} color={terColor(weightedTER)} />
          <MiniStat label="Frais annuels" value={eur(annualFees)} color={T.amber} />
          <MiniStat label="Surcoût vs VWRL" value={surCostEur > 0 ? "+" + eur(surCostEur) + "/an" : "Optimal"} color={surCostEur > 0 ? T.red : T.green} />
        </div>
        <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(139,92,246,0.04)", border: `1px solid ${T.border}` }}>
          <span style={{ color: T.muted }}>Benchmark Vanguard FTSE All-World (0,22 %) · votre TER pondéré est </span>
          <span style={{ color: weightedTER > BENCHMARK ? T.amber : T.green }}>
            {weightedTER > BENCHMARK ? `+${(weightedTER - BENCHMARK).toFixed(2)} %` : "sous le benchmark"} de plus
          </span>
        </div>
      </Card>

      {recommendations.length > 0 && (
        <Card style={{ borderColor: "rgba(245,166,35,0.3)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} style={{ color: T.amber }} />
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Optimisations recommandées</h2>
          </div>
          <div className="space-y-3 mb-4">
            {recommendations.map((r, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.25)" }}>
                <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
                  <div>
                    <span className="text-xs font-bold tracking-wide" style={{ color: T.amber }}>REMPLACER</span>
                    <div className="font-semibold text-sm mt-0.5" style={{ color: T.text }}>
                      {r.position.name} ({r.position.ter} %) → {r.alt.name} ({r.alt.ter} %)
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs" style={{ color: T.muted }}>Gain sur 20 ans</div>
                    <div className="font-bold" style={{ color: T.green }}>+{eur(r.savings20y)}</div>
                  </div>
                </div>
                <div className="text-xs" style={{ color: T.muted }}>
                  Montant : {eur(r.position.amount)} · Économies/an : {eur(r.savingsAnnual)}
                </div>
              </div>
            ))}
          </div>
          {totalSavings20y > 0 && (
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(34,199,154,0.06)", border: "1px solid rgba(34,199,154,0.3)" }}>
              <div className="text-sm mb-1" style={{ color: T.muted }}>Impact total des optimisations (20 ans)</div>
              <div className="text-3xl font-bold" style={{ color: T.green }}>+{eur(totalSavings20y)}</div>
              <div className="text-xs mt-1" style={{ color: T.muted }}>en capital supplémentaire grâce aux frais réduits</div>
            </div>
          )}
        </Card>
      )}

      {recommendations.length === 0 && (
        <Card style={{ borderColor: "rgba(34,199,154,0.3)" }}>
          <div className="flex items-center gap-2">
            <Check size={18} style={{ color: T.green }} />
            <span className="font-semibold" style={{ color: T.green }}>Portefeuille optimisé !</span>
            <span className="text-sm" style={{ color: T.muted }}>Tous vos TER sont en dessous de 0,30 %.</span>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Taux moyens indicatifs de taxe foncière (commune + intercommunalité)
    par département — ordres de grandeur 2023-2024 pour estimation
    rapide, à vérifier sur l'avis de taxe foncière du bien. */
const TAUX_TF_PAR_DEPT = {
  "75": 13.5,                                   // Paris — taux historiquement très bas
  "92": 22, "93": 28, "94": 24,                 // Petite couronne
  "77": 30, "78": 26, "91": 32, "95": 33,       // Grande couronne
  "69": 38, "13": 44, "31": 42, "33": 41,       // Lyon, Marseille, Toulouse, Bordeaux
  "44": 40, "59": 46, "67": 36, "34": 43,       // Nantes, Lille, Strasbourg, Montpellier
  "35": 40, "06": 30, "38": 41, "76": 45,       // Rennes, Nice, Grenoble, Rouen
};
const TAUX_TF_DEFAUT = 46; // moyenne nationale indicative pour les départements non listés

/* ------------------------------------------------------------------ */
/*  Mon crédit immobilier — rembourser par anticipation OU investir ?  */
/* ------------------------------------------------------------------ */
const FISCALITE_OPTIONS = [
  ["pea",    "PEA (après 5 ans)",      0],
  ["av",     "Assurance-vie (>8 ans)", 0.172],
  ["cto",    "CTO / Crypto (PFU 30 %)", 0.30],
];

function CreditArbitrage({ initial } = {}) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);

  const [remaining, setRemaining]   = useState(initial?.remaining ?? 150000); // capital restant dû
  const [ratePct, setRatePct]       = useState(initial?.ratePct   ?? 1.5);    // taux nominal
  const [insurance, setInsurance]   = useState(initial?.insurance ?? 30);     // assurance €/mois
  const [yearsLeft, setYearsLeft]   = useState(initial?.yearsLeft ?? 15);     // durée restante (ans)
  const [lumpSum, setLumpSum]       = useState(50000);  // épargne dispo
  const [returnPct, setReturnPct]   = useState(7);      // rendement placement
  const [envelope, setEnvelope]     = useState("pea");  // fiscalité

  const taxRate = FISCALITE_OPTIONS.find(o => o[0] === envelope)?.[2] ?? 0;

  const opts = {
    remainingPrincipal: Math.max(0, remaining),
    annualRate: ratePct / 100,
    insuranceMonthly: Math.max(0, insurance),
    remainingMonths: Math.max(1, Math.round(yearsLeft * 12)),
    lumpSum: Math.max(0, lumpSum),
    investReturn: returnPct / 100,
    taxRate,
  };

  const r          = useMemo(() => repayVsInvest(opts), [remaining, ratePct, insurance, yearsLeft, lumpSum, returnPct, taxRate]);
  const breakeven  = useMemo(() => breakevenInvestRate(opts), [remaining, ratePct, insurance, yearsLeft, lumpSum, taxRate]);
  const series     = useMemo(() => repayVsInvestSeries(opts), [remaining, ratePct, insurance, yearsLeft, lumpSum, returnPct, taxRate]);

  const keepWins = r.winner === "keep";
  const accent   = keepWins ? T.green : T.amber;

  const Num = ({ label, val, color }) => (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: color || T.text, fontWeight: 800, fontSize: 18 }}>{val}</div>
    </div>
  );

  return (
    <>
      {/* Saisie du prêt */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Home size={20} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Mon crédit immobilier</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Field label="Capital restant dû (€)">
            <input type="number" min={0} value={remaining} onChange={e => setRemaining(Math.max(0, +e.target.value || 0))} style={inputStyle} />
          </Field>
          <Field label="Taux du prêt (%)">
            <input type="number" step="0.1" min={0} value={ratePct} onChange={e => setRatePct(Math.max(0, +e.target.value || 0))} style={inputStyle} />
          </Field>
          <Field label="Assurance (€/mois)">
            <input type="number" min={0} value={insurance} onChange={e => setInsurance(Math.max(0, +e.target.value || 0))} style={inputStyle} />
          </Field>
          <Field label="Durée restante (ans)">
            <input type="number" step="1" min={1} value={yearsLeft} onChange={e => setYearsLeft(Math.max(1, +e.target.value || 1))} style={inputStyle} />
          </Field>
          <Field label="Épargne dispo (€)">
            <input type="number" min={0} value={lumpSum} onChange={e => setLumpSum(Math.max(0, +e.target.value || 0))} style={inputStyle} />
          </Field>
          <Field label="Rendement visé (%/an)">
            <input type="number" step="0.5" min={0} value={returnPct} onChange={e => setReturnPct(Math.max(0, +e.target.value || 0))} style={inputStyle} />
          </Field>
          <Field label="Fiscalité">
            <select value={envelope} onChange={e => setEnvelope(e.target.value)} style={inputStyle}>
              {FISCALITE_OPTIONS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {/* Verdict */}
      <Card style={{ borderColor: accent + "55", background: accent + "0d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {keepWins ? <TrendingUp size={22} style={{ color: accent }} /> : <PiggyBank size={22} style={{ color: accent }} />}
          <h2 className="text-xl font-bold" style={{ color: accent }}>
            {keepWins ? "Gardez votre prêt et investissez" : "Remboursez par anticipation"}
          </h2>
        </div>
        <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          {keepWins
            ? `Au rendement visé (${returnPct} %/an net), placer votre épargne rapporte plus que les intérêts économisés. Vous gardez votre capacité d'investissement.`
            : `Au rendement visé (${returnPct} %/an net), rembourser fait gagner plus que le placement — le coût du crédit est trop élevé.`}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Num label={`Patrimoine si vous GARDEZ (dans ${Math.round(yearsLeft)} ans)`} val={eur(r.keepWealth)} color={keepWins ? accent : T.text} />
          <Num label={`Patrimoine si vous REMBOURSEZ (dans ${Math.round(yearsLeft)} ans)`} val={eur(r.repayWealth)} color={!keepWins ? accent : T.text} />
          <Num label="Écart en faveur du meilleur choix" val={eur(Math.abs(r.diff))} color={accent} />
        </div>
      </Card>

      {/* Détails */}
      <Card>
        <h3 className="text-lg font-bold mb-4" style={{ color: T.text }}>Détails du calcul</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
          <Num label="Mensualité actuelle (assurance incl.)" val={eur(r.monthlyDebt)} />
          <Num label="Indemnités remb. anticipé (IRA)" val={eur(r.ira)} color={T.amber} />
          <Num label="Intérêts économisés en remboursant" val={eur(r.interestSaved)} />
          <Num label="Mensualité libérée → investie" val={eur(r.freedMonthly)} />
        </div>
        <div style={{ background: "rgba(91,141,239,0.06)", border: `1px solid ${T.blue}33`, borderRadius: 12, padding: "12px 16px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          {breakeven == null
            ? <>Même à 0 % de rendement, rembourser ce prêt est gagnant : son taux est élevé.</>
            : <>Seuil de bascule : au-dessus de <b style={{ color: T.text }}>{(breakeven * 100).toFixed(1)} %/an net</b> de rendement, garder le prêt devient plus rentable que rembourser.</>}
        </div>
      </Card>

      {/* Graphe comparatif */}
      <Card>
        <h3 className="text-lg font-bold mb-4" style={{ color: T.text }}>Patrimoine projeté : garder vs rembourser</h3>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: T.muted }} />
              <YAxis tickFormatter={v => `${Math.round(v / 1000)} k€`} tick={{ fontSize: 12, fill: T.muted }} width={48} />
              <Tooltip {...chartTip} formatter={(v, n) => [eur(v), n === "keep" ? "Garder + investir" : "Rembourser"]} />
              <Legend formatter={v => v === "keep" ? "Garder + investir" : "Rembourser + investir mensualité"} />
              <Line type="monotone" dataKey="keep" stroke={T.green} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="repay" stroke={T.amber} strokeWidth={2.5} strokeDasharray="6 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: T.muted }}>
          <AlertTriangle size={12} style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>Estimation pédagogique. Hypothèses : rendement net constant, IRA plafonnée légalement, fiscalité appliquée aux plus-values à la sortie. Ne constitue pas un conseil en investissement.</span>
        </p>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  MES CRÉDITS — suivi des crédits & prêts en cours                   */
/* ------------------------------------------------------------------ */
/** Largeur réelle d'un élément, suivie via ResizeObserver. */
function useElementWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const CREDIT_TYPES = {
  immo:      { label: "Immobilier",   color: "#5b8def", Icon: Building2 },
  auto:      { label: "Auto",         color: "#22c79a", Icon: Car },
  conso:     { label: "Consommation", color: "#f5a623", Icon: CreditCard },
  etudiant:  { label: "Étudiant",     color: "#a855f7", Icon: GraduationCap },
  perso:     { label: "Personnel",    color: "#06b6d4", Icon: Wallet },
  revolving: { label: "Revolving",    color: "#ef4444", Icon: Repeat },
};
const REVOLVING_ALERT_RATE = 15; // % — au-delà, on signale le coût d'un crédit revolving

function emptyCredit() {
  return {
    id: null, type: "immo", mode: "amortissable", label: "",
    capitalInitial: 100000, taux: 3.5, dureeMois: 240,
    dateDebut: new Date().toISOString().slice(0, 10), assuranceMensuelle: 0,
    capitalRembourse: 0, capitalRestant: 0, paiementMensuel: 0,
  };
}

/** Durée en mois → "X ans Y mois" lisible. */
function fmtDuree(months) {
  const m = Math.max(0, Math.round(months));
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return `${r} mois`;
  if (r === 0) return `${y} an${y > 1 ? "s" : ""}`;
  return `${y} an${y > 1 ? "s" : ""} ${r} mois`;
}

function CreditForm({ credit, onSave, onCancel }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const [c, setC] = useState(credit);
  // Saisies numériques bornées (jamais négatives ; durée ≥ 1 mois).
  const setNum = (k, v, { min = 0 } = {}) => setC((p) => ({ ...p, [k]: Math.max(min, +v || 0) }));
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const isRevolving = c.mode === "revolving";
  // capitalRembourse ne peut pas dépasser le capital emprunté.
  const rembourseMax = Math.max(0, +c.capitalInitial || 0);
  const rembourseTrop = (+c.capitalRembourse || 0) > rembourseMax;

  // Le revolving force le mode revolving ; les autres types restent amortissables.
  const onType = (type) => setC((p) => ({ ...p, type, mode: type === "revolving" ? "revolving" : "amortissable" }));

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Pencil size={18} style={{ color: T.blue }} />
        <h2 className="text-xl font-bold" style={{ color: T.text }}>{credit.id ? "Modifier le crédit" : "Nouveau crédit"}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Type de crédit">
          <select value={c.type} style={inputStyle} onChange={(e) => onType(e.target.value)}>
            {Object.entries(CREDIT_TYPES).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Libellé">
          <input type="text" value={c.label} placeholder={CREDIT_TYPES[c.type]?.label} style={inputStyle}
            onChange={(e) => set("label", e.target.value)} />
        </Field>
        <Field label="Taux (% / an)">
          <input type="number" step={0.1} min={0} value={c.taux} style={inputStyle} onChange={(e) => setNum("taux", e.target.value)} />
        </Field>

        {isRevolving ? (
          <>
            <Field label="Capital restant dû (€)">
              <input type="number" min={0} value={c.capitalRestant} style={inputStyle} onChange={(e) => setNum("capitalRestant", e.target.value)} />
            </Field>
            <Field label="Paiement mensuel (€)">
              <input type="number" min={0} value={c.paiementMensuel} style={inputStyle} onChange={(e) => setNum("paiementMensuel", e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Capital emprunté (€)">
              <input type="number" min={0} value={c.capitalInitial} style={inputStyle} onChange={(e) => setNum("capitalInitial", e.target.value)} />
            </Field>
            <Field label="Durée totale (mois)">
              <input type="number" min={1} value={c.dureeMois} style={inputStyle} onChange={(e) => setNum("dureeMois", e.target.value, { min: 1 })} />
            </Field>
            <Field label="Date de début">
              <input type="date" value={c.dateDebut} style={inputStyle} onChange={(e) => set("dateDebut", e.target.value)} />
            </Field>
            <Field label="Assurance (€ / mois)">
              <input type="number" min={0} value={c.assuranceMensuelle} style={inputStyle} onChange={(e) => setNum("assuranceMensuelle", e.target.value)} />
            </Field>
            <Field label={<>Capital déjà remboursé (€)<InfoTooltip text="Optionnel. Si vous le renseignez, le capital restant et l'échéance sont calculés à partir de ce montant (pas besoin d'une date de début exacte). Laissez à 0 pour un calcul automatique depuis la date de début." /></>}>
              <input type="number" min={0} max={rembourseMax} value={c.capitalRembourse} style={{ ...inputStyle, borderColor: rembourseTrop ? T.red : inputStyle.border }} onChange={(e) => setNum("capitalRembourse", e.target.value)} />
              {rembourseTrop && <span className="text-xs" style={{ color: T.red }}>Ne peut pas dépasser le capital emprunté ({eur(rembourseMax)}).</span>}
            </Field>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onSave({ ...c, label: c.label || CREDIT_TYPES[c.type]?.label })}
          disabled={rembourseTrop}
          className="px-4 py-2 rounded-xl font-semibold text-sm"
          style={{ background: T.blue, color: "#fff", border: "none", cursor: rembourseTrop ? "not-allowed" : "pointer", opacity: rembourseTrop ? 0.5 : 1 }}>
          Enregistrer
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl font-semibold text-sm"
          style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </Card>
  );
}

function CreditCardItem({ credit, now, onEdit, onDelete, onArbitrage }) {
  const T = useT();
  const meta = CREDIT_TYPES[credit.type] || CREDIT_TYPES.perso;
  const { Icon } = meta;
  const restant = creditCapitalRestant(credit, now);
  const pmtPI = creditMensualite(credit);
  const assurance = +credit.assuranceMensuelle || 0;
  const mensualite = pmtPI + assurance;
  const dateFin = creditDateFin(credit, now);
  const isRevolving = credit.mode === "revolving";
  const coutTotal = creditCoutTotal(credit);
  const remboursé = Math.max(0, (+credit.capitalInitial || 0) - restant);
  const moisRestants = isRevolving ? null : creditRemainingMonths(credit, now);
  const progress = !isRevolving && credit.capitalInitial > 0
    ? Math.min(100, Math.max(0, (remboursé / credit.capitalInitial) * 100))
    : null;
  const soldé = !isRevolving && restant <= 0;
  const revolvingAlert = isRevolving && (+credit.taux || 0) >= REVOLVING_ALERT_RATE;
  const revolvingStuck = creditRevolvingStuck(credit);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.color}1a`, border: `1px solid ${meta.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} style={{ color: meta.color }} />
          </span>
          <div>
            <div className="font-bold flex items-center gap-2" style={{ color: T.text }}>
              {credit.label || meta.label}
              {soldé && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${T.green}1a`, color: T.green, fontWeight: 700 }}>Soldé</span>}
            </div>
            <div className="text-xs" style={{ color: T.muted }}>{meta.label} · {credit.taux} %/an</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {credit.type === "immo" && !isRevolving && !soldé && (
            <button onClick={() => onArbitrage(credit)} title="Rembourser ou investir ?"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(91,141,239,0.12)", color: T.blue, border: `1px solid ${T.blue}44`, cursor: "pointer" }}>
              Rembourser ou investir ?
            </button>
          )}
          <button onClick={() => onEdit(credit)} aria-label="Modifier"
            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 10, minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted }}>
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(credit)} aria-label="Supprimer"
            style={{ background: "none", border: "1px solid rgba(255,90,95,0.3)", borderRadius: 10, minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.red }}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <MiniStat label="Capital restant" value={eur(Math.round(restant))} color={T.text} />
        <MiniStat label={assurance > 0 ? "Mensualité (assur. incl.)" : "Mensualité"} value={eur(Math.round(mensualite))} color={T.amber} />
        <MiniStat label={isRevolving ? "Intérêts / mois" : "Intérêts restants"}
          value={eur(Math.round(creditInteretsRestants(credit, now)))} color={T.red} />
        <MiniStat label="Échéance"
          value={isRevolving ? "—" : (moisRestants > 0 ? fmtDuree(moisRestants) : "Soldé")}
          color={T.muted} />
      </div>

      {/* Détails secondaires */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs" style={{ color: T.muted }}>
        {!isRevolving && <span>Capital remboursé : <b style={{ color: T.text }}>{eur(Math.round(remboursé))}</b></span>}
        {assurance > 0 && <span>Dont assurance : <b style={{ color: T.text }}>{eur(Math.round(assurance))}/mois</b></span>}
        {coutTotal != null && <span>Coût total du crédit : <b style={{ color: T.text }}>{eur(Math.round(coutTotal))}</b> d'intérêts</span>}
        {!isRevolving && dateFin && <span>Fin : <b style={{ color: T.text }}>{dateFin.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b></span>}
      </div>

      {progress != null && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1" style={{ color: T.muted }}>
            <span>Remboursé</span><span>{progress.toFixed(0)} %</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: meta.color, borderRadius: 999 }} />
          </div>
        </div>
      )}

      {revolvingStuck && (
        <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: T.red }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>Votre paiement mensuel ne couvre pas les intérêts ({eur(Math.round(restant * (+credit.taux || 0) / 100 / 12))}/mois) : cette dette ne se rembourse jamais. Augmentez le paiement.</span>
        </p>
      )}
      {revolvingAlert && !revolvingStuck && (
        <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: T.red }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>Taux revolving élevé ({credit.taux} %). Privilégiez son remboursement avant tout placement.</span>
        </p>
      )}
    </Card>
  );
}

function Credits({ credits, setCredits, monthlyIncome = 0, incomeIsSmoothed = false, setView }) {
  const T = useT();
  const chartTip = makeChartTip(T);
  const now = new Date();
  const [editing, setEditing] = useState(null);   // crédit en cours d'édition/ajout
  const [arbitrage, setArbitrage] = useState(null); // crédit immo pour l'outil rembourser/investir

  // Largeur réelle mesurée (ResizeObserver) → dimensions explicites pour Recharts.
  // Évite le ResponsiveContainer qui se mesure à 0 selon le timing de layout.
  const [pieRef, pieW] = useElementWidth();
  const [areaRef, areaW] = useElementWidth();

  const active = credits;

  const totalRestant = active.reduce((s, c) => s + creditCapitalRestant(c, now), 0);
  const totalMensualite = active.reduce((s, c) => s + creditMensualite(c) + (+c.assuranceMensuelle || 0), 0);
  // « Intérêts restants » = intérêts encore à payer sur les crédits amortissables.
  // (Le revolving n'a pas d'échéance fixe → exclu de ce cumul, son coût mensuel
  // apparaît sur sa carte.)
  const totalInterets = active.reduce((s, c) => s + (c.mode === "revolving" ? 0 : creditInteretsRestants(c, now)), 0);
  const debtRatio = monthlyIncome > 0 ? (totalMensualite / monthlyIncome) * 100 : null;
  const debtColor = debtRatio == null ? T.muted : debtRatio > 35 ? T.red : debtRatio > 25 ? T.amber : T.green;

  // Répartition du capital restant par type (donut).
  const typeBreakdown = useMemo(() => {
    const byType = {};
    for (const c of active) {
      const r = creditCapitalRestant(c, now);
      if (r <= 0) continue;
      byType[c.type] = (byType[c.type] || 0) + r;
    }
    return Object.entries(byType).map(([type, value]) => ({
      name: CREDIT_TYPES[type]?.label || type, value: Math.round(value), color: CREDIT_TYPES[type]?.color || T.muted,
    }));
  }, [active]);

  // Trajectoire de désendettement : capital restant total projeté année par année.
  const desendettement = useMemo(() => {
    if (!active.length) return [];
    const maxMonths = Math.min(360, Math.max(12, ...active.map((c) => c.mode === "revolving" ? 120 : Math.ceil(creditRemainingMonths(c, now)))));
    const years = Math.ceil(maxMonths / 12);
    const startY = now.getFullYear();
    const out = [];
    for (let y = 0; y <= years; y++) {
      out.push({ label: String(startY + y), total: Math.round(active.reduce((s, c) => s + creditProjectedRestant(c, y * 12, now), 0)) });
    }
    return out;
  }, [active]);

  // Conseils contextuels selon la situation (niveaux : red > amber > info > good).
  const conseils = useMemo(() => {
    if (!active.length) return [];
    const out = [];
    const stuck = active.filter(creditRevolvingStuck);
    const revolvingChers = active.filter((c) => c.mode === "revolving" && (+c.taux || 0) >= REVOLVING_ALERT_RATE);
    const immoTauxBas = active.filter((c) => c.type === "immo" && c.mode !== "revolving" && (+c.taux || 0) > 0 && (+c.taux || 0) < 3.5 && creditCapitalRestant(c, now) > 0);
    const immoTauxEleve = active.filter((c) => c.type === "immo" && c.mode !== "revolving" && (+c.taux || 0) > 4 && creditCapitalRestant(c, now) > 0);
    const consoAuto = active.filter((c) => (c.type === "conso" || c.type === "auto") && creditCapitalRestant(c, now) > 0);
    const bientotSoldes = active.filter((c) => c.mode !== "revolving" && creditCapitalRestant(c, now) > 0 && creditRemainingMonths(c, now) <= 6);

    if (stuck.length)
      out.push({ level: "red", text: "Un crédit revolving ne se rembourse pas : son paiement mensuel ne couvre même pas les intérêts. Augmentez le paiement pour stopper la spirale." });
    else if (revolvingChers.length)
      out.push({ level: "red", text: `Vous avez ${revolvingChers.length > 1 ? "des crédits revolving" : "un crédit revolving"} à taux élevé. Remboursez-${revolvingChers.length > 1 ? "les" : "le"} en priorité : aucun placement ne rapporte autant que ce taux vous coûte.` });

    if (debtRatio != null && debtRatio > 35)
      out.push({ level: "red", text: `Votre taux d'endettement (${debtRatio.toFixed(0)} %) dépasse le seuil bancaire de 35 %. Évitez tout nouveau crédit et visez à réduire vos mensualités.` });
    else if (debtRatio != null && debtRatio > 25)
      out.push({ level: "amber", text: `Endettement maîtrisé mais notable (${debtRatio.toFixed(0)} %). Gardez de la marge avant d'envisager un nouvel emprunt.` });

    if (consoAuto.length >= 2)
      out.push({ level: "amber", text: "Plusieurs crédits conso/auto en cours : un rachat de crédits (regroupement) peut réduire votre mensualité totale — comparez les offres." });

    if (immoTauxEleve.length)
      out.push({ level: "amber", text: "Crédit immobilier à taux élevé (> 4 %) : une renégociation ou un remboursement anticipé peut être rentable. Utilisez « Rembourser ou investir ? » sur la carte." });
    if (immoTauxBas.length)
      out.push({ level: "info", text: "Crédit immobilier à taux faible (< 3,5 %) : garder le prêt et investir votre épargne est souvent plus rentable que rembourser. Vérifiez via « Rembourser ou investir ? »." });

    if (bientotSoldes.length)
      out.push({ level: "info", text: `${bientotSoldes.length > 1 ? "Des crédits seront soldés" : "Un crédit sera soldé"} d'ici 6 mois : prévoyez de réorienter la mensualité libérée vers votre épargne ou vos investissements.` });

    if (!out.length)
      out.push({ level: "good", text: "Situation saine : endettement maîtrisé, pas de crédit à risque. Continuez ainsi." });

    return out;
  }, [active, debtRatio]);

  const save = (c) => {
    setCredits((prev) => c.id && prev.some((p) => p.id === c.id)
      ? prev.map((p) => (p.id === c.id ? c : p))
      : [...prev, { ...c, id: c.id || Date.now() }]);
    setEditing(null);
  };
  const remove = (credit) => {
    if (typeof window !== "undefined" && !window.confirm(`Supprimer le crédit « ${credit.label || "sans nom"} » ? Cette action est définitive.`)) return;
    setCredits((prev) => prev.filter((p) => p.id !== credit.id));
  };

  const arbitrageInitial = arbitrage ? {
    remaining: Math.round(creditCapitalRestant(arbitrage, now)),
    ratePct: arbitrage.taux,
    insurance: Math.round(+arbitrage.assuranceMensuelle || 0),
    yearsLeft: Math.max(1, Math.round(creditRemainingMonths(arbitrage, now) / 12)),
  } : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>Mes crédits</h1>
          <p style={{ color: T.muted }}>Suivez vos crédits et prêts en cours — ils alimentent vos passifs.</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(emptyCredit())}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold"
            style={{ background: T.gradientPrimary, color: "#fff", border: "none", cursor: "pointer", boxShadow: glow(T.violet, 40, "33"), transition: "transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px) scale(1.015)"; e.currentTarget.style.boxShadow = glow(T.violet, 56, "55"); }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = glow(T.violet, 40, "33"); }}>
            <Plus size={16} /> Ajouter un crédit
          </button>
        )}
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Capital restant dû" value={eur(Math.round(totalRestant))} valueColor={T.red} />
        <KpiCard label="Mensualités / mois" value={eur(Math.round(totalMensualite))} valueColor={T.amber} />
        <KpiCard label="Intérêts restants" value={eur(Math.round(totalInterets))} valueColor={T.muted} />
        <KpiCard label="Taux d'effort (endettement bancaire)"
          value={debtRatio == null ? "—" : `${debtRatio.toFixed(1).replace(".", ",")} %`}
          valueColor={debtColor}
          sub={debtRatio == null
            ? <button onClick={() => setView && setView("finances")} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 0, fontSize: 12 }}>Ajoutez vos revenus dans Finances</button>
            : <span style={{ color: T.muted }}>{incomeIsSmoothed ? "basé sur votre revenu moyen (12 mois) · seuil 35 %" : "mensualités ÷ revenus · seuil 35 %"}</span>} />
      </div>

      {/* Répartition + désendettement */}
      {active.length > 0 && totalRestant > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-xl font-bold mb-2" style={{ color: T.text }}>Répartition par type</h2>
            <div ref={pieRef} style={{ width: "100%", height: 220 }}>
              {pieW > 0 && (
                <PieChart width={pieW} height={220}>
                  <Pie data={typeBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
                    {typeBreakdown.map((s, i) => <Cell key={i} fill={s.color} stroke="none" />)}
                  </Pie>
                </PieChart>
              )}
            </div>
            {/* Légende avec montant + part — pas de survol nécessaire */}
            <div className="flex flex-col gap-1.5 mt-2">
              {typeBreakdown.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2" style={{ color: T.muted }}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span style={{ color: T.text, fontWeight: 600 }}>
                    {eur(s.value)} <span style={{ color: T.muted, fontWeight: 400 }}>· {totalRestant > 0 ? Math.round((s.value / totalRestant) * 100) : 0} %</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-bold mb-2" style={{ color: T.text }}>Trajectoire de désendettement</h2>
            <p className="text-xs mb-3" style={{ color: T.muted }}>Capital restant total projeté, à mensualités constantes.</p>
            <div ref={areaRef} style={{ width: "100%", height: 200 }}>
              {areaW > 0 && (
                <AreaChart width={areaW} height={200} data={desendettement} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 12 }} />
                  <YAxis tick={{ fill: T.muted, fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={42} />
                  <Tooltip {...chartTip} formatter={(v) => eur(v)} />
                  <Area type="monotone" dataKey="total" stroke={T.blue} fill={`${T.blue}22`} strokeWidth={2} />
                </AreaChart>
              )}
            </div>
          </Card>
        </div>
      )}

      {editing && (
        <CreditForm key={editing.id || "new"} credit={editing} onSave={save} onCancel={() => setEditing(null)} />
      )}

      {arbitrage && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Arbitrage — {arbitrage.label || "crédit immo"}</h2>
            <button onClick={() => setArbitrage(null)} aria-label="Fermer"
              style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 10, minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted }}>
              <X size={14} />
            </button>
          </div>
          <CreditArbitrage key={arbitrage.id} initial={arbitrageInitial} />
        </Card>
      )}

      {/* Liste */}
      {credits.length === 0 && !editing ? (
        <Card>
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <CreditCard size={32} style={{ color: T.muted }} />
            <p style={{ color: T.muted }}>Aucun crédit enregistré. Ajoutez vos prêts (immo, auto, conso, étudiant, revolving…) pour suivre vos mensualités et votre endettement.</p>
            <button onClick={() => setEditing(emptyCredit())}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: T.gradientPrimary, color: "#fff", border: "none", cursor: "pointer", boxShadow: glow(T.violet, 32, "33"), transition: "transform 0.15s, box-shadow 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px) scale(1.015)"; e.currentTarget.style.boxShadow = glow(T.violet, 48, "55"); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = glow(T.violet, 32, "33"); }}>
              <Plus size={16} /> Ajouter un crédit
            </button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {credits.map((c) => (
            <CreditCardItem key={c.id} credit={c} now={now}
              onEdit={(cr) => { setArbitrage(null); setEditing(cr); }}
              onDelete={remove}
              onArbitrage={(cr) => { setEditing(null); setArbitrage(cr); }} />
          ))}
        </div>
      )}

      {/* Conseils contextuels */}
      {conseils.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} style={{ color: T.violet }} />
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Conseils</h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {conseils.map((cs, i) => {
              const col = cs.level === "red" ? T.red : cs.level === "amber" ? T.amber : cs.level === "good" ? T.green : T.blue;
              const Icon = cs.level === "red" ? AlertCircle : cs.level === "amber" ? AlertTriangle : cs.level === "good" ? Check : Lightbulb;
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                  style={{ background: `${col}0d`, border: `1px solid ${col}33` }}>
                  <Icon size={15} style={{ color: col, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <span className="text-sm" style={{ color: T.text, lineHeight: 1.5 }}>{cs.text}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURE 5: SIMULATEUR IMMOBILIER AVANCÉ                            */
/* ------------------------------------------------------------------ */
function Immobilier({ totals, simParams, patrimoine, transactions }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);
  const netWorth = useMemo(() => {
    const a = patrimoine.actifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    const p = patrimoine.passifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    return a - p;
  }, [patrimoine]);

  const profileType    = useMemo(() => detectProfileType(transactions || []), [transactions]);
  const bCfg           = PROFILE_CONFIG[profileType];
  const revenueForBank = Math.round(totals.revenus * bCfg.revenueRatio);

  // Auto-détection des crédits existants depuis les transactions (prêt auto, conso, étudiant…)
  const autoCredits = useMemo(() =>
    Math.abs((transactions || [])
      .filter(t => t.type === "charge_fixe" && (t.cat === "Remboursements" || /pr[eê]t|cr[eé]dit|emprunt/i.test(t.label || "")))
      .reduce((s, t) => s + (t.amount || 0), 0)),
    [transactions]
  );
  // null = utiliser la valeur auto-détectée
  const [creditsManual, setCreditsManual] = useState(null);
  const creditsExistants = creditsManual !== null ? creditsManual : autoCredits;

  // Formule HCSF correcte : revenus × 35% − crédits existants hors immo
  const mensualiteMax  = Math.max(0, Math.round(revenueForBank * 0.35 * bCfg.capacityMult - creditsExistants));
  const loan20         = Math.round(loanFromPayment(mensualiteMax, 0.035, 20));
  const loan25         = Math.round(loanFromPayment(mensualiteMax, 0.037, 25));

  const [mode, setMode] = useState("residence"); // "residence" | "locatif"

  const [price, setPrice] = useState(300000);
  const [apportPct, setApportPct] = useState(20);
  const [rate, setRate] = useState(3.8);
  const [duration, setDuration] = useState(20);
  const [appreciation, setAppreciation] = useState(2.5);
  const [rentMonthly, setRentMonthly] = useState(1200);
  const [resChargesProprio, setResChargesProprio] = useState(() => Math.round(price * 0.012 / 12));
  const [showRentVsBuy, setShowRentVsBuy] = useState(false);

  // --- Investissement locatif ---
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

  // --- Mise en location d'un bien déjà détenu ---
  const [melLoyerBrut, setMelLoyerBrut] = useState(900);
  const [melMensualite, setMelMensualite] = useState(700);
  const [melChargesCopro, setMelChargesCopro] = useState(50);
  const [melTaxeFonciere, setMelTaxeFonciere] = useState(900);
  const [melVacance, setMelVacance] = useState(1);
  const [melGLIPct, setMelGLIPct] = useState(2.5);
  const [melPNO, setMelPNO] = useState(120);
  const [melGestionPct, setMelGestionPct] = useState(0);
  const [melEntretienPct, setMelEntretienPct] = useState(5);
  const [melMeuble, setMelMeuble] = useState(false); // false = location nue, true = meublée (LMNP)
  const [melRegimeFiscal, setMelRegimeFiscal] = useState("micro"); // "micro" | "microBic" | "reel"
  const [melTMI, setMelTMI] = useState(30);
  const [melCodePostal, setMelCodePostal] = useState("");
  const [melSurface, setMelSurface] = useState(50);
  const [melLoyerMeubleMajorationPct, setMelLoyerMeubleMajorationPct] = useState(15);

  // Garde le régime fiscal cohérent avec la case "loué meublé" : bascule
  // automatiquement entre micro-foncier (nu) et micro-BIC (meublé), sans
  // toucher au régime réel (applicable dans les deux cas).
  useEffect(() => {
    setMelRegimeFiscal((prev) => {
      if (melMeuble && prev === "micro") return "microBic";
      if (!melMeuble && prev === "microBic") return "micro";
      return prev;
    });
  }, [melMeuble]);

  // Géolocalisation du bien (code postal → commune/département) pour estimer
  // la taxe foncière et l'assurance PNO de façon cohérente avec la zone.
  const [melGeoInfo, setMelGeoInfo] = useState(null); // { commune, codeDept, departement, population }
  const [melGeoLoading, setMelGeoLoading] = useState(false);
  const [melGeoError, setMelGeoError] = useState(null);

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

  const totalApport   = Math.round(price * apportPct / 100);
  const notaire       = Math.round(price * 0.08);
  const apportSurBien = Math.max(0, totalApport - notaire);
  const credit        = price - apportSurBien;
  const monthlyRate = rate / 100 / 12;
  const n = duration * 12;
  const mensualite = monthlyRate > 0
    ? Math.round(credit * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)))
    : Math.round(credit / n);

  const liquidNetWorth = netWorth * 0.8;
  const canAfford = liquidNetWorth >= totalApport;
  const affordGap = totalApport - liquidNetWorth;

  // Comparaison à effort mensuel égal : ce que paie réellement le propriétaire
  // chaque mois (crédit + charges récurrentes) vs le loyer du locataire — la
  // différence est le montant que le locataire peut investir en ETF.
  const effortProprietaire = mensualite + resChargesProprio;
  const investMonthly = Math.max(0, effortProprietaire - rentMonthly);
  const ecartAchatMoinsCher = Math.max(0, rentMonthly - effortProprietaire);

  const ownershipSeries = useMemo(() => Array.from({ length: duration + 1 }, (_, y) => {
    const propValue = Math.round(price * Math.pow(1 + appreciation / 100, y));
    const paid = mensualite * y * 12;
    const principalPaid = Math.max(0, paid - (credit * monthlyRate * n * y / n));
    const remaining = Math.max(0, credit - principalPaid);
    const equity = propValue - remaining;
    const renterFV = Math.round(fv(0, investMonthly, RATE_A, y));
    return { year: 2026 + y, propValue, "Propriété nette": Math.max(0, equity), "Patrimoine locataire": renterFV };
  }), [price, appreciation, mensualite, credit, monthlyRate, n, duration, investMonthly]);

  const finalEquity = ownershipSeries[ownershipSeries.length - 1]["Propriété nette"] || 0;
  const finalPropValue = ownershipSeries[ownershipSeries.length - 1].propValue || 0;
  const finalRenterFV = ownershipSeries[ownershipSeries.length - 1]["Patrimoine locataire"] || 0;
  const totalInterest = Math.max(0, mensualite * n - credit);
  const rentTotal = rentMonthly * 12 * duration;

  // --- Investissement locatif : structure du financement ---
  const locTotalApport   = Math.round(locPrice * locApportPct / 100);
  const locNotaire       = Math.round(locPrice * 0.08);
  const locApportSurBien = Math.max(0, locTotalApport - locNotaire);
  const locCredit        = locPrice - locApportSurBien;
  const locMonthlyRate   = locRate / 100 / 12;
  const locN             = locDuration * 12;
  const locMensualite = locMonthlyRate > 0
    ? Math.round(locCredit * locMonthlyRate / (1 - Math.pow(1 + locMonthlyRate, -locN)))
    : Math.round(locCredit / locN);
  const locAssuranceEmprunteurMensuelle = Math.round(locCredit * (locAssuranceEmprunteurPct / 100) / 12);

  // --- Investissement locatif : rendement brut/net ---
  const loyerAnnuelBrut      = locLoyer * 12;
  const moisOccupes          = Math.max(0, 12 - locVacance);
  const loyerAnnuelEffectif  = locLoyer * moisOccupes;
  const loyerMensuelEffectif = loyerAnnuelEffectif / 12;
  const locInvestissementTotal = locPrice + locNotaire;
  const locChargesAnnuelles  = locCharges * 12 + locTaxeFonciere + locAssurancePNO;
  const rendementBrut = locInvestissementTotal > 0 ? (loyerAnnuelBrut / locInvestissementTotal) * 100 : 0;
  const rendementNet  = locInvestissementTotal > 0 ? ((loyerAnnuelEffectif - locChargesAnnuelles) / locInvestissementTotal) * 100 : 0;

  // --- Investissement locatif : cash-flow mensuel avant impôt ---
  const cashflowMensuel = loyerMensuelEffectif - locMensualite - locAssuranceEmprunteurMensuelle - locCharges - (locTaxeFonciere / 12) - (locAssurancePNO / 12);

  // Les banques comptent généralement ~70 % des loyers prévisionnels dans le calcul du taux d'endettement
  const mensualiteMaxAvecLoyer = mensualiteMax + Math.round(locLoyer * 0.7);
  const locBudgetSearch = Math.round(loanFromPayment(mensualiteMaxAvecLoyer, 0.037, 25));

  const rendementColor = (r) => r >= 6 ? T.green : r >= 3.5 ? T.amber : T.red;

  // --- Mise en location d'un bien déjà détenu : charges & cash-flow ---
  const melMoisOccupes         = Math.max(0, 12 - melVacance);
  const melLoyerAnnuelEffectif = melLoyerBrut * melMoisOccupes;
  const melLoyerMensuelEffectif = melLoyerAnnuelEffectif / 12;

  const melGLIMensuel       = Math.round(melLoyerBrut * melGLIPct / 100);
  const melGestionMensuel   = Math.round(melLoyerBrut * melGestionPct / 100);
  const melEntretienMensuel = Math.round(melLoyerBrut * melEntretienPct / 100);
  const melTaxeFonciereMensuelle = melTaxeFonciere / 12;
  const melPNOMensuelle          = melPNO / 12;

  const melChargesMensuelles = melMensualite + melChargesCopro + melTaxeFonciereMensuelle
    + melPNOMensuelle + melGLIMensuel + melGestionMensuel + melEntretienMensuel;
  const melCashflowAvantImpot = melLoyerMensuelEffectif - melChargesMensuelles;

  // --- Imposition des revenus locatifs ---
  // Abattement forfaitaire : 30 % en micro-foncier (location nue), 50 % en micro-BIC (location meublée)
  const melAbattementPct = melRegimeFiscal === "microBic" ? 50 : 30;
  const melChargesDeductiblesAnnuelles = melTaxeFonciere + melPNO
    + (melChargesCopro + melGLIMensuel + melGestionMensuel + melEntretienMensuel) * 12;
  const melResultatFoncier = melLoyerAnnuelEffectif - melChargesDeductiblesAnnuelles;
  const melBaseImposable = melRegimeFiscal === "reel"
    ? Math.max(0, melResultatFoncier)
    : Math.max(0, melLoyerAnnuelEffectif * (1 - melAbattementPct / 100));
  const melDeficitFoncier = melRegimeFiscal === "reel" ? Math.max(0, -melResultatFoncier) : 0;
  const melImpotAnnuel  = melBaseImposable * (melTMI / 100 + 0.172);
  const melImpotMensuel = melImpotAnnuel / 12;
  const melCashflowApresImpot = melCashflowAvantImpot - melImpotMensuel;

  // --- Estimation taxe foncière & PNO à partir du code postal ---
  // Heuristique : valeur locative cadastrale ≈ loyer annuel / 2 (ordre de grandeur usuel).
  const melTauxTFDept = melGeoInfo ? (TAUX_TF_PAR_DEPT[melGeoInfo.codeDept] ?? TAUX_TF_DEFAUT) : null;
  const melValeurLocativeEstimee = (melLoyerBrut * 12) / 2;
  const melTaxeFonciereEstimee = melTauxTFDept != null ? Math.round(melValeurLocativeEstimee * melTauxTFDept / 100) : null;
  // PNO ≈ base + prime au m², majorée dans les grandes villes (risque/valeur du bien plus élevés)
  const melPNOEstimee = Math.round((70 + melSurface * 1.1) * (melGeoInfo && melGeoInfo.population > 100000 ? 1.15 : 1));

  // --- Comparatif location nue vs meublée (LMNP, micro-BIC : abattement 50 %) ---
  function computeMelScenario(loyerBrut, abattementPct, regime) {
    const loyerAnnuelEffectif = loyerBrut * melMoisOccupes;
    const loyerMensuelEffectif = loyerAnnuelEffectif / 12;
    const gli = Math.round(loyerBrut * melGLIPct / 100);
    const gestion = Math.round(loyerBrut * melGestionPct / 100);
    const entretien = Math.round(loyerBrut * melEntretienPct / 100);
    const chargesMensuelles = melMensualite + melChargesCopro + melTaxeFonciereMensuelle + melPNOMensuelle + gli + gestion + entretien;
    const cashflowAvantImpot = loyerMensuelEffectif - chargesMensuelles;

    let baseImposable;
    if (regime === "reel") {
      const chargesDeductiblesAnnuelles = melTaxeFonciere + melPNO + (melChargesCopro + gli + gestion + entretien) * 12;
      baseImposable = Math.max(0, loyerAnnuelEffectif - chargesDeductiblesAnnuelles);
    } else {
      baseImposable = Math.max(0, loyerAnnuelEffectif * (1 - abattementPct / 100));
    }
    const impotAnnuel = baseImposable * (melTMI / 100 + 0.172);
    const impotMensuel = impotAnnuel / 12;
    return { loyerMensuelEffectif, chargesMensuelles, cashflowAvantImpot, baseImposable, impotMensuel, cashflowApresImpot: cashflowAvantImpot - impotMensuel };
  }

  // Comparatif "nu" toujours basé sur le régime foncier (micro 30 % ou réel) — le micro-BIC
  // ne s'applique qu'au meublé, même si c'est le régime sélectionné pour la simulation principale.
  const melRegimeNuComparaison = melRegimeFiscal === "reel" ? "reel" : "micro";
  const melScenarioNu = computeMelScenario(melLoyerBrut, 30, melRegimeNuComparaison);

  const melLoyerMeuble = Math.round(melLoyerBrut * (1 + melLoyerMeubleMajorationPct / 100));
  const melScenarioMeuble = computeMelScenario(melLoyerMeuble, 50, "micro");
  const melDeltaMeuble = melScenarioMeuble.cashflowApresImpot - melScenarioNu.cashflowApresImpot;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: T.text }}>Simulateur Immobilier</h1>
        <p style={{ color: T.muted }}>Analysez un projet d'achat, calculez votre apport et comparez achat vs location.</p>
      </div>

      {/* Mode : résidence principale vs investissement locatif vs mise en location */}
      <div className="flex gap-2 flex-wrap">
        {[
          ["residence", "Résidence principale", "Le bien que vous habiterez"],
          ["locatif", "Investissement locatif", "Un bien que vous achetez pour le louer"],
          ["location", "Mettre un bien en location", "Un bien que vous possédez déjà"],
        ].map(([val, lbl]) => (
          <button key={val} onClick={() => setMode(val)} style={{
            padding: "9px 18px", borderRadius: 10, border: `1px solid ${mode === val ? T.blue : T.border}`,
            background: mode === val ? "rgba(91,141,239,0.15)" : "transparent",
            color: mode === val ? T.blue : T.muted, fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>{lbl}</button>
        ))}
      </div>
      <p className="text-sm -mt-4" style={{ color: T.muted }}>
        {mode === "residence" && "Résidence principale : le logement que vous occuperez vous-même."}
        {mode === "locatif" && "Investissement locatif : un bien acheté pour être loué — rendement, charges et cash-flow sont calculés séparément."}
        {mode === "location" && "Mise en location d'un bien déjà détenu : simulez le cash-flow si vous le louez, charges et imposition incluses."}
      </p>

      {/* Capacité d'emprunt */}
      {mode !== "location" && mode !== "credit" && (
      <Card style={{ borderColor: profileType === "salarie_stable" ? "rgba(34,199,154,0.25)" : "rgba(245,166,35,0.25)" }}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Home size={20} style={{ color: T.green }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Capacité d'Emprunt Maximale</h2>
          <span className="text-sm ml-auto" style={{ color: T.muted }}>Règle des 35 % d'endettement</span>
        </div>
        <div className="flex items-center flex-wrap gap-3 rounded-xl px-4 py-3 mb-4"
          style={{
            background: profileType === "salarie_stable" ? "rgba(34,199,154,0.06)" : "rgba(245,166,35,0.06)",
            border: `1px solid ${profileType === "salarie_stable" ? "rgba(34,199,154,0.3)" : "rgba(245,166,35,0.3)"}`,
          }}>
          <span className="text-sm font-semibold" style={{ color: bCfg.color }}>
            Profil détecté : {bCfg.label}
          </span>
          <span className="ml-auto text-xs" style={{ color: T.muted }}>
            Revenu retenu :&nbsp;<b style={{ color: T.text }}>{eur(revenueForBank)}</b>
            {bCfg.revenueRatio < 1 && <span> · {Math.round(bCfg.revenueRatio * 100)} % du brut</span>}
          </span>
        </div>
        {bCfg.note && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm"
            style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.25)", color: T.amber }}>
            {bCfg.note}
          </div>
        )}

        {/* Formule & inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <MiniStat label="Revenus nets mensuels" value={eur(revenueForBank)} />
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}` }}>
            <div className="text-xs mb-1.5" style={{ color: T.muted }}>
              Crédits existants hors immo (auto-détectés)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={creditsExistants}
                onChange={e => setCreditsManual(+e.target.value || 0)}
                style={{ ...inputStyle, padding: "4px 8px", fontSize: 14, fontWeight: 700, color: T.amber, width: "100%" }}
              />
              <span className="text-xs shrink-0" style={{ color: T.muted }}>€/mois</span>
            </div>
            {creditsManual === null && autoCredits > 0 && (
              <div className="text-xs mt-1" style={{ color: T.muted }}>Détectés depuis vos transactions</div>
            )}
            {creditsManual !== null && (
              <button className="text-xs mt-1 underline" style={{ color: T.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() => setCreditsManual(null)}>
                Remettre auto ({eur(autoCredits)})
              </button>
            )}
          </div>
          <MiniStat label="Mensualité disponible" value={eur(mensualiteMax)} color={mensualiteMax > 0 ? T.green : T.red} />
        </div>

        {/* Formule affichée */}
        <div className="rounded-xl px-4 py-3 mb-4 text-xs font-mono flex flex-wrap gap-x-3 gap-y-1 items-center"
          style={{ background: "rgba(47,155,255,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
          <span style={{ color: T.text }}>Mensualité max</span>
          <span>=</span>
          <span style={{ color: T.green }}>{eur(revenueForBank)} × 35%{bCfg.capacityMult < 1 ? ` × ${Math.round(bCfg.capacityMult * 100)}%` : ""}</span>
          {creditsExistants > 0 && <><span>−</span><span style={{ color: T.amber }}>{eur(creditsExistants)} crédits existants</span></>}
          <span>=</span>
          <span style={{ color: mensualiteMax > 0 ? T.cyan : T.red, fontWeight: 700 }}>{eur(mensualiteMax)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card style={{ background: "rgba(139,92,246,0.05)" }}>
            <div className="text-sm" style={{ color: T.muted }}>Sur <b>20 ans</b> à 3,5 %</div>
            <div className="text-3xl font-bold my-1" style={{ color: loan20 > 0 ? T.cyan : T.muted }}>{eur(loan20)}</div>
            <div className="text-xs" style={{ color: T.muted }}>mensualité : {eur(mensualiteMax)} · taux d'endettement : {revenueForBank > 0 ? ((mensualiteMax + creditsExistants) / revenueForBank * 100).toFixed(1) : 0} %</div>
          </Card>
          <Card style={{ background: "rgba(34,199,154,0.05)" }}>
            <div className="text-sm" style={{ color: T.muted }}>Sur <b>25 ans</b> à 3,7 %</div>
            <div className="text-3xl font-bold my-1" style={{ color: loan25 > 0 ? T.green : T.muted }}>{eur(loan25)}</div>
            <div className="text-xs" style={{ color: T.muted }}>mensualité : {eur(mensualiteMax)} · taux d'endettement : {revenueForBank > 0 ? ((mensualiteMax + creditsExistants) / revenueForBank * 100).toFixed(1) : 0} %</div>
          </Card>
        </div>

        {mode === "locatif" && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(91,141,239,0.06)", border: `1px solid ${T.blue}33` }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span style={{ color: T.blue, fontWeight: 700 }}>
                Capacité d'emprunt avec ce loyer
                <InfoTooltip text="Les banques intègrent généralement ~70 % du loyer prévisionnel dans le calcul de votre taux d'endettement (35 %), ce qui augmente votre capacité d'emprunt pour un investissement locatif." align="left" />
              </span>
              <span style={{ color: T.text, fontWeight: 800 }}>{eur(mensualiteMaxAvecLoyer)} / mois</span>
            </div>
            <div className="text-xs mt-1" style={{ color: T.muted }}>
              Soit jusqu'à {eur(locBudgetSearch)} empruntables sur 25 ans (au lieu de {eur(loan25)} sans loyer pris en compte).
            </div>
          </div>
        )}
      </Card>
      )}

      {/* Paramètres */}
      {mode === "residence" && (
      <>
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Home size={18} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Paramètres du projet</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Prix du bien (€)">
            <input type="number" value={price} style={inputStyle} onChange={(e) => setPrice(+e.target.value || 0)} />
          </Field>
          <Field label={`Apport total, notaire inclus (${apportPct} % = ${eur(totalApport)})`}>
            <input type="range" min={5} max={50} step={1} value={apportPct} onChange={(e) => setApportPct(+e.target.value)}
              className="w-full" style={{ accentColor: T.blue }} />
          </Field>
          <Field label="Taux crédit (% / an)">
            <input type="number" value={rate} step={0.1} style={inputStyle} onChange={(e) => setRate(+e.target.value || 0)} />
          </Field>
          <Field label="Durée du crédit">
            <select value={duration} style={inputStyle} onChange={(e) => setDuration(+e.target.value)}>
              {[10, 15, 20, 25, 30].map((d) => <option key={d} value={d}>{d} ans</option>)}
            </select>
          </Field>
          <Field label="Appréciation annuelle (%)">
            <input type="number" value={appreciation} step={0.5} style={inputStyle} onChange={(e) => setAppreciation(+e.target.value || 0)} />
          </Field>
        </div>
      </Card>

      {/* Synthèse financement */}
      <Card>
        <div className="text-xs font-semibold mb-4" style={{ color: T.muted, letterSpacing: 1 }}>STRUCTURE DU FINANCEMENT</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MiniStat label="Votre apport" value={eur(totalApport)} color={T.cyan} />
          <MiniStat label="Dont frais de notaire" value={eur(notaire)} color={T.muted} />
          <MiniStat label="Dont sur le bien" value={eur(apportSurBien)} color={T.blue} />
          <MiniStat label="Montant emprunté" value={eur(credit)} color={T.amber} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm" style={{ color: T.muted }}>Mensualité crédit</div>
            <div className="text-3xl font-bold my-1" style={{ color: T.text }}>{eur(mensualite)}</div>
            <div className="text-xs" style={{ color: T.muted }}>sur {duration} ans à {rate} %</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm" style={{ color: T.muted }}>Coût total du crédit</div>
            <div className="text-3xl font-bold my-1" style={{ color: T.amber }}>{eur(credit + totalInterest)}</div>
            <div className="text-xs" style={{ color: T.muted }}>dont intérêts : {eur(Math.round(totalInterest))}</div>
          </div>
        </div>

        {/* Affordabilité */}
        <div className="rounded-xl p-4" style={{ background: canAfford ? "rgba(34,199,154,0.06)" : "rgba(255,90,95,0.06)", border: `1px solid ${canAfford ? T.green + "44" : T.red + "44"}` }}>
          <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
            <span className="font-semibold text-sm" style={{ color: canAfford ? T.green : T.red }}>
              {canAfford ? "Apport finançable" : "Apport insuffisant"}
            </span>
            <span className="text-sm font-bold" style={{ color: T.text }}>
              {canAfford ? `Marge : ${eur(Math.round(-affordGap))}` : `Manque : ${eur(Math.round(affordGap))}`}
            </span>
          </div>
          <div className="flex justify-between text-xs" style={{ color: T.muted }}>
            <span>Votre patrimoine liquide estimé : <b style={{ color: T.text }}>{eur(Math.round(liquidNetWorth))}</b></span>
            <span>Apport requis : <b style={{ color: T.text }}>{eur(totalApport)}</b></span>
          </div>
          {!canAfford && (
            <div className="mt-3 space-y-1 text-xs" style={{ color: T.muted }}>
              <div>• Attendre {Math.ceil(affordGap / simParams.monthly)} mois d'épargne (à {eur(simParams.monthly)}/mois)</div>
              <div>• Réduire l'apport à {Math.max(10, Math.floor((liquidNetWorth / price) * 100))} % (notaire inclus)</div>
              <div>• Rechercher un bien à {eur(Math.round(liquidNetWorth / (apportPct / 100)))} max avec votre apport actuel</div>
            </div>
          )}
        </div>
      </Card>

      {/* Simulation 20 ans */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: T.amber }} />
            <h2 className="text-xl font-bold" style={{ color: T.text }}>Projection sur {duration} ans</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
            <input type="checkbox" checked={showRentVsBuy} onChange={(e) => setShowRentVsBuy(e.target.checked)}
              style={{ accentColor: T.green, width: 14, height: 14 }} />
            <span style={{ color: showRentVsBuy ? T.green : T.muted }}>Comparer avec la location</span>
          </label>
        </div>

        {showRentVsBuy && (
          <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Loyer mensuel (si vous louiez)">
              <input type="number" value={rentMonthly} style={inputStyle} onChange={(e) => setRentMonthly(+e.target.value || 0)} />
            </Field>
            <Field label={<>Charges propriétaire (€/mois)<InfoTooltip text="Taxe foncière, assurance habitation, entretien et charges de copropriété — coûts récurrents du propriétaire qui n'existent pas (ou sont bien moindres) pour un locataire." align="left" /></>}>
              <input type="number" value={resChargesProprio} style={inputStyle} onChange={(e) => setResChargesProprio(+e.target.value || 0)} />
            </Field>
          </div>
          <div className="rounded-xl px-4 py-2.5 mb-4 text-xs flex flex-wrap gap-x-2 gap-y-1 items-center"
            style={{ background: "rgba(34,211,238,0.05)", border: `1px solid ${T.cyan}33`, color: T.muted }}>
            {investMonthly > 0 ? (
              <>
                <span>Effort propriétaire</span><span style={{ color: T.text }}>{eur(effortProprietaire)}/mois</span>
                <span>− loyer</span><span style={{ color: T.text }}>{eur(rentMonthly)}/mois</span>
                <span>=</span>
                <span style={{ color: T.cyan, fontWeight: 700 }}>{eur(investMonthly)}/mois investis en ETF par le locataire</span>
                <span>(comparaison à effort mensuel égal)</span>
              </>
            ) : (
              <span>Acheter coûte ici {eur(ecartAchatMoinsCher)}/mois de moins que louer — cet écart n'est pas réinvesti dans la comparaison, ce qui sous-estime l'avantage de l'achat.</span>
            )}
          </div>
          </>
        )}

        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={ownershipSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="year" stroke={T.muted} tick={{ fontSize: 12 }} interval={0} />
            <YAxis stroke={T.muted} tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + "k€" : v} />
            <Tooltip {...chartTip} formatter={(v) => eur(v)} />
            <Line type="monotone" dataKey="Propriété nette" stroke={T.amber} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="propValue" name="Valeur du bien" stroke={T.muted} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            {showRentVsBuy && <Line type="monotone" dataKey="Patrimoine locataire" stroke={T.cyan} strokeWidth={2} strokeDasharray="5 3" dot={false} />}
          </LineChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-xs mb-1" style={{ color: T.muted }}>Valeur du bien à {duration} ans</div>
            <div className="font-bold text-sm" style={{ color: T.amber }}>{eur(finalPropValue)}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-xs mb-1" style={{ color: T.muted }}>Patrimoine net immobilier</div>
            <div className="font-bold text-sm" style={{ color: T.text }}>{eur(finalEquity)}</div>
          </div>
          {showRentVsBuy && (
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.3)" }}>
              <div className="text-xs mb-1" style={{ color: T.muted }}>Patrimoine locataire</div>
              <div className="font-bold text-sm" style={{ color: T.cyan }}>{eur(finalRenterFV)}</div>
            </div>
          )}
          {!showRentVsBuy && (
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
              <div className="text-xs mb-1" style={{ color: T.muted }}>Intérêts payés</div>
              <div className="font-bold text-sm" style={{ color: T.red }}>{eur(Math.round(totalInterest))}</div>
            </div>
          )}
        </div>

        {showRentVsBuy && (
          <div className="mt-3 rounded-xl p-3 text-sm"
            style={{ background: finalEquity > finalRenterFV ? "rgba(34,199,154,0.06)" : "rgba(56,189,248,0.06)", border: `1px solid ${finalEquity > finalRenterFV ? T.green + "44" : T.cyan + "44"}` }}>
            <span style={{ color: finalEquity > finalRenterFV ? T.green : T.cyan }}>
              {finalEquity > finalRenterFV
                ? `L'achat génère ${eur(finalEquity - finalRenterFV)} de plus qu'investir en ETF en tant que locataire.`
                : `La location + investissement ETF génère ${eur(finalRenterFV - finalEquity)} de plus. Les deux stratégies sont proches — choix de mode de vie.`}
            </span>
          </div>
        )}

        {showRentVsBuy && (
          <p className="mt-2 text-xs" style={{ color: T.muted }}>
            Note fiscale : le capital ETF du locataire est affiché brut (avant flat tax de 30 % en cas de retrait), alors que la plus-value sur une résidence principale est exonérée d'impôt — l'avantage réel de l'achat est donc légèrement sous-estimé ci-dessus.
          </p>
        )}
      </Card>
      </>
      )}

      {mode === "locatif" && (
      <>
      {/* Paramètres du bien locatif */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Paramètres du bien locatif</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Prix du bien (€)">
            <input type="number" value={locPrice} style={inputStyle} onChange={(e) => setLocPrice(+e.target.value || 0)} />
          </Field>
          <Field label={`Apport, notaire inclus (${locApportPct} % = ${eur(locTotalApport)})`}>
            <div className="flex items-center" style={{ minHeight: 44 }}>
              <input type="range" min={5} max={50} step={1} value={locApportPct} onChange={(e) => setLocApportPct(+e.target.value)}
                className="w-full" style={{ accentColor: T.blue }} />
            </div>
          </Field>
          <Field label={`Vacance locative (${locVacance} mois/an)`}>
            <div className="flex items-center" style={{ minHeight: 44 }}>
              <input type="range" min={0} max={3} step={1} value={locVacance} onChange={(e) => setLocVacance(+e.target.value)}
                className="w-full" style={{ accentColor: T.amber }} />
            </div>
          </Field>
          <Field label="Taux crédit (% / an)">
            <input type="number" value={locRate} step={0.1} style={inputStyle} onChange={(e) => setLocRate(+e.target.value || 0)} />
          </Field>
          <Field label="Durée du crédit">
            <select value={locDuration} onChange={(e) => setLocDuration(+e.target.value)}
              style={{ ...inputStyle, paddingRight: 34,
                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23${(T.muted || '#94a3b8').replace('#','')}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}>
              {[10, 15, 20, 25, 30].map((d) => <option key={d} value={d}>{d} ans</option>)}
            </select>
          </Field>
          <Field label="Loyer mensuel attendu, hors charges (€)">
            <input type="number" value={locLoyer} style={inputStyle} onChange={(e) => setLocLoyer(+e.target.value || 0)} />
          </Field>
          <Field label="Charges de copropriété non récupérables (€/mois)">
            <input type="number" value={locCharges} style={inputStyle} onChange={(e) => setLocCharges(+e.target.value || 0)} />
          </Field>
          <Field label="Taxe foncière (€/an)">
            <input type="number" value={locTaxeFonciere} style={inputStyle} onChange={(e) => setLocTaxeFonciere(+e.target.value || 0)} />
          </Field>
          <Field label={<>Assurance PNO (€/an)<InfoTooltip text="Assurance Propriétaire Non Occupant : couvre le logement loué (dégâts des eaux, incendie, responsabilité civile…) lorsque vous ne l'habitez pas. Souvent exigée par le syndic en copropriété." /></>}>
            <input type="number" value={locAssurancePNO} style={inputStyle} onChange={(e) => setLocAssurancePNO(+e.target.value || 0)} />
          </Field>
          <Field label={<>Assurance emprunteur (% / an du capital)<InfoTooltip text="Assurance décès-invalidité exigée par la banque, ici appliquée au capital emprunté. Coût indicatif : de 0,10 % à 0,60 %/an selon l'âge et le profil de santé." /></>}>
            <input type="number" value={locAssuranceEmprunteurPct} step={0.05} style={inputStyle} onChange={(e) => setLocAssuranceEmprunteurPct(+e.target.value || 0)} />
          </Field>
        </div>
      </Card>

      {/* Structure du financement locatif */}
      <Card>
        <div className="text-xs font-semibold mb-4" style={{ color: T.muted, letterSpacing: 1 }}>STRUCTURE DU FINANCEMENT</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MiniStat label="Votre apport" value={eur(locTotalApport)} color={T.cyan} />
          <MiniStat label="Dont frais de notaire" value={eur(locNotaire)} color={T.muted} />
          <MiniStat label="Dont sur le bien" value={eur(locApportSurBien)} color={T.blue} />
          <MiniStat label="Montant emprunté" value={eur(locCredit)} color={T.amber} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm" style={{ color: T.muted }}>Mensualité crédit</div>
            <div className="text-3xl font-bold my-1" style={{ color: T.text }}>{eur(locMensualite)}</div>
            <div className="text-xs" style={{ color: T.muted }}>sur {locDuration} ans à {locRate} %</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm" style={{ color: T.muted }}>Assurance emprunteur</div>
            <div className="text-3xl font-bold my-1" style={{ color: T.text }}>{eur(locAssuranceEmprunteurMensuelle)}</div>
            <div className="text-xs" style={{ color: T.muted }}>par mois, sur {eur(locCredit)} emprunté</div>
          </div>
        </div>
      </Card>

      {/* Rendement locatif */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} style={{ color: T.amber }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Rendement locatif</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm flex items-center" style={{ color: T.muted }}>
              Rendement brut
              <InfoTooltip text="Rendement brut = loyers annuels (hors vacance) ÷ (prix d'achat + frais de notaire). Ne tient compte d'aucune charge — utile pour comparer rapidement des biens entre eux." />
            </div>
            <div className="text-3xl font-bold my-1" style={{ color: rendementColor(rendementBrut) }}>{rendementBrut.toFixed(2)} %</div>
            <div className="text-xs" style={{ color: T.muted }}>{eur(loyerAnnuelBrut)} / an ÷ {eur(locInvestissementTotal)}</div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="text-sm flex items-center" style={{ color: T.muted }}>
              Rendement net
              <InfoTooltip text="Rendement net = (loyers réels après vacance locative − charges de copropriété − taxe foncière − assurance PNO) ÷ (prix d'achat + frais de notaire). Hors crédit et hors fiscalité — c'est le chiffre le plus comparable entre projets." />
            </div>
            <div className="text-3xl font-bold my-1" style={{ color: rendementColor(rendementNet) }}>{rendementNet.toFixed(2)} %</div>
            <div className="text-xs" style={{ color: T.muted }}>après charges, hors crédit et fiscalité</div>
          </div>
        </div>

        {/* Formule affichée */}
        <div className="rounded-xl px-4 py-3 text-xs font-mono flex flex-wrap gap-x-3 gap-y-1 items-center"
          style={{ background: "rgba(47,155,255,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
          <span style={{ color: T.text }}>Rendement net</span>
          <span>=</span>
          <span style={{ color: T.green }}>({eur(loyerAnnuelEffectif)} loyers</span>
          <span>−</span>
          <span style={{ color: T.amber }}>{eur(locChargesAnnuelles)} charges)</span>
          <span>÷</span>
          <span style={{ color: T.cyan }}>{eur(locInvestissementTotal)}</span>
          <span>=</span>
          <span style={{ color: rendementColor(rendementNet), fontWeight: 700 }}>{rendementNet.toFixed(2)} %</span>
        </div>
      </Card>

      {/* Cash-flow mensuel */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={18} style={{ color: T.cyan }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Cash-flow mensuel</h2>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Loyer perçu (vacance déduite)</span>
            <span style={{ color: T.green, fontWeight: 700 }}>+ {eur(Math.round(loyerMensuelEffectif))}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Mensualité crédit</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(locMensualite)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Assurance emprunteur</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(locAssuranceEmprunteurMensuelle)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Charges de copropriété</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(locCharges)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Taxe foncière (mensualisée)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(Math.round(locTaxeFonciere / 12))}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Assurance PNO (mensualisée)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(Math.round(locAssurancePNO / 12))}</span>
          </div>
          <div className="flex justify-between pt-2 mt-1" style={{ borderTop: `1px solid ${T.border}` }}>
            <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net mensuel (avant impôt)</span>
            <span style={{ color: cashflowMensuel >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 16 }}>
              {cashflowMensuel >= 0 ? "+ " : "− "}{eur(Math.abs(Math.round(cashflowMensuel)))}
            </span>
          </div>
        </div>
        <div className="text-xs mt-4 pt-3" style={{ color: T.muted, borderTop: `1px solid ${T.border}`, lineHeight: 1.6 }}>
          <AlertTriangle size={12} style={{ color: T.amber, display: "inline", verticalAlign: "-2px", marginRight: 4 }} aria-hidden="true" />Ce cash-flow est calculé <b>avant impôt sur les revenus fonciers</b>. Selon votre régime (micro-foncier :
          abattement forfaitaire de 30 % si revenus &lt; 15 000 €/an, ou régime réel avec déduction des charges et
          intérêts d'emprunt — voire déficit foncier si le résultat est négatif), l'impact réel peut différer.
          Consultez l'onglet <b>Fiscalité → Revenus locatifs</b> pour le détail de l'imposition.
        </div>
      </Card>
      </>
      )}

      {mode === "location" && (
      <>
      {/* Paramètres de la mise en location */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Paramètres de la mise en location</h2>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm select-none mb-4 rounded-xl px-4 py-3"
          style={{ background: melMeuble ? "rgba(34,199,154,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${melMeuble ? T.green + "44" : T.border}` }}>
          <input type="checkbox" checked={melMeuble} onChange={(e) => setMelMeuble(e.target.checked)}
            style={{ accentColor: T.green, width: 16, height: 16 }} />
          <span style={{ color: melMeuble ? T.green : T.text, fontWeight: 600 }}>Bien loué meublé (LMNP)</span>
          <InfoTooltip text="Cochez si le bien est (ou sera) loué avec mobilier. Cela définit le régime fiscal par défaut : micro-BIC (abattement de 50 %) pour le meublé, micro-foncier (abattement de 30 %) pour la location nue." align="left" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label={<>Code postal du bien<InfoTooltip text="Utilisé pour estimer la taxe foncière et l'assurance PNO via la commune et sa population (API officielle geo.api.gouv.fr). Estimations indicatives, à ajuster." align="left" /></>}>
            <input type="text" inputMode="numeric" maxLength={5} value={melCodePostal} placeholder="ex : 69003"
              style={inputStyle} onChange={(e) => setMelCodePostal(e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </Field>
          <Field label="Surface du bien (m²)">
            <input type="number" value={melSurface} style={inputStyle} onChange={(e) => setMelSurface(+e.target.value || 0)} />
          </Field>
          <Field label="Loyer mensuel brut estimé (€)">
            <input type="number" value={melLoyerBrut} style={inputStyle} onChange={(e) => setMelLoyerBrut(+e.target.value || 0)} />
          </Field>
          <Field label={<>Mensualité de crédit, assurances comprises (€)<InfoTooltip text="Le montant total que vous remboursez chaque mois sur le crédit de ce bien (capital + intérêts + assurance emprunteur). Indiquez 0 si le bien est déjà entièrement remboursé." align="left" /></>}>
            <input type="number" value={melMensualite} style={inputStyle} onChange={(e) => setMelMensualite(+e.target.value || 0)} />
          </Field>
          <Field label={`Vacance locative (${melVacance} mois/an)`}>
            <div className="flex items-center" style={{ minHeight: 44 }}>
              <input type="range" min={0} max={3} step={1} value={melVacance} onChange={(e) => setMelVacance(+e.target.value)}
                className="w-full" style={{ accentColor: T.amber }} />
            </div>
          </Field>
          <Field label="Charges de copropriété non récupérables (€/mois)">
            <input type="number" value={melChargesCopro} style={inputStyle} onChange={(e) => setMelChargesCopro(+e.target.value || 0)} />
          </Field>
          <Field label="Taxe foncière (€/an)" compact>
            <input type="number" value={melTaxeFonciere} style={inputStyle} onChange={(e) => setMelTaxeFonciere(+e.target.value || 0)} />
          </Field>
          <Field label={<>Assurance PNO (€/an)<InfoTooltip text="Assurance Propriétaire Non Occupant : couvre le logement loué (dégâts des eaux, incendie, responsabilité civile…) lorsque vous ne l'habitez pas. Souvent exigée par le syndic en copropriété." align="left" /></>} compact>
            <input type="number" value={melPNO} style={inputStyle} onChange={(e) => setMelPNO(+e.target.value || 0)} />
          </Field>
          <Field label={<>GLI — Garantie Loyers Impayés (% du loyer)<InfoTooltip text="Assurance qui couvre les loyers impayés et certaines dégradations locatives. Facultative mais recommandée — coût indicatif : 2 % à 3,5 % du loyer mensuel charges comprises." align="left" /></>}>
            <input type="number" value={melGLIPct} step={0.1} style={inputStyle} onChange={(e) => setMelGLIPct(+e.target.value || 0)} />
          </Field>
          <Field label={<>Frais de gestion locative (% du loyer)<InfoTooltip text="Si vous confiez la gestion à une agence : comptez 5 % à 8 % du loyer charges comprises. Laissez à 0 si vous gérez vous-même." align="left" /></>}>
            <input type="number" value={melGestionPct} step={0.5} style={inputStyle} onChange={(e) => setMelGestionPct(+e.target.value || 0)} />
          </Field>
          <Field label={<>Provision entretien / travaux (% du loyer)<InfoTooltip text="Mise de côté mensuelle pour l'entretien courant et les imprévus (chaudière, peinture, électroménager…). Recommandé : 5 % à 10 % du loyer." align="left" /></>}>
            <input type="number" value={melEntretienPct} step={0.5} style={inputStyle} onChange={(e) => setMelEntretienPct(+e.target.value || 0)} />
          </Field>
        </div>

        {/* Estimations à partir du code postal */}
        {melCodePostal.length === 5 && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(91,141,239,0.06)", border: `1px solid ${T.blue}33` }}>
            {melGeoLoading && <span style={{ color: T.muted }}>Recherche de la commune…</span>}
            {melGeoError && <span style={{ color: T.red }}>{melGeoError}</span>}
            {melGeoInfo && !melGeoLoading && (
              <div className="flex flex-col gap-2">
                <div style={{ color: T.blue, fontWeight: 700 }}>
                  {melGeoInfo.commune} ({melGeoInfo.codeDept}) · {melGeoInfo.departement}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: T.muted }}>
                  <span>Taxe foncière estimée : <b style={{ color: T.text }}>{eur(melTaxeFonciereEstimee)}/an</b> (taux moyen ~{melTauxTFDept} %)</span>
                  <button onClick={() => setMelTaxeFonciere(melTaxeFonciereEstimee)}
                    style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${T.blue}55`, background: "rgba(91,141,239,0.12)", color: T.blue, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Utiliser
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: T.muted }}>
                  <span>Assurance PNO estimée : <b style={{ color: T.text }}>{eur(melPNOEstimee)}/an</b> (selon surface{melGeoInfo.population > 100000 ? " et taille de la ville" : ""})</span>
                  <button onClick={() => setMelPNO(melPNOEstimee)}
                    style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${T.blue}55`, background: "rgba(91,141,239,0.12)", color: T.blue, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Utiliser
                  </button>
                </div>
                <div className="text-xs" style={{ color: T.muted, fontStyle: "italic" }}>
                  Estimations indicatives basées sur des taux moyens — vérifiez votre avis de taxe foncière et vos devis d'assurance.
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Imposition des revenus locatifs */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Landmark size={18} style={{ color: T.violet }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Imposition des revenus locatifs</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label={<>Régime fiscal<InfoTooltip text="Déterminé par la case « Bien loué meublé » ci-dessus : micro-foncier (nu, abattement de 30 %) ou micro-BIC (meublé, abattement de 50 %). Le régime réel — déduction des charges réelles (et intérêts d'emprunt) — s'applique quel que soit le mode de location." align="left" /></>}>
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
          <Field label={<>Votre tranche marginale d'imposition (TMI)<InfoTooltip text="Taux d'imposition sur la dernière tranche de vos revenus (barème de l'impôt sur le revenu). Les revenus fonciers s'y ajoutent et sont taxés à ce taux, plus 17,2 % de prélèvements sociaux." align="left" /></>}>
            <select value={melTMI} style={inputStyle} onChange={(e) => setMelTMI(+e.target.value)}>
              {[0, 11, 30, 41, 45].map(t => <option key={t} value={t}>{t} %</option>)}
            </select>
          </Field>
        </div>

        {melRegimeFiscal !== "reel" ? (
          <div className="rounded-xl px-4 py-3 text-xs font-mono flex flex-wrap gap-x-3 gap-y-1 items-center"
            style={{ background: "rgba(106,63,251,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
            <span style={{ color: T.text }}>Base imposable</span>
            <span>=</span>
            <span style={{ color: T.green }}>{eur(Math.round(melLoyerAnnuelEffectif))} loyers perçus</span>
            <span>×</span>
            <span style={{ color: T.amber }}>(1 − {melAbattementPct} % abattement)</span>
            <span>=</span>
            <span style={{ color: T.violet, fontWeight: 700 }}>{eur(Math.round(melBaseImposable))}</span>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3 text-xs font-mono flex flex-wrap gap-x-3 gap-y-1 items-center"
            style={{ background: "rgba(106,63,251,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>
            <span style={{ color: T.text }}>Résultat foncier</span>
            <span>=</span>
            <span style={{ color: T.green }}>{eur(Math.round(melLoyerAnnuelEffectif))} loyers</span>
            <span>−</span>
            <span style={{ color: T.amber }}>{eur(Math.round(melChargesDeductiblesAnnuelles))} charges déductibles</span>
            <span>=</span>
            <span style={{ color: melResultatFoncier >= 0 ? T.violet : T.red, fontWeight: 700 }}>{eur(Math.round(melResultatFoncier))}</span>
          </div>
        )}

        {melDeficitFoncier > 0 && (
          <div className="text-xs mt-3" style={{ color: T.cyan, lineHeight: 1.6 }}>
            Déficit foncier de {eur(Math.round(melDeficitFoncier))} : imputable sur votre revenu global dans la limite de 10 700 €/an, le surplus est reportable sur vos revenus fonciers des 10 années suivantes.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <MiniStat label="Impôt + prélèvements sociaux (annuel)" value={eur(Math.round(melImpotAnnuel))} color={T.red} />
          <MiniStat label="Soit par mois" value={eur(Math.round(melImpotMensuel))} color={T.red} />
        </div>
      </Card>

      {/* Cash-flow mensuel */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={18} style={{ color: T.cyan }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Cash-flow mensuel de la location</h2>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Loyer perçu (vacance déduite)</span>
            <span style={{ color: T.green, fontWeight: 700 }}>+ {eur(Math.round(melLoyerMensuelEffectif))}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Mensualité crédit (assurances comprises)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(melMensualite)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Charges de copropriété</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(melChargesCopro)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Taxe foncière (mensualisée)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(Math.round(melTaxeFonciereMensuelle))}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Assurance PNO (mensualisée)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(Math.round(melPNOMensuelle))}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>GLI (Garantie Loyers Impayés)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(melGLIMensuel)}</span>
          </div>
          {melGestionMensuel > 0 && (
            <div className="flex justify-between">
              <span style={{ color: T.muted }}>Frais de gestion locative</span>
              <span style={{ color: T.red, fontWeight: 700 }}>− {eur(melGestionMensuel)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Provision entretien / travaux</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(melEntretienMensuel)}</span>
          </div>
          <div className="flex justify-between pt-2 mt-1" style={{ borderTop: `1px solid ${T.border}` }}>
            <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net mensuel (avant impôt)</span>
            <span style={{ color: melCashflowAvantImpot >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 16 }}>
              {melCashflowAvantImpot >= 0 ? "+ " : "− "}{eur(Math.abs(Math.round(melCashflowAvantImpot)))}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.muted }}>Impôt + prélèvements sociaux (mensualisé)</span>
            <span style={{ color: T.red, fontWeight: 700 }}>− {eur(Math.round(melImpotMensuel))}</span>
          </div>
          <div className="flex justify-between pt-2 mt-1" style={{ borderTop: `1px solid ${T.border}` }}>
            <span style={{ color: T.text, fontWeight: 800 }}>Cash-flow net mensuel (après impôt)</span>
            <span style={{ color: melCashflowApresImpot >= 0 ? T.green : T.red, fontWeight: 800, fontSize: 18 }}>
              {melCashflowApresImpot >= 0 ? "+ " : "− "}{eur(Math.abs(Math.round(melCashflowApresImpot)))}
            </span>
          </div>
        </div>
        <div className="text-xs mt-4 pt-3" style={{ color: T.muted, borderTop: `1px solid ${T.border}`, lineHeight: 1.6 }}>
          Estimation simplifiée — le régime réel ne déduit ici que les charges courantes (hors intérêts d'emprunt et amortissement LMNP), ce qui peut sous-estimer son avantage. Consultez l'onglet <b>Fiscalité → Revenus locatifs</b> ou un expert-comptable pour affiner.
        </div>
      </Card>

      {/* Location nue vs meublée */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} style={{ color: T.green }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Location nue vs meublée (LMNP)</h2>
        </div>
        <Field label={<>Majoration du loyer en meublé ({melLoyerMeubleMajorationPct} % = {eur(melLoyerMeuble)}/mois)<InfoTooltip text="Un bien loué meublé se loue généralement 10 à 20 % plus cher qu'un bien loué nu, en contrepartie de l'achat et de l'entretien du mobilier." align="left" /></>}>
          <input type="range" min={0} max={30} step={1} value={melLoyerMeubleMajorationPct} onChange={(e) => setMelLoyerMeubleMajorationPct(+e.target.value)}
            className="w-full" style={{ accentColor: T.green }} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-sm font-semibold" style={{ color: T.text }}>Location nue</div>
              {!melMeuble && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: T.muted + "22", color: T.muted }}>
                  Configuration actuelle
                </span>
              )}
            </div>
            <div className="text-xs mb-3" style={{ color: T.muted }}>{melRegimeNuComparaison === "micro" ? "Micro-foncier — abattement 30 %" : "Régime réel — déduction des charges"}</div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: T.muted }}>Loyer (vacance déduite)</span>
              <span style={{ color: T.text }}>{eur(Math.round(melScenarioNu.loyerMensuelEffectif))}/mois</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: T.muted }}>Impôt + prélèvements sociaux</span>
              <span style={{ color: T.red }}>− {eur(Math.round(melScenarioNu.impotMensuel))}/mois</span>
            </div>
            <div className="flex justify-between pt-2 mt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net</span>
              <span style={{ color: melScenarioNu.cashflowApresImpot >= 0 ? T.green : T.red, fontWeight: 800 }}>
                {melScenarioNu.cashflowApresImpot >= 0 ? "+ " : "− "}{eur(Math.abs(Math.round(melScenarioNu.cashflowApresImpot)))}
              </span>
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "rgba(34,199,154,0.04)", border: `1px solid ${T.green}33` }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-sm font-semibold" style={{ color: T.text }}>Location meublée</div>
              {melMeuble && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: T.green + "22", color: T.green }}>
                  Configuration actuelle
                </span>
              )}
            </div>
            <div className="text-xs mb-3" style={{ color: T.muted }}>Micro-BIC — abattement 50 %</div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: T.muted }}>Loyer (vacance déduite)</span>
              <span style={{ color: T.text }}>{eur(Math.round(melScenarioMeuble.loyerMensuelEffectif))}/mois</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: T.muted }}>Impôt + prélèvements sociaux</span>
              <span style={{ color: T.red }}>− {eur(Math.round(melScenarioMeuble.impotMensuel))}/mois</span>
            </div>
            <div className="flex justify-between pt-2 mt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Cash-flow net</span>
              <span style={{ color: melScenarioMeuble.cashflowApresImpot >= 0 ? T.green : T.red, fontWeight: 800 }}>
                {melScenarioMeuble.cashflowApresImpot >= 0 ? "+ " : "− "}{eur(Math.abs(Math.round(melScenarioMeuble.cashflowApresImpot)))}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: melDeltaMeuble >= 0 ? "rgba(34,199,154,0.06)" : "rgba(255,90,95,0.06)", border: `1px solid ${melDeltaMeuble >= 0 ? T.green + "44" : T.red + "44"}` }}>
          <span style={{ color: melDeltaMeuble >= 0 ? T.green : T.red }}>
            {melDeltaMeuble >= 0
              ? `La location meublée améliore le cash-flow net de ${eur(Math.round(melDeltaMeuble))}/mois grâce à l'abattement de 50 % (vs 30 % en nu).`
              : `Avec cette majoration de loyer, la location nue reste plus avantageuse de ${eur(Math.round(-melDeltaMeuble))}/mois.`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: T.text }}>Meublé</div>
            <ul className="text-xs flex flex-col gap-1" style={{ color: T.muted }}>
              <li><span style={{ color: T.green }}>+</span> Loyer plus élevé (+10 à 20 %)</li>
              <li><span style={{ color: T.green }}>+</span> Fiscalité plus douce (micro-BIC 50 %, amortissement en réel LMNP)</li>
              <li><span style={{ color: T.green }}>+</span> Bail court (1 an, 9 mois étudiant) → récupération du bien plus rapide</li>
              <li><span style={{ color: T.red }}>−</span> Achat puis renouvellement du mobilier</li>
              <li><span style={{ color: T.red }}>−</span> Turnover locataire plus fréquent (vacance, états des lieux)</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: T.text }}>Nu</div>
            <ul className="text-xs flex flex-col gap-1" style={{ color: T.muted }}>
              <li><span style={{ color: T.green }}>+</span> Locataire plus stable (bail 3 ans)</li>
              <li><span style={{ color: T.green }}>+</span> Aucun investissement ni renouvellement de mobilier</li>
              <li><span style={{ color: T.green }}>+</span> Gestion plus légère au quotidien</li>
              <li><span style={{ color: T.red }}>−</span> Loyer généralement plus faible</li>
              <li><span style={{ color: T.red }}>−</span> Fiscalité moins favorable (abattement 30 % seulement)</li>
              <li><span style={{ color: T.red }}>−</span> Préavis et bail long (3 ans) → récupération du bien plus lente</li>
            </ul>
          </div>
        </div>

        <div className="text-xs mt-3" style={{ color: T.muted, lineHeight: 1.6 }}>
          Le statut LMNP au régime réel permet en plus d'amortir le bien et le mobilier, ce qui réduit encore l'impôt — non modélisé ici par souci de simplicité. Le micro-BIC (abattement 50 %) suppose des recettes locatives annuelles inférieures à 77 700 €.
        </div>
      </Card>
      </>
      )}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ÉCRAN : PROFIL                                                     */
/* ------------------------------------------------------------------ */

/* Redimensionne une image (≤ maxPx) en blob JPEG pour limiter le poids stocké. */
function downscaleImage(file, maxPx = 512) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression échouée"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
    img.src = url;
  });
}

function Profil({ profile, setProfile, onInject, setTransactions, plan = "free", setView }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const initials = ((profile.firstName?.[0] || "") + (profile.lastName?.[0] || "")).toUpperCase() || "?";

  // Pré-remplit l'email avec celui du compte (l'adresse renseignée à l'inscription).
  useEffect(() => {
    if (!supabase || profile.email) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setProfile((p) => ({ ...p, email: data.user.email }));
    });
  }, []);

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-choisir le même fichier
    if (!file) return;
    if (!supabase) { alert("Connexion requise pour ajouter une photo."); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("Connectez-vous pour ajouter une photo."); return; }
      const blob = await downscaleImage(file, 512);
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-bust : force l'<img> à recharger la nouvelle version
      setProfile((p) => ({ ...p, avatar: `${data.publicUrl}?t=${Date.now()}` }));
    } catch (err) {
      alert("Échec de l'envoi de la photo : " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-3xl font-bold" style={{ color: T.text }}>Profil</h1>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Changer la photo de profil"
            aria-label="Changer la photo de profil"
            style={{ position: "relative", width: 64, height: 64, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, background: "rgba(139,92,246,0.15)" }}
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="Photo de profil"
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block" }} />
            ) : (
              <span className="flex items-center justify-center text-2xl font-bold"
                style={{ width: 64, height: 64, color: T.blue }}>{initials}</span>
            )}
            {/* badge d'upload en bas à droite */}
            <span style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: T.blue, border: `2px solid ${T.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {uploading
                ? <RefreshCw size={12} color="#fff" className="animate-spin" />
                : <Upload size={12} color="#fff" />}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: "none" }} />
          <div>
            <div className="text-lg font-bold" style={{ color: T.text }}>{profile.pseudo || profile.firstName || profile.email || "—"}</div>
            <div className="flex gap-2 mt-2">
              <span className="px-3 py-1 rounded-lg text-xs" style={{ border: `1px solid ${T.border}`, color: T.muted }}>
                {profile.age} ans</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Prénom">
            <input value={profile.firstName} placeholder="Votre prénom" style={inputStyle}
              onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} />
          </Field>
          <Field label="Nom">
            <input value={profile.lastName} placeholder="Votre nom" style={inputStyle}
              onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Pseudo">
            <input value={profile.pseudo || ""} placeholder="Votre pseudo" style={inputStyle}
              onChange={(e) => setProfile((p) => ({ ...p, pseudo: e.target.value }))} />
          </Field>
          <Field label="Mon adresse email">
            <input value={profile.email || ""} readOnly disabled
              style={{ ...inputStyle, opacity: 0.7, cursor: "not-allowed" }}
              title="Adresse de connexion — non modifiable ici" />
          </Field>
        </div>
        <Field label="Âge actuel">
          <input type="number" value={profile.age}
            onChange={(e) => setProfile((p) => ({ ...p, age: +e.target.value || 0 }))} style={inputStyle} />
        </Field>
        <p className="text-sm mt-2" style={{ color: T.muted }}>
          Utilisé pour calculer votre âge FIRE estimé dans les simulations.
        </p>
        <button
          className="mt-4 px-5 py-3 rounded-xl font-semibold"
          style={{ background: profileSaved ? T.green : T.blue, color: "#fff", transition: "background 0.3s" }}
          onClick={() => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000); }}
        >
          {profileSaved ? "✓ Sauvegardé" : "Enregistrer les modifications"}
        </button>
      </Card>

      {/* Préférences de l'app */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Préférences de l'app</h2>
        </div>
        {(() => {
          const coupleAllowed = plan === "couple";
          const on = profile.coupleMode && coupleAllowed;
          return (
        <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <div className="font-medium text-sm flex items-center gap-2" style={{ color: T.text }}>
              Mode Couple / Famille
              {!coupleAllowed && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                  Plan Couple
                </span>
              )}
            </div>
            <div className="text-xs mt-1" style={{ color: T.muted }}>
              {coupleAllowed
                ? "Affiche l'onglet de gestion patrimoniale commune dans la navigation"
                : (
                  <>Réservé au plan Couple.{" "}
                    <button onClick={() => setView?.("pricing")} style={{ background: "none", border: "none", padding: 0, color: "#a855f7", fontWeight: 700, cursor: "pointer", fontSize: "inherit" }}>
                      Passer à Couple →
                    </button>
                  </>
                )}
            </div>
          </div>
          <button
            onClick={() => { if (coupleAllowed) setProfile((p) => ({ ...p, coupleMode: !p.coupleMode })); else setView?.("pricing"); }}
            aria-disabled={!coupleAllowed}
            title={coupleAllowed ? "" : "Disponible avec le plan Couple"}
            style={{
              position: "relative", flexShrink: 0,
              width: 44, height: 24, borderRadius: 12,
              background: on ? T.blue : "rgba(255,255,255,0.12)",
              border: "none", cursor: "pointer", transition: "background 0.25s",
              opacity: coupleAllowed ? 1 : 0.5,
            }}
          >
            <span style={{
              position: "absolute", top: 3,
              left: on ? 23 : 3,
              width: 18, height: 18, borderRadius: "50%",
              background: "#fff", transition: "left 0.25s",
              display: "block",
            }} />
          </button>
        </div>
          );
        })()}
      </Card>


    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ÉCRAN : PATRIMOINE                                                 */
/* ------------------------------------------------------------------ */
function Patrimoine({ patrimoine, setPatrimoine }) {
  const T = useT();
  const chartTip = makeChartTip(T);
  const [editMode, setEditMode] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const [histRange, setHistRange] = useState(12);
  const inp = { background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, outline: "none" };
  const netWorthFlashRef = useRef(null);

  const totalActifs = patrimoine.actifs.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.value, 0), 0);
  const totalPassifs = patrimoine.passifs.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.value, 0), 0);
  const netWorth = totalActifs - totalPassifs;
  const hist = useMemo(() => ensureHistoriqueDepth(patrimoine.historique, 36), [patrimoine.historique]);
  const prevNW = hist.length >= 2 ? hist[hist.length - 2].v : netWorth;
  const monthlyChange = netWorth - prevNW;
  const chartHist = hist.slice(-histRange);

  // Endettement = passifs / actifs
  const debtRatio = totalActifs > 0 ? (totalPassifs / totalActifs) * 100 : 0;
  const debtColor = debtRatio > 50 ? T.red : debtRatio > 30 ? T.amber : T.green;

  // Catégorie d'actif dominante
  const actifCatTotals = patrimoine.actifs.map((c) => ({ ...c, total: c.items.reduce((s, i) => s + i.value, 0) }));
  const topActifCat = actifCatTotals.reduce((a, b) => (b.total > (a?.total || 0) ? b : a), null);
  const topActifShare = topActifCat && totalActifs > 0 ? (topActifCat.total / totalActifs) * 100 : 0;

  // Croissance sur la période sélectionnée
  const firstNW = chartHist[0]?.v ?? netWorth;
  const growthTotalAbs = netWorth - firstNW;
  const growthTotalPct = firstNW !== 0 ? (growthTotalAbs / firstNW) * 100 : 0;

  // "Investissements" toujours en cyan (cohérent avec le reste de l'app),
  // même si une ancienne couleur est restée enregistrée en local.
  const catColor = (cat) => cat.id === "investissements" ? T.cyan : cat.color;

  const allSlices = [
    ...patrimoine.actifs.map((c) => ({ name: c.label, value: c.items.reduce((s, i) => s + i.value, 0), color: catColor(c) })),
    ...patrimoine.passifs.map((c) => ({ name: c.label, value: c.items.reduce((s, i) => s + i.value, 0), color: c.color })),
  ].filter((s) => s.value > 0);
  const totalSlices = allSlices.reduce((s, x) => s + x.value, 0);

  const tableRows = chartHist.map((row, idx) => {
    const prev = idx > 0 ? chartHist[idx - 1].v : row.v;
    const variation = idx > 0 ? row.v - prev : 0;
    const pctVal = prev > 0 && idx > 0 ? (variation / prev) * 100 : 0;
    return { m: row.m, v: row.v, variation, pct: pctVal };
  });

  const updateItem = (side, catId, idx, changes) =>
    setPatrimoine((p) => ({
      ...p,
      [side]: p[side].map((cat) =>
        cat.id === catId
          ? { ...cat, items: cat.items.map((it, i) => i === idx ? { ...it, ...changes } : it) }
          : cat
      ),
    }));

  const deleteItem = (side, catId, idx) =>
    setPatrimoine((p) => ({
      ...p,
      [side]: p[side].map((cat) =>
        cat.id === catId ? { ...cat, items: cat.items.filter((_, i) => i !== idx) } : cat
      ),
    }));

  const addItem = (side, catId) =>
    setPatrimoine((p) => ({
      ...p,
      [side]: p[side].map((cat) =>
        cat.id === catId
          ? { ...cat, items: [...cat.items, { label: "Nouvel actif", value: 0, currency: "EUR", valueNative: 0 }] }
          : cat
      ),
    }));

  const toggle = (id) => setOpenCats((s) => ({ ...s, [id]: !s[id] }));

  const renderCategory = (cat, side) => {
    const isPassif = side === "passifs";
    const isDerived = cat.id === "credits-derived"; // alimentée par "Mes crédits" — lecture seule
    const total = cat.items.reduce((s, i) => s + (i.value || 0), 0);
    const isOpen = !!openCats[cat.id];
    return (
      <div key={cat.id} className="mb-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
        <button className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.02)" }} onClick={() => toggle(cat.id)}>
          <span className="flex items-center gap-2 font-semibold text-sm" style={{ color: T.text }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor(cat) }} />
            {cat.label}
          </span>
          <span className="flex items-center gap-3">
            <span className="font-bold text-sm" style={{ color: isPassif ? T.red : catColor(cat) }}>
              {isPassif ? "−" : ""}{eur(total)}
            </span>
            <span style={{ color: T.muted, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
          </span>
        </button>
        {isOpen && (
          <div className="px-4 pb-3 pt-1" style={{ background: "rgba(255,255,255,0.01)" }}>
            {cat.items.length === 0 && (
              <p className="text-sm py-2" style={{ color: T.muted }}>Aucun élément</p>
            )}
            {isDerived && (
              <p className="text-xs py-1" style={{ color: T.muted }}>
                Alimenté automatiquement par <b style={{ color: T.text }}>Mes crédits</b> — modifiez-les là-bas.
              </p>
            )}
            {cat.items.map((item, idx) => (
              <div key={idx} className="py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                {editMode && !isDerived ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      value={item.label}
                      onChange={e => updateItem(side, cat.id, idx, { label: e.target.value })}
                      style={{ ...inp, width: 160, padding: "4px 10px", fontSize: 13 }}
                    />
                    <select
                      value={item.currency || "EUR"}
                      onChange={e => {
                        const cur = e.target.value;
                        const native = item.valueNative ?? item.value;
                        updateItem(side, cat.id, idx, { currency: cur, valueNative: native, value: Math.round(toEUR(native, cur)) });
                      }}
                      style={{ ...inp, width: 75, padding: "4px 8px", fontSize: 12 }}
                    >
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="number"
                      value={item.valueNative ?? item.value}
                      onChange={e => {
                        const native = +e.target.value || 0;
                        const cur = item.currency || "EUR";
                        updateItem(side, cat.id, idx, { valueNative: native, value: Math.round(toEUR(native, cur)) });
                      }}
                      style={{ ...inp, width: 120, padding: "4px 10px", fontSize: 13 }}
                    />
                    {(item.currency && item.currency !== "EUR") && (
                      <span style={{ fontSize: 12, color: T.muted }}>= {eur(item.value)}</span>
                    )}
                    <button onClick={() => deleteItem(side, cat.id, idx)} aria-label="Supprimer la ligne"
                      style={{ background: "none", border: "1px solid rgba(255,90,95,0.3)", borderRadius: 10, minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.red, marginLeft: "auto" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: T.muted }}>{item.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-sm" style={{ color: T.text }}>
                        {isPassif ? "−" : ""}{eur(item.value)}
                      </span>
                      {item.currency && item.currency !== "EUR" && (
                        <div style={{ fontSize: 12, color: T.muted }}>{(item.valueNative ?? item.value).toLocaleString("fr-FR")} {item.currency}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {editMode && !isDerived && (
              <button onClick={() => addItem(side, cat.id)}
                className="flex items-center gap-2 mt-2 text-sm"
                style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", padding: "4px 0" }}>
                <Plus size={14} /> Ajouter un élément
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>Patrimoine</h1>
          <p style={{ color: T.muted }}>Suivi de votre richesse nette — net worth</p>
        </div>
        <button onClick={() => setEditMode((e) => !e)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium"
          style={{
            border: `1px solid ${editMode ? T.green : T.border}`,
            color: editMode ? T.green : T.muted,
            background: editMode ? "rgba(34,199,154,0.08)" : "rgba(255,255,255,0.03)",
          }}>
          {editMode ? <Lock size={16} /> : <Sun size={16} />}
          {editMode ? "Verrouiller" : "Mode édition"}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Patrimoine net"
          value={<GrowthValue value={netWorth} formatter={eur} flashRef={netWorthFlashRef} />}
          valueColor={netWorth >= 0 ? T.green : T.red}
          flashRef={netWorthFlashRef}
          sub={<>
            {monthlyChange >= 0
              ? <ArrowUpRight size={14} style={{ color: T.green }} />
              : <ArrowDownRight size={14} style={{ color: T.red }} />}
            <span className="font-semibold" style={{ color: monthlyChange >= 0 ? T.green : T.red }}>
              {monthlyChange >= 0 ? "+" : ""}{eur(monthlyChange)}
            </span>
            <span style={{ color: T.muted }}>vs mois précédent</span>
          </>}
        />
        <KpiCard
          label="Total actifs"
          value={eur(totalActifs)}
          valueColor={T.green}
          sub={topActifCat ? <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: topActifCat.color }} />
            <span style={{ color: T.text }}>{topActifCat.label}</span>
            <span style={{ color: T.muted }}>· {pct(topActifShare)} du total</span>
          </> : <span style={{ color: T.muted }}>Aucun actif</span>}
        />
        <KpiCard
          label="Total passifs"
          value={"−" + eur(totalPassifs)}
          valueColor={T.red}
          sub={<>
            <span className="font-semibold" style={{ color: debtColor }}>{pct(debtRatio)}</span>
            <span style={{ color: T.muted }}>des actifs (endettement)</span>
          </>}
        />
        <KpiCard
          label={`Croissance depuis ${chartHist[0]?.m || ""}`}
          value={(growthTotalPct >= 0 ? "+" : "") + pct(growthTotalPct)}
          valueColor={growthTotalPct >= 0 ? T.green : T.red}
          sub={<>
            {growthTotalAbs >= 0
              ? <ArrowUpRight size={14} style={{ color: T.green }} />
              : <ArrowDownRight size={14} style={{ color: T.red }} />}
            <span className="font-semibold" style={{ color: growthTotalAbs >= 0 ? T.green : T.red }}>
              {growthTotalAbs >= 0 ? "+" : ""}{eur(growthTotalAbs)}
            </span>
            <span style={{ color: T.muted }}>net worth</span>
          </>}
        />
      </div>

      {/* Évolution + Répartition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold" style={{ color: T.text }}>Évolution du patrimoine</h2>
                <Badge tone={growthTotalPct >= 0 ? "green" : "red"}
                  icon={growthTotalPct >= 0 ? ArrowUpRight : ArrowDownRight}
                  label={`${growthTotalPct >= 0 ? "+" : ""}${pct(growthTotalPct)}`} />
              </div>
              <p className="text-sm" style={{ color: T.muted }}>Net worth sur la période sélectionnée</p>
            </div>
            <select value={histRange} onChange={(e) => setHistRange(+e.target.value)}
              style={{ ...inp, padding: "6px 14px", fontSize: 12, borderRadius: 9999, cursor: "pointer" }}>
              <option value={3}>3 derniers mois</option>
              <option value={6}>6 derniers mois</option>
              <option value={12}>12 derniers mois</option>
              <option value={24}>2 ans</option>
              <option value={36}>3 ans</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartHist}>
              <defs>
                <linearGradient id="gradNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.violet} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.violet} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="m" stroke={T.muted} tick={{ fontSize: 12 }} interval={histRange > 12 ? 2 : 0} />
              <YAxis stroke={T.muted} tick={{ fontSize: 12 }}
                tickFormatter={(v) => (Math.abs(v) >= 1000 ? Math.round(v / 1000) + "k€" : v)} />
              <Tooltip {...chartTip} formatter={(v) => eur(v)} />
              <Area type="monotone" dataKey="v" name="Net Worth" stroke={T.violet} strokeWidth={2.5}
                fill="url(#gradNW)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold" style={{ color: T.text }}>Répartition</h2>
              <Badge tone="neutral" label={`${allSlices.length} catégories`} />
            </div>
            <p className="text-sm" style={{ color: T.muted }}>Actifs vs passifs par catégorie</p>
          </div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={allSlices} dataKey="value" nameKey="name"
                  innerRadius={62} outerRadius={92} paddingAngle={2}
                  label={renderDonutPctLabel} labelLine={false}>
                  {allSlices.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip {...chartTip} itemStyle={{ color: T.text }} formatter={(v) => eur(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 24 }}>
              <span className="text-xs" style={{ color: T.muted }}>Net Worth</span>
              <span className="text-lg font-bold" style={{ color: netWorth >= 0 ? T.green : T.red }}>{eur(netWorth)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3 justify-center">
            {allSlices.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                {s.name}
                <span style={{ color: T.text, fontWeight: 600 }}>{pct(totalSlices > 0 ? (s.value / totalSlices) * 100 : 0)}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Détail par catégorie */}
      <Card>
        <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>Détail par catégorie</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: T.green, letterSpacing: 1 }}>ACTIFS</div>
            {patrimoine.actifs.map((cat) => renderCategory(cat, "actifs"))}
          </div>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: T.red, letterSpacing: 1 }}>PASSIFS</div>
            {patrimoine.passifs.map((cat) => renderCategory(cat, "passifs"))}
          </div>
        </div>
      </Card>

      {/* Comparison table */}
      <Card>
        <div className="mb-4">
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Comparaison mois par mois</h2>
          <p className="text-sm" style={{ color: T.muted }}>Sur la période sélectionnée ci-dessus</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Mois", "Net Worth", "Variation", "% Croissance"].map((h) => (
                  <th key={h} className="py-3 px-3 text-left font-semibold" style={{ color: T.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={row.m} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td className="py-3 px-3" style={{ color: T.text }}>{row.m}</td>
                  <td className="py-3 px-3 font-bold" style={{ color: T.text }}>{eur(row.v)}</td>
                  <td className="py-3 px-3 font-semibold"
                    style={{ color: idx === 0 ? T.muted : row.variation >= 0 ? T.green : T.red }}>
                    {idx === 0 ? "—" : (row.variation > 0 ? "+" : "") + eur(row.variation)}
                  </td>
                  <td className="py-3 px-3 font-semibold"
                    style={{ color: idx === 0 ? T.muted : row.pct >= 0 ? T.green : T.red }}>
                    {idx === 0 ? "—" : (row.pct > 0 ? "+" : "") + pct(row.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ALERTES IN-APP — bannières dismissibles basées sur les données    */
/* ------------------------------------------------------------------ */
function AlertsBanner({ totals, patrimoine, dismissed, onDismiss, incomeRef = totals.revenus, incomeIsSmoothed = false }) {
  const totalActifs  = (patrimoine?.actifs  || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
  const totalPassifs = (patrimoine?.passifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);

  const alerts = useMemo(() => {
    const out = [];
    if (totals.tauxEpargne < SAVINGS_RATE_CRITICAL)
      out.push({ id: "critical_savings", level: "red",   msg: `Taux d'épargne critique (${totals.tauxEpargne.toFixed(1)}%) — sous le seuil recommandé de ${SAVINGS_RATE_CRITICAL}%. Réduisez une charge fixe ce mois.` });
    else if (totals.tauxEpargne < SAVINGS_RATE_TARGET)
      out.push({ id: "low_savings",      level: "amber", msg: `Taux d'épargne de ${totals.tauxEpargne.toFixed(1)}% — objectif : ${SAVINGS_RATE_TARGET}%. Chaque % gagné compte sur 20 ans.` });
    if (totals.restant < 0)
      out.push({ id: "deficit",          level: "red",   msg: `Déficit mensuel de ${eur(Math.abs(totals.restant))} — vous dépensez plus que vous ne gagnez ce mois.` });
    if (totalPassifs > totalActifs * 0.5 && totalActifs > 0)
      out.push({ id: "high_debt",        level: "amber", msg: `Endettement élevé (${Math.round((totalPassifs / totalActifs) * 100)}% de vos actifs) — priorisez le remboursement des crédits.` });
    if (incomeRef > 0 && totals.chargesFixes > incomeRef * 0.6)
      out.push({ id: "heavy_charges",    level: "amber", msg: `Charges fixes très lourdes (${Math.round((totals.chargesFixes / incomeRef) * 100)}% des revenus${incomeIsSmoothed ? ", moyenne 12 mois" : ""}) — peu de marge de manœuvre.` });
    return out.filter(a => !dismissed.includes(a.id));
  }, [totals, totalActifs, totalPassifs, dismissed, incomeRef, incomeIsSmoothed]);

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {alerts.map(a => (
        <div key={a.id} style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 12,
          background: a.level === "red" ? "rgba(255,90,95,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${a.level === "red" ? "rgba(255,90,95,0.25)" : "rgba(245,158,11,0.25)"}`,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><AlertLevelIcon level={a.level} size={15} /></span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>{a.msg}</span>
          </div>
          <button onClick={() => onDismiss(a.id)}
            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: "0 2px", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ONBOARDING — wizard de première connexion                         */
/* ------------------------------------------------------------------ */
function OnboardingWizard({ profile, setProfile, setTransactions, onDone }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const [step, setStep]         = useState(0);
  const [prenom, setPrenom]     = useState("");
  const [age, setAge]           = useState(30);
  const [revenus, setRevenus]   = useState(3000);
  const [loyer, setLoyer]       = useState(800);
  const [epargne, setEpargne]   = useState(300);

  const steps = [
    { title: "Bienvenue sur WealthTrack", sub: "Quelques infos pour personnaliser votre expérience" },
    { title: "Vos revenus & charges",     sub: "Ces données restent sur votre appareil" },
    { title: "Votre épargne",             sub: "On calcule votre potentiel d'indépendance financière" },
  ];

  const finish = () => {
    setProfile(p => ({ ...p, firstName: prenom, age: Math.min(100, Math.max(16, +age || 30)) }));
    const ts = Date.now();
    setTransactions([
      { id: ts+1, label: "Salaire / Revenus",  cat: "Freelance",    type: "revenu",            amount:  revenus,  recurring: true },
      { id: ts+2, label: "Loyer / Logement",   cat: "Logement",     type: "charge_fixe",       amount: -loyer,    recurring: true },
      { id: ts+3, label: "Épargne mensuelle",  cat: "Épargne",      type: "investissement",    amount: -epargne,  recurring: true },
    ]);
    onDone();
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
  const modal   = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 24, padding: "36px 40px", width: "100%", maxWidth: 480 };
  const inpO    = { ...inputStyle, marginTop: 6 };

  return (
    <div className="wt-fade-in" style={overlay}>
      <div className="wt-scale-in" style={modal}>
        {/* Progress dots + skip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ height: 4, flex: 1, borderRadius: 4, background: i <= step ? T.blue : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
            ))}
          </div>
          <button onClick={onDone} style={{ fontSize: 12, color: T.muted, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", padding: "2px 4px" }}>
            Passer ›
          </button>
        </div>
        <h2 style={{ color: T.text, fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{steps[step].title}</h2>
        <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>{steps[step].sub}</p>

        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Votre prénom</label>
              <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie" style={inpO} /></div>
            <div><label style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Votre âge</label>
              <input type="number" min={16} max={100} value={age}
                onChange={e => setAge(e.target.value === "" ? "" : Math.min(100, +e.target.value || 0))}
                onBlur={e => setAge(Math.min(100, Math.max(16, +e.target.value || 16)))} style={inpO} /></div>
          </div>
        )}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Revenus mensuels nets (€)</label>
              <input type="number" min={0} value={revenus} onChange={e => setRevenus(Math.max(0, +e.target.value || 0))} style={inpO} /></div>
            <div><label style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Loyer / charge principale (€/mois)</label>
              <input type="number" min={0} value={loyer} onChange={e => setLoyer(Math.max(0, +e.target.value || 0))} style={inpO} /></div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Épargne / investissement mensuel (€)</label>
              <input type="number" min={0} value={epargne} onChange={e => setEpargne(Math.max(0, +e.target.value || 0))} style={inpO} /></div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(91,141,239,0.07)", border: `1px solid ${T.blue}22` }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Votre potentiel à 20 ans (ETF {(RATE_A * 100).toFixed(1)}%/an)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>
                {eur(Math.round(fvMonthly(epargne, RATE_A, 20)))}
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6, display: "flex", alignItems: "flex-start", gap: 5 }}><AlertTriangle size={11} style={{ color: T.amber, flexShrink: 0, marginTop: 1 }} aria-hidden="true" /> <span>{RATE_DISCLAIMER}</span></div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
          {step > 0
            ? <button onClick={() => setStep(s => s - 1)} style={{ padding: "11px 20px", borderRadius: 12, border: `1px solid ${T.border}`, background: "none", color: T.muted, cursor: "pointer", fontWeight: 600 }}>Retour</button>
            : <div />}
          {step < steps.length - 1
            ? <button onClick={() => setStep(s => s + 1)} style={{ padding: "11px 24px", borderRadius: 12, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Continuer →</button>
            : <button onClick={finish} style={{ padding: "11px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#22c79a,#0070f3)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Démarrer →</button>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OBJECTIFS FINANCIERS                                               */
/* ------------------------------------------------------------------ */
const GOAL_ICONS = {
  apport: Home,
  urgence: Shield,
  voyage: Plane,
  retraite: Palmtree,
  voiture: Car,
  formation: GraduationCap,
  autre: Star,
};

const GOAL_PRESETS = [
  { name: "Apport immobilier", color: "#2f9bff", type: "apport" },
  { name: "Fonds d'urgence",   color: "#22c79a", type: "urgence" },
  { name: "Voyage",            color: "#f5a623", type: "voyage" },
  { name: "Retraite / IF",     color: "#a855f7", type: "retraite" },
  { name: "Voiture",           color: "#ec4899", type: "voiture" },
  { name: "Formation",         color: "#14b8a6", type: "formation" },
  { name: "Autre objectif",    color: "#6366f1", type: "autre" },
];

function ObjectifsView({ goals, setGoals, totals }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: "", icon: "autre", target: 10000, saved: 0, monthly: 200, color: "#6366f1" });

  const addGoal = () => {
    if (!newGoal.name.trim() || !newGoal.target) return;
    setGoals(gs => [...gs, { ...newGoal, id: Date.now() }]);
    setNewGoal({ name: "", icon: "autre", target: 10000, saved: 0, monthly: 200, color: "#6366f1" });
    setShowAdd(false);
  };

  const monthsLeft = (g) => {
    if (g.saved >= g.target) return 0;
    if (g.monthly <= 0) return null;
    return Math.ceil((g.target - g.saved) / g.monthly);
  };

  // Formate un nombre de mois en "X ans Y mois" (ou "X mois" si < 1 an)
  const formatMonths = (m) => {
    if (m == null) return "—";
    if (m === 0) return "Atteint";
    const years = Math.floor(m / 12);
    const rem = m % 12;
    if (years === 0) return `${rem} mois`;
    if (rem === 0) return `${years} an${years > 1 ? "s" : ""}`;
    return `${years} an${years > 1 ? "s" : ""} ${rem} mois`;
  };

  const inpG = { ...inputStyle, padding: "7px 12px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>Objectifs financiers</h1>
          <p style={{ color: T.muted }}>Suivez vos projets d'épargne et leur progression</p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold"
          style={{ background: T.blue, color: "#fff" }}>
          <Plus size={18} /> Nouvel objectif
        </button>
      </div>

      {showAdd && (
        <Card style={{ borderColor: `${T.blue}44` }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: T.muted }}>NOUVEL OBJECTIF</h2>
          {/* Presets */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {GOAL_PRESETS.map(p => {
              const PresetIcon = GOAL_ICONS[p.type];
              return (
                <button key={p.type} onClick={() => setNewGoal(g => ({ ...g, name: p.name, icon: p.type, color: p.color }))}
                  className="flex items-center gap-2"
                  style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${newGoal.name === p.name ? p.color : T.border}`, background: newGoal.name === p.name ? p.color + "22" : "rgba(255,255,255,0.03)", color: T.text, fontSize: 13, cursor: "pointer" }}>
                  <PresetIcon size={14} style={{ color: p.color }} /> {p.name}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom de l'objectif">
              <input value={newGoal.name} placeholder="Mon objectif" style={inpG} onChange={e => setNewGoal(g => ({ ...g, name: e.target.value }))} />
            </Field>
            <Field label="Montant cible (€)">
              <input type="number" value={newGoal.target} style={inpG} onChange={e => setNewGoal(g => ({ ...g, target: +e.target.value || 0 }))} />
            </Field>
            <Field label="Déjà épargné (€)">
              <input type="number" value={newGoal.saved} style={inpG} onChange={e => setNewGoal(g => ({ ...g, saved: +e.target.value || 0 }))} />
            </Field>
            <Field label="Versement mensuel (€)">
              <input type="number" value={newGoal.monthly} style={inpG} onChange={e => setNewGoal(g => ({ ...g, monthly: +e.target.value || 0 }))} />
            </Field>
          </div>
          <div className="flex gap-3 mt-3">
            <button onClick={addGoal} style={{ padding: "9px 20px", borderRadius: 12, border: "none", background: T.blue, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              <Check size={14} className="inline mr-1.5" /> Créer l'objectif
            </button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "9px 16px", borderRadius: 12, border: `1px solid ${T.border}`, background: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>Annuler</button>
          </div>
        </Card>
      )}

      {goals.length === 0 && !showAdd && (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Target size={40} style={{ color: T.muted, margin: "0 auto 12px" }} />
            <p style={{ color: T.text, fontWeight: 600, marginBottom: 6 }}>Aucun objectif défini</p>
            <p style={{ color: T.muted, fontSize: 13 }}>Créez votre premier objectif pour suivre votre progression.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct      = Math.min(100, g.target > 0 ? (g.saved / g.target) * 100 : 0);
          const months   = monthsLeft(g);
          const done     = g.saved >= g.target;
          const dateEst  = months != null && !done
            ? (() => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); })()
            : null;
          const GoalIcon = GOAL_ICONS[g.icon] || Star;

          return (
            <Card key={g.id} style={{ borderColor: done ? `${T.green}44` : `${g.color}33` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${g.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <GoalIcon size={18} style={{ color: g.color }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: T.text, fontSize: 15 }}>{g.name}</div>
                    {done
                      ? <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Objectif atteint !</div>
                      : <div style={{ fontSize: 12, color: T.muted }}>{dateEst ? `Estimé : ${dateEst}` : months == null ? "Définissez un versement mensuel" : ""}</div>}
                  </div>
                </div>
                <button onClick={() => setGoals(gs => gs.filter(x => x.id !== g.id))} aria-label="Supprimer l'objectif"
                  style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 10 }}>
                <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: done ? T.green : g.color }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: T.muted }}>
                  <span>{eur(g.saved)} épargné</span>
                  <span style={{ fontWeight: 700, color: g.color }}>{pct.toFixed(0)}%</span>
                  <span>sur {eur(g.target)}</span>
                </div>
              </div>

              {/* Métriques */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
                <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Reste à épargner</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{eur(Math.max(0, g.target - g.saved))}</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Versement mensuel</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: g.color }}>{eur(g.monthly)}</div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Temps restant</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: done ? T.green : T.text }}>{done ? "Atteint ✓" : formatMonths(months)}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FIRE INFO MODAL                                                    */
/* ------------------------------------------------------------------ */
function FIREInfoModal({ onClose }) {
  const T = useT();
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="wt-fade-in"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="wt-scale-in"
        style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 24, padding: "36px 40px", width: "100%", maxWidth: 560, position: "relative" }}
      >
        {/* Close */}
        <button onClick={onClose} aria-label="Fermer" style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: "#6b7280", cursor: "pointer", lineHeight: 1, minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={20} /></button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Flame size={24} style={{ color: "#f59e0b" }} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ color: T.text, fontWeight: 800, fontSize: 22, margin: 0 }}>FIRE</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Financial Independence, Retire Early</p>
          </div>
        </div>

        {/* Définition */}
        <p style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          Le mouvement <strong style={{ color: T.text }}>FIRE</strong> repose sur une idée simple : accumuler suffisamment de capital pour que les rendements passifs couvrent vos dépenses à vie — vous permettant d'arrêter de travailler quand <em>vous</em> le décidez, pas à 65 ans.
        </p>

        <button
          onClick={onClose}
          style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15, background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Flame size={16} /> Calculer mon objectif FIRE
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APP                                                                */
/* ------------------------------------------------------------------ */
export default function App() {
  const T = useT();
  const [showApp,    setShowApp]    = useState(false);
  const [view,       setView]       = useState("dashboard");
  const [plan,       setPlan]       = useLocalStorage("wt_plan", "free");

  // ── Plan : SOURCE DE VÉRITÉ = table `subscriptions` (écrite par le seul
  //    webhook Stripe). On NE FAIT JAMAIS confiance à l'URL ni au localStorage
  //    pour accorder un plan payant. `wt_plan` ne sert que de cache d'affichage,
  //    systématiquement écrasé par la valeur DB ci-dessous.
  const hydratePlanFromDb = useCallback(async () => {
    if (!supabase) return; // dev local sans Supabase : reste sur le cache
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPlan("free"); return; }
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return; // en cas d'erreur réseau on garde l'état courant
    const active = data && ["active", "trialing", "past_due"].includes(data.status);
    setPlan(active ? data.plan : "free");
  }, [setPlan]);

  // Hydrate au montage + à chaque changement d'auth (login/logout).
  useEffect(() => {
    hydratePlanFromDb();
    if (!supabase) return;
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(() => hydratePlanFromDb());
    return () => subscription?.unsubscribe();
  }, [hydratePlanFromDb]);

  // Retour Stripe Checkout → ?payment=success (DRAPEAU D'UX UNIQUEMENT, n'accorde
  // aucun droit). Le webhook a — ou va — écrire le plan ; on re-lit la DB, avec
  // quelques tentatives le temps que l'événement Stripe arrive.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setView("dashboard");
      window.history.replaceState({}, "", window.location.pathname);
      let n = 0;
      const id = setInterval(() => {
        hydratePlanFromDb();
        if (++n >= 5) clearInterval(id); // ~5 tentatives sur 10 s
      }, 2000);
      return () => clearInterval(id);
    } else if (params.get("view") === "pricing") {
      setView("pricing");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [hydratePlanFromDb]);

  const [transactions, setTransactions] = useLocalStorage("wt_transactions", TX);
  const [histo,      setHisto]      = useLocalStorage("wt_histo", HISTO);
  const [profile,    setProfile]    = useLocalStorage("wt_profile", { firstName: "", lastName: "", age: 32, email: "", coupleMode: false });
  const [simParams,  setSimParams]  = useLocalStorage("wt_simParams", { monthly: 500, initial: 10000, price: 200000, horizon: 20 });
  const [patrimoine, setPatrimoine] = useLocalStorage("wt_patrimoine", DEFAULT_PATRIMOINE);
  const [credits,    setCredits]    = useLocalStorage("wt_credits", []);
  // Patrimoine enrichi : les crédits saisis alimentent les passifs (source unique),
  // sans dupliquer la saisie. La catégorie dérivée "Crédits" remplace toute version
  // précédemment injectée (id stable "credits-derived").
  const patrimoineDerived = useMemo(() => ({
    ...patrimoine,
    passifs: [
      ...(patrimoine.passifs || []).filter((c) => c.id !== "credits-derived"),
      ...(credits.length ? [creditsToPassifCategory(credits)] : []),
    ],
  }), [patrimoine, credits]);
  // Nouvelles features
  const [budgets,    setBudgets]    = useLocalStorage("wt_budgets", {});
  const [goals,      setGoals]      = useLocalStorage("wt_goals", []);
  const [dismissed,  setDismissed]  = useLocalStorage("wt_dismissed_alerts", []);
  const [onboarded,  setOnboarded]  = useLocalStorage("wt_onboarded", false);
  const [fireClicks, setFireClicks] = useLocalStorage("wt_fire_clicks", 0);
  const [showFIREModal, setShowFIREModal] = useState(false);
  const [trialPopupSeen, setTrialPopupSeen] = useLocalStorage("wt_trial_popup_seen", null);
  const [showTrialPopup, setShowTrialPopup] = useState(false);

  // Déclenche onboarding si pas encore fait ET prénom vide
  const showOnboarding = showApp && !onboarded && !profile.firstName;

  // Ouvre le modal FIRE pour les 10 premiers clics
  useEffect(() => {
    if (view === "fi" && fireClicks < 10) {
      setShowFIREModal(true);
      setFireClicks(n => n + 1);
    }
  }, [view]);

  useEffect(() => {
    if (view === "couple" && !profile.coupleMode) setView("dashboard");
  }, [profile.coupleMode]);

  // Popup essai gratuit : une fois par mois si plan Gratuit
  useEffect(() => {
    if (!showApp || plan !== "free") return;
    const last = trialPopupSeen ? new Date(trialPopupSeen).getTime() : 0;
    const now = Date.now();
    if (now - last > 30 * 24 * 60 * 60 * 1000) setShowTrialPopup(true);
  }, [showApp, plan]);

  const dismissTrialPopup = () => {
    setTrialPopupSeen(new Date().toISOString());
    setShowTrialPopup(false);
  };

  const injectProfile = (p) => {
    setTransactions(p.transactions);
    if (p.histo) setHisto(p.histo);
    setProfile({ ...p.profile, coupleMode: profile.coupleMode });
    setSimParams({ ...p.simParams });
    if (p.patrimoine) setPatrimoine(JSON.parse(JSON.stringify(p.patrimoine)));
    setView("dashboard");
  };

  const totals = useMemo(() => {
    const sum = (t) => transactions.filter((x) => x.type === t).reduce((s, x) => s + Math.abs(x.amount), 0);
    const revenus     = sum("revenu");
    const chargesFixes = sum("charge_fixe");
    const depensesVar = sum("depense_variable");
    const invest      = sum("investissement");
    const restant     = revenus - chargesFixes - depensesVar - invest;
    const conso       = chargesFixes + depensesVar;
    const tauxEpargne = revenus > 0 ? ((revenus - conso) / revenus) * 100 : 0;
    return { revenus, chargesFixes, depensesVar, invest, restant, tauxEpargne };
  }, [transactions]);

  // Revenu de référence : lissé (moyenne 12 mois) quand le revenu est variable
  // (intérim/freelance), sinon le mois courant. Sert aux ratios de capacité/effort.
  const incomeProfileType = useMemo(() => detectProfileType(transactions || []), [transactions]);
  const incomeIsSmoothed  = useMemo(() => isIncomeVariable(histo, incomeProfileType), [histo, incomeProfileType]);
  const incomeRef = useMemo(
    () => (incomeIsSmoothed ? Math.round(smoothedMonthlyIncome(histo, 12)) : totals.revenus),
    [incomeIsSmoothed, histo, totals.revenus]
  );

  const breakdown = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.amount < 0).forEach((t) => {
      map[t.cat] = (map[t.cat] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  /* ── Suivi du patrimoine dans le temps : snapshot mensuel auto ──────── */
  const [snapshots, setSnapshots] = useLocalStorage("wt_networth_snapshots", []);
  const netWorthNow = useMemo(() => {
    const a = (patrimoineDerived?.actifs  || []).flatMap(c => c.items).reduce((s, i) => s + (i.value || 0), 0);
    const p = (patrimoineDerived?.passifs || []).flatMap(c => c.items).reduce((s, i) => s + (i.value || 0), 0);
    return a - p;
  }, [patrimoineDerived]);
  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MOIS_ABBR[now.getMonth()]} ${now.getFullYear()}`;
    setSnapshots(prev => {
      const exists = prev.some(s => s.ym === ym);
      // Met à jour le mois courant à chaque changement ; crée le point au 1er passage du mois.
      if (exists) return prev.map(s => s.ym === ym ? { ...s, v: netWorthNow, label } : s);
      return [...prev, { ym, v: netWorthNow, label }].slice(-120); // garde 10 ans max
    });
  }, [netWorthNow]);

  // Snapshot mensuel automatique du revenu/dépenses dans l'historique (rend wt_histo vivant).
  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MOIS_ABBR[now.getMonth()]} ${now.getFullYear()}`;
    const entry = {
      m: label, ym,
      rev: totals.revenus,
      dep: totals.chargesFixes + totals.depensesVar,
      inv: totals.invest,
    };
    setHisto((prev) => {
      const exists = prev.some((h) => h.ym === ym);
      if (exists) return prev.map((h) => (h.ym === ym ? { ...h, ...entry } : h));
      return [...prev, entry].slice(-120); // 10 ans max
    });
  }, [totals.revenus, totals.chargesFixes, totals.depensesVar, totals.invest]);

  const handleImport = (imported) => {
    setTransactions((prev) => [...prev, ...imported.map((tx) => ({ ...tx, id: Date.now() + Math.random() }))]);
    setView("finances");
  };

  const handleDeleteTx  = (id) => setTransactions(prev => prev.filter(t => t.id !== id));
  const handleUpdateTx  = (id, changes) => setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
  const handleDismissAlert = (alertId) => setDismissed(prev => [...prev, alertId]);

  if (!showApp) return <Landing onStart={() => setShowApp(true)} />;

  return (
    <div className="flex min-h-screen" style={{ background: T.bgGradient, fontFamily: "'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <ScrollProgressBar />
      {showFIREModal && (
        <FIREInfoModal onClose={() => setShowFIREModal(false)} />
      )}
      {showTrialPopup && (
        <TrialPopup
          onDiscover={() => { dismissTrialPopup(); setView("pricing"); }}
          onClose={dismissTrialPopup}
        />
      )}
      {showOnboarding && (
        <OnboardingWizard
          profile={profile}
          setProfile={setProfile}
          setTransactions={setTransactions}
          onDone={() => setOnboarded(true)}
        />
      )}
      <Sidebar view={view} setView={setView} profile={profile} plan={plan} setPlan={setPlan} />
      <main className="flex-1 p-6 md:p-10 overflow-x-hidden" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* logout button */}
        {supabase && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                background: "transparent",
                color: T.muted,
                cursor: "pointer",
              }}
              aria-label="Déconnexion"
            >
              Déconnexion
            </button>
          </div>
        )}

        {/* nav mobile */}
        <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-1">
          {["dashboard", "finances", "credits", "objectifs", "simulations", "patrimoine", "fi", "immobilier", "or", "crypto", "fiscalite", "plans", ...(profile.coupleMode && plan === "couple" ? ["couple"] : []), "pricing", "profil"].map((v) => (
            <Pill key={v} active={view === v} onClick={() => setView(v)}>
              {{ dashboard: "Tableau", finances: "Finances", credits: "Crédits", objectifs: "Objectifs", simulations: "Simul.", patrimoine: "Patrimoine", fi: "IF", immobilier: "Immo", or: "Or", crypto: "Crypto", fiscalite: "Fiscalité", plans: "Plan", assistant: "IA", couple: "Couple", pricing: "Tarifs", profil: "Profil" }[v]}
            </Pill>
          ))}
        </div>

        {/* Alertes in-app (tous vues sauf pricing) */}
        {view !== "pricing" && view !== "importer" && (
          <AlertsBanner totals={totals} patrimoine={patrimoineDerived} dismissed={dismissed} onDismiss={handleDismissAlert} incomeRef={incomeRef} incomeIsSmoothed={incomeIsSmoothed} />
        )}

        {view === "pricing"      && <PricingPage plan={plan} setPlan={setPlan} />}
        {view === "dashboard"    && <Dashboard totals={totals} breakdown={breakdown} patrimoine={patrimoineDerived} simParams={simParams} setView={setView} histo={histo} transactions={transactions} plan={plan} profile={profile} snapshots={snapshots} incomeRef={incomeRef} incomeIsSmoothed={incomeIsSmoothed} />}
        {view === "finances"     && <Finances totals={totals} tx={transactions} setView={setView}
            onAdd={(tx) => setTransactions(prev => [...prev, tx])}
            onDelete={handleDeleteTx}
            onUpdate={handleUpdateTx}
            budgets={budgets}
            setBudgets={setBudgets}
            plan={plan}
          />}
        {view === "objectifs"    && <ObjectifsView goals={goals} setGoals={setGoals} totals={totals} />}
        {view === "credits"      && <Credits credits={credits} setCredits={setCredits} monthlyIncome={incomeRef} incomeIsSmoothed={incomeIsSmoothed} setView={setView} />}
        {view === "patrimoine"   && <Patrimoine patrimoine={patrimoineDerived} setPatrimoine={setPatrimoine} />}
        {view === "profil"       && <Profil profile={profile} setProfile={setProfile} onInject={injectProfile} setTransactions={setTransactions} plan={plan} setView={setView} />}
        {view === "importer"     && <TransactionImportTab onImport={handleImport} />}
        {view === "plans"        && (canAccess(plan, "plans")     ? <Plans totals={totals} simParams={simParams} patrimoine={patrimoineDerived} transactions={transactions} profile={profile} /> : <PaywallBanner feature="plans" plan={plan} onUpgrade={() => setView("pricing")} />)}
        {view === "portefeuille" && <Portefeuille />}

        {/* Vues Premium */}
        {view === "simulations"  && (canAccess(plan, "simulations") ? <Simulations totals={totals} simParams={simParams} setSimParams={setSimParams} age={profile.age} transactions={transactions} /> : <PaywallBanner feature="simulations" plan={plan} onUpgrade={() => setView("pricing")} />)}
        {view === "fi"           && (canAccess(plan, "fi")          ? <FI patrimoine={patrimoineDerived} totals={totals} simParams={simParams} profile={profile} /> : <PaywallBanner feature="fi" plan={plan} onUpgrade={() => setView("pricing")} />)}
        {view === "immobilier"   && (canAccess(plan, "immobilier")  ? <Immobilier totals={totals} simParams={simParams} patrimoine={patrimoineDerived} transactions={transactions} /> : <PaywallBanner feature="immobilier" plan={plan} onUpgrade={() => setView("pricing")} />)}
        {view === "or"           && (canAccess(plan, "or")          ? <Or patrimoine={patrimoineDerived} /> : <PaywallBanner feature="or" plan={plan} onUpgrade={() => setView("pricing")} />)}
        {view === "crypto"       && (canAccess(plan, "crypto")      ? <Crypto /> : <PaywallBanner feature="crypto" plan={plan} onUpgrade={() => setView("pricing")} />)}
        {view === "fiscalite"    && (canAccess(plan, "fiscalite")   ? <Tax />    : <PaywallBanner feature="fiscalite" plan={plan} onUpgrade={() => setView("pricing")} />)}

        {/* Vues Pro */}
        {view === "couple"       && (canAccess(plan, "couple")      ? <Couple transactions={transactions} simParams={simParams} patrimoine={patrimoineDerived} profile={profile} /> : <PaywallBanner feature="couple" plan={plan} onUpgrade={() => setView("pricing")} />)}

        <LegalDisclaimer />
      </main>

      {/* Assistant financier — popup flottant (remplace l'ancien onglet Assistant) */}
      <AIChatWidget ctx={{ totals, patrimoine: patrimoineDerived, credits, profile, simParams, profileType: detectProfileType(transactions || []) }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DISCLAIMER LÉGAL                                                   */
/* ------------------------------------------------------------------ */
function LegalDisclaimer() {
  const T = useT();
  const [expanded, setExpanded] = useState(false);
  return (
    <footer
      className="mt-16 rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${T.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Info size={15} style={{ color: T.muted, flexShrink: 0, marginTop: 2 }} />
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
              Informations légales — non contractuel
            </span>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>
              WealthTrack est un outil de simulation et de suivi patrimonial personnel à titre purement informatif. Les informations, calculs, projections et simulations présentés sur cette plateforme <strong style={{ color: T.text }}>ne constituent en aucun cas un conseil en investissement, un conseil financier, fiscal ou juridique</strong> au sens des articles L. 321-1 et suivants du Code monétaire et financier.
            </p>
            {expanded && (
              <div className="mt-3 space-y-2 text-xs leading-relaxed" style={{ color: T.muted }}>
                <p>
                  <strong style={{ color: T.text }}>Rendements passés :</strong> Les performances passées, les taux de rendement historiques (ETF, crypto-actifs, immobilier, livrets réglementés, etc.) affichés sur WealthTrack ne préjugent pas des performances futures et ne sont pas garantis. Tout investissement comporte un risque de perte partielle ou totale du capital investi.
                </p>
                <p>
                  <strong style={{ color: T.text }}>Données et hypothèses :</strong> Les projections de simulation reposent sur des hypothèses de rendement, d'inflation et de taux d'intérêt établies à des fins illustratives. Ces hypothèses sont susceptibles de ne pas se réaliser. WealthTrack ne garantit pas l'exactitude, l'exhaustivité ni l'actualité des données affichées.
                </p>
                <p>
                  <strong style={{ color: T.text }}>Crypto-actifs :</strong> Les crypto-actifs sont des instruments hautement spéculatifs et volatils. Leur valeur peut fluctuer très fortement à la hausse comme à la baisse. Ils ne sont pas couverts par les dispositifs de garantie des dépôts bancaires (FGDR) ni par les mécanismes d'indemnisation des investisseurs (FNGI).
                </p>
                <p>
                  <strong style={{ color: T.text }}>Responsabilité :</strong> WealthTrack et ses auteurs déclinent toute responsabilité pour les décisions d'investissement ou patrimoniales prises sur la base des informations contenues dans cette application. L'utilisateur est seul responsable de l'utilisation des données et des décisions financières qui en découlent.
                </p>
                <p>
                  <strong style={{ color: T.text }}>Conseil professionnel :</strong> Pour toute décision d'investissement, il est fortement recommandé de consulter un conseiller en gestion de patrimoine (CGP) agréé par l'ORIAS, un conseiller fiscal ou un expert-comptable agréé, selon la nature de votre situation.
                </p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
                  WealthTrack n'est pas un prestataire de services d'investissement (PSI) au sens de la directive MIF II. Cette application ne fait pas l'objet d'un enregistrement auprès de l'AMF ou de l'ACPR en tant que conseiller en investissements financiers (CIF). © WealthTrack — Tous droits réservés.
                </p>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs flex-shrink-0 px-3 py-1.5 rounded-lg"
          style={{ color: T.muted, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.02)", whiteSpace: "nowrap" }}
        >
          {expanded ? "Réduire ▲" : "Lire tout ▼"}
        </button>
      </div>
    </footer>
  );
}
