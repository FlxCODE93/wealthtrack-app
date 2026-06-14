import React, { useState, useEffect, useMemo, useRef } from "react";
import { Flag, TrendingUp, Zap, Check, AlertTriangle, ChevronUp, ChevronDown, Mountain, RefreshCw, Trophy, Rocket } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";
import { C, eur } from "./theme.js";
import { fv, yearsTo, monthsTo, RATE_A, RATE_C, RATE_LEP, RATE_IMMO_APPRECIATION, RATE_CRYPTO_FI_PRUDENT } from "./finance.js";
import InfoTooltip from "./InfoTooltip.jsx";
import { gsap, useGSAP, usePrevious, AnimatedNumber, celebrate, useCelebrateOnTrue, useCelebrationToast, prefersReducedMotion } from "./lib/motion.jsx";

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/* Seuil (en mois) à partir duquel un gain sur la date de liberté déclenche une célébration */
const SIGNIFICANT_GAIN_MONTHS = 3;

/* ─── LocalStorage hook ─────────────────────────────────────────────── */
function useLocalStorage(key, def) {
  const [state, setState] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState];
}

/* ─── Math ──────────────────────────────────────────────────────────── */
const CURRENT_YEAR = new Date().getFullYear();

/* ─── Tooltip custom ─────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, fiTarget }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 12, minWidth: 200 }}>
      <div style={{ color: C.muted, marginBottom: 8, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 4 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: C.text, fontWeight: 700 }}>{eur(p.value)}</span>
        </div>
      ))}
      {fiTarget && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, color: C.amber, fontSize: 11 }}>
          Cible FIRE : {eur(fiTarget)}
        </div>
      )}
    </div>
  );
}

/* ─── Slider ─────────────────────────────────────────────────────────── */
function Slider({ label, value, min, max, step = 1, onChange, format, disabled }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ opacity: disabled ? 0.45 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.text, fontSize: 16, fontWeight: 800 }}>{format ? format(value) : value}</span>
      </div>
      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: disabled ? C.muted : C.blue, borderRadius: 3 }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => !disabled && onChange(+e.target.value)}
          disabled={disabled}
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: disabled ? "not-allowed" : "pointer", height: "100%" }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: C.muted }}>
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

/* ─── Progress ring ──────────────────────────────────────────────────── */
function ProgressRing({ pct, size = 180 }) {
  const r    = (size - 24) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(pct, 100);
  const dash = circ - (fill / 100) * circ;
  const circleRef = useRef(null);
  const wrapRef   = useRef(null);
  const prevPct   = usePrevious(pct);
  const tweenRef  = useRef(null);

  useGSAP(() => {
    const el = circleRef.current;
    if (!el) return;
    if (tweenRef.current) tweenRef.current.kill();

    if (prevPct === pct || prefersReducedMotion()) {
      gsap.set(el, { strokeDashoffset: dash });
      return;
    }
    tweenRef.current = gsap.to(el, { strokeDashoffset: dash, duration: 0.8, ease: "power2.out" });

    // Feedback immédiat : pulse + halo lumineux quand la progression augmente
    if (pct > prevPct && wrapRef.current) {
      const glowColor = pct >= 100 ? C.green : C.blue;
      gsap.fromTo(wrapRef.current,
        { scale: 1 },
        { scale: 1.06, duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1, transformOrigin: "50% 50%" }
      );
      gsap.fromTo(el,
        { filter: "drop-shadow(0 0 0px transparent)" },
        { filter: `drop-shadow(0 0 14px ${glowColor})`, duration: 0.3, ease: "power2.out", yoyo: true, repeat: 1 }
      );
    }
  }, { dependencies: [pct], scope: wrapRef });

  return (
    <div ref={wrapRef} style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
        <circle
          ref={circleRef}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={pct >= 100 ? C.green : C.blue}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dash}
        />
      </svg>
    </div>
  );
}

/* ─── Milestone card ─────────────────────────────────────────────────── */
function MilestoneCard({ label, target, year, age, reached, isCoast, current, onReached }) {
  const pctDone = Math.min(100, (current / target) * 100);
  const cardRef = useRef(null);
  const ringRef = useRef(null);
  const iconRef = useRef(null);
  const confettiRef = useRef(null);
  const prevReached = usePrevious(reached);
  useCelebrateOnTrue(reached, { cardRef, ringRef, iconRef, confettiRef, color: isCoast ? C.amber : C.green });
  useEffect(() => {
    if (!prevReached && reached) onReached?.();
  }, [reached]);
  return (
    <div ref={cardRef} style={{
      position: "relative",
      background: reached ? "rgba(39,163,122,0.08)" : C.panel,
      border: `1px solid ${reached ? C.green + "44" : C.border}`,
      borderRadius: 14, padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} />
      <div ref={ringRef} style={{
        position: "absolute", inset: 0, borderRadius: 14,
        border: `2px solid ${C.green}`, opacity: 0, pointerEvents: "none",
      }} />
      <div ref={iconRef} style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: reached ? C.green + "22" : "rgba(255,255,255,0.05)",
        border: `1px solid ${reached ? C.green + "55" : C.border}`,
      }}>
        {reached
          ? <Check size={18} style={{ color: C.green }} />
          : isCoast
            ? <Mountain size={18} style={{ color: C.amber }} />
            : <Flag size={16} style={{ color: C.muted }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: reached ? C.green : C.text, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
          {label}
          {isCoast && <InfoTooltip text="Coast FI : seuil de patrimoine au-delà duquel les intérêts composés suffisent, sans aucun apport supplémentaire, à atteindre votre objectif retraite à l'âge cible. Vous pouvez alors « lever le pied » sur l'épargne tout en restant investi." align="left" />}
        </div>
        <div style={{ color: C.muted, fontSize: 12 }}>{eur(target)}</div>
        {!reached && pctDone > 0 && (
          <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${pctDone}%`, background: isCoast ? C.amber : C.blue, borderRadius: 2 }} />
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {reached ? (
          <span style={{ color: C.green, fontSize: 12, fontWeight: 700 }}>Atteint</span>
        ) : year ? (
          <>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{year}</div>
            <div style={{ color: C.muted, fontSize: 11 }}>{age} ans</div>
          </>
        ) : (
          <span style={{ color: C.red, fontSize: 12 }}>Hors portée</span>
        )}
      </div>
    </div>
  );
}

/* ─── Motivation ─────────────────────────────────────────────────────── */
function motivationText(progress, yearsLeft, monthlyContrib, fiTarget, currentSavings) {
  if (currentSavings >= fiTarget) {
    return { headline: "Vous êtes financièrement libre.", sub: "Votre patrimoine couvre vos dépenses indéfiniment. Félicitations.", color: C.green };
  }
  if (yearsLeft === null) {
    return { headline: "Augmentez votre épargne mensuelle.", sub: "Avec la trajectoire actuelle, la cible n'est pas atteignable sur 50 ans. Essayez d'économiser davantage ou de réduire vos dépenses.", color: C.red };
  }
  if (yearsLeft <= 1) {
    const months = Math.round(yearsLeft * 12);
    return { headline: `Plus que ${months} mois !`, sub: "Vous y êtes presque. Tenez bon — chaque euro compte.", color: C.green };
  }
  if (progress >= 90) {
    return { headline: "La ligne d'arrivée est en vue.", sub: `Il vous reste ${Math.round(yearsLeft)} an${yearsLeft > 1 ? "s" : ""} — le plus difficile est derrière vous.`, color: C.green };
  }
  if (progress >= 50) {
    return { headline: "Vous avez passé la mi-chemin.", sub: `${Math.round(yearsLeft)} ans encore. La puissance des intérêts composés accélère maintenant.`, color: C.blue };
  }
  if (progress >= 25) {
    return { headline: "Un quart du chemin parcouru.", sub: `Continuez à ce rythme — dans ${Math.round(yearsLeft)} ans, vous serez libre.`, color: C.blue };
  }
  if (progress < 5) {
    return { headline: "Le voyage commence.", sub: "Les premières années sont les plus dures. La régularité est votre meilleur atout.", color: C.amber };
  }
  return { headline: `${Math.round(yearsLeft)} ans pour la liberté.`, sub: "Chaque mois d'épargne régulier vous rapproche de votre indépendance.", color: C.blue };
}

/* ─── Taux de rendement par catégorie d'actif ───────────────────────── */
const LABEL_RATES = [
  [/\blep\b/i,                                         RATE_LEP * 100],
  [/livret\s*a\b/i,                                    RATE_C * 100],
  [/\bldds\b|\bldd\b/i,                                RATE_C * 100],
  [/\bpel\b/i,                                         2.0],
  [/\bcel\b/i,                                         RATE_C * 100],
  [/livret/i,                                          RATE_C * 100],
  [/compte.*courant|compte.*chèque|chèque|cash/i,      0.0],
  [/etf.*(world|msci|global)|msci.*(world|global)/i,  RATE_A * 100],
  [/\betf\b|tracker|\bindex\b/i,                       9.0],
  [/\bscpi\b/i,                                        5.0],
  [/assurance.?vie|\bav\b/i,                           4.0],
  [/\bper\b|plan.*épargne.*retraite/i,                 7.0],
  [/crypto|bitcoin|\bbtc\b|ethereum|\beth\b|solana|\bsol\b|\bbnb\b/i, RATE_CRYPTO_FI_PRUDENT * 100],
  [/action|bourse|\bcto\b/i,                           8.0],
  [/\bpea\b/i,                                         9.0],
];

const IMMO_RATES = [
  [/locatif|location|invest/i,                         5.0],
  [/résidence|principale|\brp\b|habitation/i,          RATE_IMMO_APPRECIATION * 100],
];

const CAT_DEFAULTS = { liquidites: 1.5, investissements: 7.0, immobilier: 3.0, autres: 0.0 };

function rateForItem(catId, label) {
  if (catId === "autres") return 0;
  if (catId === "immobilier") {
    for (const [rx, rate] of IMMO_RATES) if (rx.test(label)) return rate;
    return CAT_DEFAULTS.immobilier;
  }
  for (const [rx, rate] of LABEL_RATES) if (rx.test(label)) return rate;
  return CAT_DEFAULTS[catId] ?? 5.0;
}

function computeBlendedReturn(patrimoine) {
  if (!patrimoine?.actifs) return null;
  let totalValue = 0, weightedSum = 0;
  const breakdown = [];
  for (const cat of patrimoine.actifs) {
    for (const item of (cat.items || [])) {
      if (!item.value || item.value <= 0) continue;
      const rate = rateForItem(cat.id, item.label);
      breakdown.push({ label: item.label, value: item.value, rate });
      weightedSum += item.value * rate;
      totalValue += item.value;
    }
  }
  if (totalValue === 0) return null;
  const blended = Math.round((weightedSum / totalValue) * 10) / 10;
  return { rate: blended, breakdown, totalValue };
}

/* ─── Composant principal ───────────────────────────────────────────── */
export default function FI({ patrimoine, totals, simParams, profile }) {

  /* ── Valeurs réelles calculées depuis l'app ── */
  const appNetWorth = useMemo(() => {
    if (!patrimoine) return null;
    const a = patrimoine.actifs.flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
    const p = patrimoine.passifs.flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
    return a - p;
  }, [patrimoine]);

  const appAge = profile?.age ?? null;

  /* Épargne mensuelle réelle = restant après toutes charges + investissements */
  const appMonthly = useMemo(() => {
    if (!totals) return null;
    const m = Math.max(0, totals.restant + (totals.invest || 0));
    return Math.round(m);
  }, [totals]);

  /* Dépenses annuelles réelles */
  const appAnnualExpenses = useMemo(() => {
    if (!totals) return null;
    return Math.round((totals.chargesFixes + totals.depensesVar) * 12);
  }, [totals]);

  const hasAppData = appNetWorth !== null && appAge !== null;

  const appBlendedReturn = useMemo(() => computeBlendedReturn(patrimoine), [patrimoine]);

  /* ── Mode sync ── */
  const [syncMode, setSyncMode] = useLocalStorage("wt_fi_syncMode", true);

  /* ── Paramètres manuels (sauvegardés) ── */
  const [manualAge,      setManualAge]      = useLocalStorage("wt_fi_age",      30);
  const [manualSavings,  setManualSavings]  = useLocalStorage("wt_fi_savings",  10000);
  const [manualMonthly,  setManualMonthly]  = useLocalStorage("wt_fi_monthly",  500);
  const [returnRate,     setReturnRate]     = useLocalStorage("wt_fi_return",   7);
  const [manualExpenses, setManualExpenses] = useLocalStorage("wt_fi_expenses", 30000);
  const [multiple,       setMultiple]       = useLocalStorage("wt_fi_multiple", 25);
  const [customMode,     setCustomMode]     = useState(false);
  const [manualTarget,   setManualTarget]   = useLocalStorage("wt_fi_manual",   750000);
  const [pensionMonthly, setPensionMonthly] = useLocalStorage("wt_fi_pension",  0);
  const [showWhatIf,     setShowWhatIf]     = useState(false);
  const [editingTarget,  setEditingTarget]  = useState(false);
  const [draftTarget,    setDraftTarget]    = useState("");

  /* ── Valeurs effectives selon le mode ── */
  const age      = syncMode && appAge      != null ? appAge      : manualAge;
  const savings  = syncMode && appNetWorth != null ? appNetWorth : manualSavings;
  const monthly  = syncMode && appMonthly  != null ? appMonthly  : manualMonthly;
  const expenses = syncMode && appAnnualExpenses != null ? appAnnualExpenses : manualExpenses;

  /* Taux effectif : calculé depuis le patrimoine en mode sync, sinon slider manuel */
  const rateIsSynced    = syncMode && !!appBlendedReturn;
  const effectiveReturn = rateIsSynced ? appBlendedReturn.rate : returnRate;

  /* ── Âge légal de retraite (réforme 2023) ── */
  const retirementAge = age < 65 ? 64 : 62;

  const r             = effectiveReturn / 100;
  const fiTargetFull  = expenses * multiple;

  /* ── Timeline series ── */
  const series = useMemo(() => {
    const rPess = Math.max(r - 0.02, 0.01);
    const rOpt  = r + 0.02;
    return Array.from({ length: 81 }, (_, y) => ({
      year:  CURRENT_YEAR + y,
      age:   age + y,
      label: `${age + y} ans`,
      base:  Math.round(fv(savings, monthly, r,     y)),
      pess:  Math.round(fv(savings, monthly, rPess, y)),
      opt:   Math.round(fv(savings, monthly, rOpt,  y)),
    }));
  }, [savings, monthly, r, age]);

  /* IF sans pension — sert uniquement à décider si la carte pension est pertinente */
  const fiYearNoPension = useMemo(() => series.find(p => p.base >= fiTargetFull), [series, fiTargetFull]);
  const showPensionCard = !fiYearNoPension || fiYearNoPension.age > retirementAge;

  /* Pension appliquée seulement si la carte est active */
  const effectivePension = showPensionCard ? pensionMonthly : 0;
  const pensionAnnual    = effectivePension * 12;
  const gapExpenses      = Math.max(0, expenses - pensionAnnual);
  const fiTarget         = customMode ? manualTarget : gapExpenses * multiple;
  const pensionSaving    = customMode ? 0 : fiTargetFull - fiTarget;

  /* ── FI years ── */
  const fiYearBase = useMemo(() => series.find(p => p.base >= fiTarget), [series, fiTarget]);
  const fiYearPess = useMemo(() => series.find(p => p.pess >= fiTarget), [series, fiTarget]);
  const fiYearOpt  = useMemo(() => series.find(p => p.opt  >= fiTarget), [series, fiTarget]);
  const yearsLeft  = fiYearBase ? (fiYearBase.year - CURRENT_YEAR) : null;
  const progress   = fiTarget > 0 ? Math.min(100, Math.max(0, (savings / fiTarget) * 100)) : 100;

  /* ── Date de liberté à précision mensuelle (pour l'animation FIRE Date) ── */
  const fiMonthsBase = useMemo(() => monthsTo(savings, monthly, r, fiTarget), [savings, monthly, r, fiTarget]);
  const fiDateBase = useMemo(() => {
    if (fiMonthsBase == null) return null;
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + fiMonthsBase);
    return d;
  }, [fiMonthsBase]);

  /* ── Scénario ETF World 100 % ── */
  const fiYearETF = useMemo(() => {
    const y = yearsTo(savings, monthly, RATE_A, fiTarget);
    return y != null ? { years: y, age: age + y, year: CURRENT_YEAR + y } : null;
  }, [savings, monthly, fiTarget, age]);

  /* ── Chart data ── */
  const chartEnd  = fiYearBase ? Math.min(fiYearBase.year - CURRENT_YEAR + 5, 75) : 75;
  const chartData = useMemo(() => series.slice(0, chartEnd + 1), [series, chartEnd]);

  /* ── Milestones ── */
  const milestones = useMemo(() => {
    const pts = [0.10, 0.25, 0.50, 0.75, 1.00].map(pct => {
      const target = fiTarget * pct;
      const point  = series.find(p => p.base >= target);
      return { pct, target, year: point?.year, age: point?.age, reached: savings >= target };
    });

    let coastPoint = null;
    for (let y = 0; y <= 50; y++) {
      const port         = fv(savings, monthly, r, y);
      const yearsToRetire = Math.max(0, 65 - (age + y));
      const coastNeeded  = yearsToRetire > 0 ? fiTarget / Math.pow(1 + r, yearsToRetire) : fiTarget;
      if (port >= coastNeeded) {
        coastPoint = { year: CURRENT_YEAR + y, age: age + y, target: coastNeeded, reached: y === 0 };
        break;
      }
    }

    return { pts, coast: coastPoint };
  }, [savings, monthly, r, age, fiTarget, series]);

  /* ── Passive income ── */
  const passiveNow      = (savings * r) / 12;
  const passiveAtFI     = (fiTarget * 0.04) / 12;           // portefeuille seul (règle 4 %)
  const totalIncomeAtFI = passiveAtFI + pensionMonthly;      // portefeuille + pension

  /* ── What-if ── */
  const whatIf = useMemo(() => {
    const deltaMonthly = 200;
    const deltaReturn  = 1;
    const deltaExpPct  = 10;

    const y1 = yearsTo(savings, monthly + deltaMonthly, r, fiTarget);
    const y2 = yearsTo(savings, monthly, r + deltaReturn / 100, fiTarget);
    const y3 = yearsTo(savings, monthly, r, fiTarget * (1 - deltaExpPct / 100));

    const gain1 = yearsLeft != null && y1 != null ? Math.round((yearsLeft - y1) * 12) : null;
    const gain2 = yearsLeft != null && y2 != null ? Math.round((yearsLeft - y2) * 12) : null;
    const gain3 = yearsLeft != null && y3 != null ? Math.round((yearsLeft - y3) * 12) : null;

    return [
      { label: `Épargner +${deltaMonthly} €/mois`, gainMonths: gain1 },
      { label: `Rendement +${deltaReturn} % (${(effectiveReturn + deltaReturn).toFixed(1)} %)`, gainMonths: gain2 },
      { label: `Dépenses −${deltaExpPct} %`, gainMonths: gain3 },
    ];
  }, [savings, monthly, r, fiTarget, yearsLeft, effectiveReturn]);

  /* ── Motivation ── */
  const motiv = motivationText(progress, yearsLeft, monthly, fiTarget, savings);

  const fmt = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)} M€` : `${Math.round(n / 1000)}k€`;

  /* ── Animation FIRE Date : flip + badge "mois gagnés/perdus" ── */
  const fireDateRef     = useRef(null);
  const fireRingRef     = useRef(null);
  const fireBadgeRef    = useRef(null);
  const fireConfettiRef = useRef(null);
  const settledMonthsRef = useRef(fiMonthsBase);
  const fireDebounceRef  = useRef(null);
  const [fireGain, setFireGain] = useState(null); // { months, positive }
  const [toastNode, triggerToast] = useCelebrationToast();

  useEffect(() => {
    if (fiMonthsBase == null) return;
    if (fireDebounceRef.current) clearTimeout(fireDebounceRef.current);
    fireDebounceRef.current = setTimeout(() => {
      const prevMonths = settledMonthsRef.current;
      settledMonthsRef.current = fiMonthsBase;
      if (prevMonths == null || prevMonths === fiMonthsBase) return;

      const delta = prevMonths - fiMonthsBase; // > 0 = la date de liberté se rapproche

      if (!prefersReducedMotion() && fireDateRef.current) {
        gsap.fromTo(fireDateRef.current,
          { y: delta > 0 ? 10 : -10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
        );
      }

      setFireGain({ months: Math.abs(delta), positive: delta > 0 });

      if (delta >= SIGNIFICANT_GAIN_MONTHS) {
        celebrate({ cardEl: fireDateRef.current, ringEl: fireRingRef.current, confettiEl: fireConfettiRef.current, color: C.green });
        triggerToast({
          icon: <Rocket size={18} style={{ color: C.green }} />,
          title: `−${delta} mois avant votre liberté financière !`,
          subtitle: "Continuez sur cette lancée.",
          color: C.green,
        });
      }
    }, 400);
    return () => clearTimeout(fireDebounceRef.current);
  }, [fiMonthsBase]);

  // Disparition automatique du badge "mois gagnés/perdus"
  useEffect(() => {
    if (!fireGain) return;
    const el = fireBadgeRef.current;
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(el, { scale: 0.5, opacity: 0, y: 6 }, { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.8)" });
    }
    const t = setTimeout(() => {
      if (el && !prefersReducedMotion()) {
        gsap.to(el, { opacity: 0, y: -6, duration: 0.3, ease: "power1.in", onComplete: () => setFireGain(null) });
      } else {
        setFireGain(null);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [fireGain]);

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6">
      {toastNode}

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: C.text }}>Indépendance Financière</h1>
        <p style={{ color: C.muted }}>Règle des 4 % · Intérêts composés · Votre date de liberté</p>
      </div>

      {/* ── Bandeau de synchronisation ── */}
      {hasAppData && (
        <div style={{
          background: syncMode ? "rgba(34,199,154,0.07)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${syncMode ? C.green + "44" : C.border}`,
          borderRadius: 14, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: syncMode ? C.green + "22" : "rgba(255,255,255,0.05)",
              border: `1px solid ${syncMode ? C.green + "44" : C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <RefreshCw size={16} style={{ color: syncMode ? C.green : C.muted }} />
            </div>
            <div>
              <div style={{ color: syncMode ? C.green : C.text, fontWeight: 700, fontSize: 13 }}>
                {syncMode ? "Données synchronisées depuis WealthTrack" : "Mode simulation manuelle"}
              </div>
              {syncMode && (
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                  Patrimoine net : <b style={{ color: C.text }}>{eur(appNetWorth)}</b>
                  {appAge && <> · Âge : <b style={{ color: C.text }}>{appAge} ans</b></>}
                  {appMonthly != null && <> · Épargne : <b style={{ color: C.text }}>{eur(appMonthly)}/mois</b></>}
                  {appAnnualExpenses != null && <> · Dépenses : <b style={{ color: C.text }}>{eur(appAnnualExpenses)}/an</b></>}
                </div>
              )}
              {!syncMode && (
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                  Les données du Patrimoine, Profil et Finances ne sont pas utilisées.
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setSyncMode(v => !v)}
            style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: syncMode ? "rgba(255,255,255,0.06)" : C.green + "22",
              border: `1px solid ${syncMode ? C.border : C.green + "66"}`,
              color: syncMode ? C.muted : C.green,
              whiteSpace: "nowrap",
            }}
          >
            {syncMode ? "Passer en simulation" : "Synchroniser mes données"}
          </button>
        </div>
      )}

      {/* ── HERO : ring + stats ── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px 32px" }}>
        <div className="flex flex-wrap gap-8 items-center justify-center">

          {/* Progress ring */}
          <div style={{ position: "relative", width: 180, height: 180, flexShrink: 0 }}>
            <ProgressRing pct={progress} size={180} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: C.text, fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                <AnimatedNumber value={progress} formatter={(n) => n.toFixed(1)} duration={0.8} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>%</span>
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>vers l'IF</div>
            </div>
          </div>

          {/* Chiffres clés */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, flex: 1, minWidth: 260 }}>

            {/* Patrimoine actuel */}
            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>Patrimoine actuel</div>
              <div style={{ color: C.blue, fontSize: 18, fontWeight: 800 }}>{eur(savings)}</div>
            </div>

            {/* Cible FIRE — éditable inline */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Cible FIRE</span>
                {customMode && (
                  <span
                    onClick={() => setCustomMode(false)}
                    title="Revenir au calcul automatique"
                    style={{ fontSize: 9, color: C.amber, fontWeight: 700, background: "rgba(245,166,35,0.15)", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5, cursor: "pointer" }}
                  >PERSO ×</span>
                )}
              </div>
              {editingTarget ? (
                <input
                  autoFocus
                  type="number"
                  value={draftTarget}
                  onChange={e => setDraftTarget(e.target.value)}
                  onBlur={() => {
                    const v = parseInt(String(draftTarget).replace(/\s/g, "")) || 0;
                    if (v > 0) { setManualTarget(v); setCustomMode(true); }
                    setEditingTarget(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.target.blur();
                    if (e.key === "Escape") setEditingTarget(false);
                  }}
                  style={{
                    width: "100%", background: "rgba(34,199,154,0.08)",
                    border: `1.5px solid ${C.green}`, borderRadius: 8,
                    padding: "4px 8px", color: C.green, fontSize: 17, fontWeight: 800,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              ) : (
                <div
                  onClick={() => { setDraftTarget(String(fiTarget)); setEditingTarget(true); }}
                  title="Cliquer pour modifier"
                  style={{
                    color: C.green, fontSize: 18, fontWeight: 800,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    borderBottom: `1px dashed ${C.green}44`, paddingBottom: 1,
                  }}
                >
                  {eur(fiTarget)}
                  <span style={{ fontSize: 12, color: C.green, opacity: 0.6 }}>✎</span>
                </div>
              )}
            </div>

            {/* Âge à l'IF */}
            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>Âge à l'IF</div>
              <div style={{ color: savings >= fiTarget ? C.green : C.amber, fontSize: 18, fontWeight: 800 }}>
                {savings >= fiTarget ? "Libre !" : fiYearBase ? `${fiYearBase.age} ans` : "—"}
              </div>
            </div>

            {/* Dans */}
            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>Dans</div>
              <div style={{ color: C.text, fontSize: 18, fontWeight: 800 }}>
                {savings >= fiTarget ? "Maintenant" : yearsLeft != null ? `${yearsLeft} an${yearsLeft > 1 ? "s" : ""}` : "—"}
              </div>
            </div>

            {/* Revenus passifs */}
            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>Revenu passif actuel</div>
              <div style={{ color: C.muted, fontSize: 18, fontWeight: 800 }}>{eur(passiveNow)}/mois</div>
            </div>
            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>
                Revenu total à l'IF
              </div>
              <div style={{ color: C.green, fontSize: 18, fontWeight: 800 }}>{eur(totalIncomeAtFI)}/mois</div>
              {pensionMonthly > 0 && (
                <div style={{ color: C.muted, fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>
                  {eur(passiveAtFI)} portefeuille + {eur(pensionMonthly)} pension
                </div>
              )}
            </div>

          </div>

          {/* Scénarios rapides */}
          {fiYearBase && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
              {[
                { label: `Optimiste (${(effectiveReturn + 2).toFixed(1)} %)`, year: fiYearOpt?.year, color: C.cyan },
                { label: `Base (${effectiveReturn.toFixed(1)} %)`,          year: fiYearBase?.year, color: C.blue },
                { label: `Pessimiste (${Math.max(0.5, effectiveReturn - 2).toFixed(1)} %)`, year: fiYearPess?.year, color: C.violet },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12 }}>
                  <span style={{ color: C.muted }}>{s.label}</span>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.year ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Détail du taux calculé depuis le patrimoine */}
        {rateIsSynced && appBlendedReturn && (
          <div style={{
            marginTop: 20, padding: "14px 18px",
            background: "rgba(99,102,241,0.07)", border: `1px solid rgba(99,102,241,0.2)`,
            borderRadius: 14,
          }}>
            <div style={{ color: C.blue, fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>
              Détail du calcul · rendement {effectiveReturn.toFixed(1)} % pondéré depuis votre patrimoine
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px" }}>
              {appBlendedReturn.breakdown.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: C.muted, alignItems: "center" }}>
                  <span>{item.label}</span>
                  <span style={{ color: C.muted, opacity: 0.5 }}>·</span>
                  <span style={{ color: C.muted }}>{eur(item.value)}</span>
                  <span style={{ color: C.muted, opacity: 0.5 }}>·</span>
                  <span style={{ color: item.rate >= 7 ? C.green : item.rate >= 3 ? C.blue : C.muted, fontWeight: 700 }}>
                    {item.rate} %
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(255,255,255,0.06)`, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text, fontWeight: 700 }}>
              <span style={{ color: C.muted }}>Moyenne pondérée par les montants</span>
              <span style={{ color: C.blue }}>{effectiveReturn.toFixed(1)} %</span>
            </div>
            {appBlendedReturn.breakdown.some(item => item.rate === RATE_CRYPTO_FI_PRUDENT * 100) && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(255,255,255,0.06)`, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                ⚠ Vos positions crypto sont comptées ici à {(RATE_CRYPTO_FI_PRUDENT * 100).toFixed(0)} %/an, une hypothèse volontairement prudente pour une projection de revenu retraite — bien en-deçà des performances historiques du Bitcoin ou de l'Ethereum (voir l'onglet Crypto), qui sont beaucoup trop volatiles pour servir de base à une planification financière fiable.
              </div>
            )}
          </div>
        )}

        {/* ── Et si tout était en ETF World ? ── */}
        {fiYearETF && (
          <div style={{
            marginTop: 14, padding: "14px 18px",
            background: "rgba(34,199,154,0.06)", border: `1px solid rgba(34,199,154,0.2)`,
            borderRadius: 14, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.green, marginBottom: 6 }}>
                Et si toute l'épargne était en ETF World ?
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                Livrets, immobilier vendu, tout réinvesti en ETF MSCI World à <span style={{ color: C.text, fontWeight: 600 }}>{(RATE_A * 100).toFixed(1)} % / an</span> de rendement moyen historique.
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Situation actuelle</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.blue }}>
                  {fiYearBase ? `${fiYearBase.age} ans` : "—"}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{effectiveReturn.toFixed(1)} % pondéré</div>
              </div>
              <div style={{ fontSize: 20, color: C.muted, fontWeight: 300 }}>→</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>ETF World 100 %</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.green }}>
                  {fiYearETF.age} ans
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{(RATE_A * 100).toFixed(1)} % historique</div>
              </div>
              {fiYearBase && fiYearETF.age < fiYearBase.age && (
                <div style={{
                  background: "rgba(139,92,246,0.12)", border: `1px solid rgba(139,92,246,0.3)`,
                  borderRadius: 10, padding: "8px 14px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Gain</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#8b5cf6" }}>
                    {fiYearBase.age - fiYearETF.age} ans
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Pension de retraite ── */}
      {!showPensionCard && fiYearNoPension && (
        <div style={{
          background: "rgba(34,199,154,0.06)", border: `1px solid ${C.green}33`,
          borderRadius: 14, padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <div>
            <div style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>
              Indépendance financière avant l'âge de retraite légal ({retirementAge} ans)
            </div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
              Vous atteignez l'IF à <b style={{ color: C.text }}>{fiYearNoPension.age} ans</b> — la pension d'État n'est pas nécessaire dans votre calcul.
            </div>
          </div>
        </div>
      )}
      {showPensionCard && <div style={{
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 20, padding: "24px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(245,166,35,0.12)", border: `1px solid ${C.amber}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 18 }}>🏛️</span>
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>Pension de retraite estimée</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              Votre IF est projetée après {retirementAge} ans (âge légal) — la pension réduit directement votre cible
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {/* Input direct */}
          <div style={{ flex: "0 0 200px" }}>
            <label style={{ display: "block", color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
              Montant (€/mois)
            </label>
            <input
              type="number"
              value={pensionMonthly || ""}
              placeholder="Ex. 1 400"
              onChange={e => setPensionMonthly(Math.max(0, +e.target.value || 0))}
              style={{
                width: "100%", background: C.card,
                border: `1.5px solid ${pensionMonthly > 0 ? C.amber : C.border}`,
                borderRadius: 10, padding: "10px 14px",
                color: pensionMonthly > 0 ? C.amber : C.text,
                fontSize: 20, fontWeight: 800, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Slider */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <Slider
              label=""
              value={pensionMonthly}
              min={0} max={3000} step={50}
              onChange={setPensionMonthly}
              format={v => v > 0 ? `${eur(v)}/mois` : "0 €/mois"}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {[0, 800, 1000, 1200, 1500, 1800].map(v => (
                <button key={v} onClick={() => setPensionMonthly(v)} style={{
                  padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${pensionMonthly === v ? C.amber : C.border}`,
                  background: pensionMonthly === v ? "rgba(245,166,35,0.15)" : "transparent",
                  color: pensionMonthly === v ? C.amber : C.muted,
                }}>
                  {v === 0 ? "Aucune" : `${v} €`}
                </button>
              ))}
            </div>
          </div>

          {/* Impact immédiat */}
          {pensionMonthly > 0 && !customMode && (
            <div style={{
              background: "rgba(245,166,35,0.08)", border: `1px solid ${C.amber}44`,
              borderRadius: 12, padding: "14px 18px", flexShrink: 0,
            }}>
              <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
                Cible FIRE réduite de
              </div>
              <div style={{ color: C.amber, fontSize: 22, fontWeight: 900 }}>
                − {eur(pensionSaving)}
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                {eur(fiTargetFull)} → {eur(fiTarget)}
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* ── Impact pension ── */}
      {showPensionCard && pensionMonthly > 0 && !customMode && (
        <div style={{
          background: "rgba(34,199,154,0.07)", border: `1px solid ${C.green}44`,
          borderRadius: 16, padding: "18px 24px",
        }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
            Impact de votre pension sur la cible IF
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Dépenses mensuelles",         value: eur(expenses / 12) + "/mois",       color: C.muted },
              { label: "Pension couverte",             value: `− ${eur(pensionMonthly)}/mois`,     color: C.green },
              { label: "Gap à financer",               value: eur(gapExpenses / 12) + "/mois",     color: gapExpenses <= 0 ? C.green : C.amber },
              { label: "Cible FIRE sans pension",        value: eur(fiTargetFull),                   color: C.muted },
              { label: "Cible FIRE avec pension",        value: eur(fiTarget),                       color: C.green },
              { label: "Économie sur le portefeuille", value: `− ${eur(pensionSaving)}`,           color: C.green },
            ].map(r => (
              <div key={r.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}>{r.label}</div>
                <div style={{ color: r.color, fontSize: 16, fontWeight: 800 }}>{r.value}</div>
              </div>
            ))}
          </div>
          {gapExpenses <= 0 && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(34,199,154,0.12)", borderRadius: 10, color: C.green, fontSize: 13, fontWeight: 600 }}>
              Votre pension couvre l'intégralité de vos dépenses — aucun portefeuille nécessaire à la retraite.
            </div>
          )}
        </div>
      )}

      {/* ── Timeline chart ── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Trajectoire</h2>
          {fiYearBase && (
            <div style={{ fontSize: 13, color: C.muted }}>
              IF atteinte en <span style={{ color: C.green, fontWeight: 700 }}>{fiYearBase.year}</span> · âge {fiYearBase.age}
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" stroke={C.muted} tick={{ fontSize: 10 }} interval={Math.floor(chartEnd / 8)} />
            <YAxis stroke={C.muted} tick={{ fontSize: 10 }} tickFormatter={fmt} width={58} />
            <Tooltip content={<ChartTooltip fiTarget={fiTarget} />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <ReferenceLine y={fiTarget} stroke={C.green} strokeDasharray="6 3" label={{ value: "Cible FIRE", fill: C.green, fontSize: 11, position: "insideTopLeft" }} />
            {milestones.pts.map(m => m.year && !m.reached && (
              <ReferenceLine key={m.pct} x={`${m.age} ans`} stroke={C.border} strokeDasharray="3 3" />
            ))}
            <Line dataKey="opt"  name="Optimiste" stroke={C.cyan} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line dataKey="base" name="Base"       stroke={C.blue}  dot={false} strokeWidth={2.5} />
            <Line dataKey="pess" name="Pessimiste" stroke={C.violet} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Milestones ── */}
      <div>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Jalons</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          {milestones.pts.map(m => {
            const label = m.pct === 1 ? "Liberté financière" : m.pct === 0.75 ? "Presque là — 75 %" : m.pct === 0.50 ? "Mi-chemin — 50 %" : m.pct === 0.25 ? "Premier quart — 25 %" : "Premiers pas — 10 %";
            return (
              <MilestoneCard
                key={m.pct}
                label={label}
                target={m.target}
                year={m.year}
                age={m.age}
                reached={m.reached}
                current={savings}
                onReached={() => triggerToast({
                  icon: <Trophy size={18} style={{ color: C.green }} />,
                  title: `Palier atteint — ${label} !`,
                  subtitle: eur(m.target),
                  color: C.green,
                })}
              />
            );
          })}
          {milestones.coast && (
            <MilestoneCard
              label="Coast FI — arrêt des cotisations"
              target={milestones.coast.target}
              year={milestones.coast.year}
              age={milestones.coast.age}
              reached={milestones.coast.reached}
              isCoast
              current={savings}
              onReached={() => triggerToast({
                icon: <Mountain size={18} style={{ color: C.amber }} />,
                title: "Coast FI atteint !",
                subtitle: "Vos intérêts composés font le reste du chemin.",
                color: C.amber,
              })}
            />
          )}
        </div>
        {milestones.coast && (
          <p style={{ color: C.muted, fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
            <span style={{ color: C.amber, fontWeight: 600 }}>Coast FI</span> : à partir de ce point, votre patrimoine atteint seul la cible à 65 ans sans aucun apport supplémentaire — à rendement {effectiveReturn.toFixed(1)} % annuel.
          </p>
        )}
      </div>

      {/* ── Motivation ── */}
      <div style={{
        background: `linear-gradient(135deg, ${motiv.color}12 0%, transparent 100%)`,
        border: `1px solid ${motiv.color}33`,
        borderRadius: 20, padding: "24px 28px",
        display: "flex", gap: 20, alignItems: "flex-start",
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: motiv.color + "22", border: `1px solid ${motiv.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {savings >= fiTarget
            ? <Check size={22} style={{ color: motiv.color }} />
            : yearsLeft != null && yearsLeft <= 3
              ? <Zap size={22} style={{ color: motiv.color }} />
              : <TrendingUp size={22} style={{ color: motiv.color }} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: motiv.color, fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{motiv.headline}</div>
          <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>{motiv.sub}</div>
          {fiYearBase && yearsLeft > 0 && fiDateBase && (
            <div style={{ marginTop: 12, position: "relative", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div ref={fireConfettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} />
              <div ref={fireRingRef} style={{ position: "absolute", inset: -8, borderRadius: 12, border: `2px solid ${C.green}`, opacity: 0, pointerEvents: "none" }} />
              <span ref={fireDateRef} style={{ fontSize: 13, color: C.text, display: "inline-block" }}>
                À ce rythme, votre date de liberté est le <span style={{ color: C.green, fontWeight: 700 }}>1er {MOIS_FR[fiDateBase.getMonth()]} {fiDateBase.getFullYear()}</span>.
                Vous aurez <span style={{ color: C.green, fontWeight: 700 }}>{Math.floor(age + fiMonthsBase / 12)} ans</span>.
              </span>
              {fireGain && fireGain.months > 0 && (
                <span ref={fireBadgeRef} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                  background: fireGain.positive ? "rgba(0,200,150,0.14)" : "rgba(240,168,72,0.14)",
                  border: `1px solid ${(fireGain.positive ? C.green : C.amber)}55`,
                  color: fireGain.positive ? C.green : C.amber, whiteSpace: "nowrap",
                }}>
                  {fireGain.positive ? <Zap size={11} /> : <AlertTriangle size={11} />}
                  {fireGain.positive
                    ? `−${fireGain.months} mois`
                    : `+${fireGain.months} mois`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── What-if ── */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden" }}>
        <button
          onClick={() => setShowWhatIf(v => !v)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "none", border: "none", cursor: "pointer", color: C.text }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>Que se passe-t-il si…</span>
          {showWhatIf ? <ChevronUp size={18} style={{ color: C.muted }} /> : <ChevronDown size={18} style={{ color: C.muted }} />}
        </button>
        {showWhatIf && (
          <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {whatIf.map(w => (
              <div key={w.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 12, gap: 16 }}>
                <span style={{ color: C.text, fontSize: 13 }}>{w.label}</span>
                {w.gainMonths != null && w.gainMonths > 0 ? (
                  <span style={{ color: C.green, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    −{w.gainMonths >= 12 ? `${Math.floor(w.gainMonths / 12)} an${Math.floor(w.gainMonths / 12) > 1 ? "s" : ""}` : `${w.gainMonths} mois`}
                  </span>
                ) : w.gainMonths === 0 ? (
                  <span style={{ color: C.muted, fontSize: 12 }}>déjà libre</span>
                ) : (
                  <span style={{ color: C.muted, fontSize: 12 }}>impact faible</span>
                )}
              </div>
            ))}
            <p style={{ color: C.muted, fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>
              Comparatif par rapport au scénario base à {effectiveReturn.toFixed(1)} % — toutes choses égales par ailleurs.
            </p>
          </div>
        )}
      </div>

      {/* ── Note ── */}
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <span style={{ color: C.text, fontWeight: 600 }}>Règle des 4 %</span> (Bengen 1994) · Rendements réels non garantis ·
        Calcul hors inflation et hors prélèvements sociaux · Outil pédagogique — consultez un conseiller pour votre situation personnelle
      </div>
    </div>
  );
}
