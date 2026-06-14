/**
 * WealthTrack — Plans d'action concrets
 * 3 plans auto-générés depuis les données réelles + suivi par cases à cocher.
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { CheckSquare, Square, TrendingUp, ChevronDown, ChevronUp, Shield, Home, PartyPopper } from "lucide-react";
import { C, eur } from "./theme.js";
import { fvMonthly, loanCap, yearsToTarget, RATE_A } from "./finance.js";
import { gsap, usePrevious, useCelebrateOnTrue, useCelebrationToast, CONFETTI_COLORS, prefersReducedMotion } from "./lib/motion.jsx";

/* ─── PLAN 1 : Augmenter l'épargne ──────────────────────────────────── */
const DELIVERY_RE = /uber\s*eats|deliveroo|just\s*eat|frichti/i;

function buildPlan1(totals, transactions, horizon) {
  const current = totals.invest;
  const goal    = current + 300;
  const GOAL    = 1_000_000;
  const rate    = RATE_A;

  const yCurrent = yearsToTarget(current, rate, GOAL);
  const yNew     = yearsToTarget(goal, rate, GOAL);
  const saving   = yCurrent != null && yNew != null ? (yCurrent - yNew).toFixed(1) : null;

  // Détection des livraisons de repas dans les dépenses variables
  const deliveryTotal = transactions
    .filter((t) => t.type === "depense_variable" && t.amount < 0 && DELIVERY_RE.test(t.label))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Top dépenses variables réductibles (hors livraisons de repas, traitées séparément)
  const byCategory = {};
  transactions.filter((t) => t.type === "depense_variable" && t.amount < 0 && !DELIVERY_RE.test(t.label)).forEach((t) => {
    byCategory[t.cat] = (byCategory[t.cat] || 0) + Math.abs(t.amount);
  });
  const topCats = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, amt]) => ({ cat, amt }));

  const categoryCuts = topCats.map(({ cat, amt }) => ({
    label: `Réduire "${cat}" de ${eur(Math.round(amt * 0.25))}/mois (−25 %)`,
    gain: Math.round(amt * 0.25),
  }));

  const suggestedCuts = deliveryTotal > 0
    ? [{
        label: `Réduire les livraisons de repas (Uber Eats, Deliveroo…) de ${eur(Math.round(deliveryTotal * 0.25))}/mois (−25 %)`,
        gain: Math.round(deliveryTotal * 0.25),
      }, ...categoryCuts]
    : categoryCuts;

  return {
    id: "plan1",
    color: C.green,
    Icon: TrendingUp,
    title: "Booster l'épargne de +300 €/mois",
    subtitle: `Passer de ${eur(current)} à ${eur(goal)}/mois investis`,
    verdict: "RECOMMANDÉ",
    verdictColor: C.green,
    impact: {
      label: `Gain sur ${horizon} ans`,
      value: eur(fvMonthly(goal, rate, horizon) - fvMonthly(current, rate, horizon)),
      sub:   saving ? `Atteindre 1 M€ ${saving} ans plus tôt` : null,
    },
    steps: [
      ...suggestedCuts.slice(0, 3),
      { label: "Programmer un virement automatique ETF au 5 du mois (+150 €)", gain: 150 },
      { label: "Annuler 1 abonnement non essentiel (Netflix, Disney…)", gain: 17 },
      { label: "Mettre en place une cagnotte de 5 € par jour non-dépensé", gain: 50 },
    ],
    detail: [
      `Épargne actuelle : ${eur(current)}/mois`,
      `Épargne cible    : ${eur(goal)}/mois`,
      `Capital en 10 ans (actuel) : ${eur(fvMonthly(current, rate, 10))}`,
      `Capital en 10 ans (cible)  : ${eur(fvMonthly(goal, rate, 10))}`,
      `Différence                 : ${eur(fvMonthly(goal, rate, 10) - fvMonthly(current, rate, 10))}`,
    ],
  };
}

/* ─── PLAN 2 : Optimiser la fiscalité (PFU → PEA) ───────────────────── */
function buildPlan2(totals, horizon, hasPEA) {
  const monthly = totals.invest;
  const YEARS   = horizon;
  const gain    = fvMonthly(monthly, RATE_A, YEARS) - monthly * 12 * YEARS;
  const taxPFU  = Math.round(gain * 0.30);

  return {
    id: "plan2",
    color: C.blue,
    Icon: Shield,
    title: hasPEA ? "Optimiser votre PEA existant" : "Ouverture et investissement via le PEA",
    subtitle: hasPEA ? "Maximiser l'avantage fiscal de votre PEA actuel" : "0 % d'impôt sur les plus-values après 5 ans de détention",
    verdict: "FACILE",
    verdictColor: C.cyan,
    impact: {
      label: "Économie fiscale estimée",
      value: eur(taxPFU),
      sub: `Sur ${YEARS} ans avec ${eur(monthly)}/mois investis`,
    },
    steps: hasPEA ? [
      { label: "Vérifier que vos versements cumulés restent sous le plafond de 150 000 €", gain: 0 },
      { label: "Augmenter le virement mensuel vers votre PEA pour accélérer la capitalisation", gain: 0 },
      { label: "Réinvestir les dividendes perçus plutôt que de les laisser en cash", gain: 0 },
      { label: "Ne pas effectuer de retrait avant 5 ans de détention — l'horloge fiscale tourne", gain: 0 },
      { label: "Continuer les versements réguliers (DCA)", gain: 0 },
    ] : [
      { label: "Ouvrir un PEA sans frais de tenue de compte ni de courtage", gain: 0 },
      { label: "Programmer un virement mensuel dès l'ouverture — pour prendre date", gain: 0 },
      { label: "Acheter ETF éligibles : CW8 (Amundi MSCI World) ou WPEA (Lyxor)", gain: 0 },
      { label: "Ne pas effectuer de retrait avant 5 ans — l'horloge fiscale tourne", gain: 0 },
      { label: "Continuer les versements réguliers (DCA)", gain: 0 },
    ],
    detail: [
      `Investissement mensuel       : ${eur(monthly)}/mois`,
      `Gain brut sur ${YEARS} ans         : ${eur(gain)}`,
      `Impôt PFU (30 %)             : −${eur(taxPFU)}`,
      `Impôt PEA après 5 ans        : 0 €`,
      `Économie nette               : ${eur(taxPFU)}`,
    ],
    note: "Le PEA est limité à 150 000 € de versements. Pour des montants supérieurs, combiner PEA + CTO.",
  };
}

/* ─── PLAN 3 : Acquisition immobilière ──────────────────────────────── */
function buildPlan3(totals, patrimoine, age, hasRealEstate) {
  const mMax   = Math.round(totals.revenus * 0.35);
  const MAX_REPAY_AGE = 75; // fin de prêt généralement visée avant cet âge
  const ageCap = age ? Math.max(5, MAX_REPAY_AGE - age) : 25;
  const dur20  = Math.min(20, ageCap);
  const dur25  = Math.min(25, ageCap);
  const ageLimited = dur25 < 25;
  const cap20  = loanCap(mMax, 0.035, dur20);
  const cap25  = loanCap(mMax, 0.037, dur25);

  const totalActifs   = (patrimoine?.actifs  || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
  const totalPassifs  = (patrimoine?.passifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
  const liquidActifs  = totalActifs - totalPassifs; // rough apport disponible
  const apportMin     = Math.round(cap20 * 0.10);
  const hasApport     = liquidActifs >= apportMin;
  const canBorrow     = cap20 > 0;

  let verdict, verdictColor, verdictNote;
  if (canBorrow && hasApport) {
    verdict = "GO"; verdictColor = C.green;
    verdictNote = "Votre profil est éligible à un emprunt. Comparez les offres avant de signer.";
  } else if (canBorrow && !hasApport) {
    verdict = "POSSIBLE"; verdictColor = C.amber;
    verdictNote = `Apport insuffisant. Il manque ${eur(apportMin - liquidActifs)} pour atteindre 10 % du montant empruntable.`;
  } else {
    verdict = "ATTENDRE"; verdictColor = C.red;
    verdictNote = "La capacité d'emprunt est trop faible. Augmentez votre épargne ou vos revenus d'abord.";
  }

  return {
    id: "plan3",
    color: verdictColor,
    Icon: Home,
    title: hasRealEstate ? "Investir dans un bien locatif" : "Acheter un bien immobilier",
    subtitle: hasRealEstate ? "Analyse de votre capacité pour un second bien" : "Analyse personnalisée de votre éligibilité",
    verdict,
    verdictColor,
    impact: {
      label: "Capacité d'emprunt",
      value: eur(cap20),
      sub: `Sur ${dur20} ans — ou ${eur(cap25)} sur ${dur25} ans`,
    },
    steps: [
      { label: `Mensualité maximale (35 % de ${eur(totals.revenus)}) : ${eur(mMax)}/mois`, gain: 0 },
      { label: `Capacité ${dur20} ans : ${eur(cap20)} — Capacité ${dur25} ans : ${eur(cap25)}`, gain: 0 },
      { label: `Apport recommandé (10 %) : ${eur(apportMin)}`, gain: 0 },
      { label: "Comparer les taux et le coût total du crédit (TAEG) entre plusieurs établissements", gain: 0 },
      ...(ageLimited ? [{ label: `Durée de prêt limitée à ${ageCap} ans compte tenu de votre âge (remboursement visé avant ${MAX_REPAY_AGE} ans)`, gain: 0 }] : []),
    ],
    detail: [
      `Revenus mensuels              : ${eur(totals.revenus)}`,
      `Mensualité max (35 %)         : ${eur(mMax)}/mois`,
      `Capacité emprunt ${dur20} ans       : ${eur(cap20)}`,
      `Capacité emprunt ${dur25} ans       : ${eur(cap25)}`,
      `Patrimoine net estimé         : ${eur(Math.max(0, liquidActifs))}`,
      `Apport minimum requis (10 %)  : ${eur(apportMin)}`,
      `Verdict                       : ${verdict}`,
    ],
    note: verdictNote,
  };
}

/* ─── Composant PlanCard ─────────────────────────────────────────────── */
function PlanCard({ plan, completed, onToggle, onPlanComplete }) {
  const [open, setOpen] = useState(false);
  const done = plan.steps.filter((_, i) => completed.includes(i)).length;
  const progress = plan.steps.length > 0 ? Math.round((done / plan.steps.length) * 100) : 0;

  const cardRef = useRef(null);
  const confettiRef = useRef(null);
  const iconRefs = useRef([]);

  // Célébration (pop + confettis) quand toutes les étapes du plan sont cochées
  const justCompleted = plan.steps.length > 0 && progress === 100;
  useCelebrateOnTrue(justCompleted, { cardRef, confettiRef, color: plan.color, confettiColors: CONFETTI_COLORS });
  const prevJustCompleted = usePrevious(justCompleted);
  useEffect(() => {
    if (!prevJustCompleted && justCompleted) onPlanComplete?.(plan);
  }, [justCompleted]);

  // Micro-pop sur la case à cocher au moment où une étape est validée
  const handleStepClick = (i) => {
    const wasDone = completed.includes(i);
    onToggle(i);
    if (!wasDone && !prefersReducedMotion()) {
      const el = iconRefs.current[i];
      if (el) gsap.fromTo(el, { scale: 0.4, rotate: -25 }, { scale: 1, rotate: 0, duration: 0.45, ease: "back.out(3)" });
    }
  };

  return (
    <div ref={cardRef} style={{
      position: "relative",
      background: C.panel,
      border: `1px solid ${plan.color}44`,
      borderRadius: 20,
      overflow: "hidden",
    }}>
      <div ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible", zIndex: 5 }} />
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: plan.color + "1a", border: `1px solid ${plan.color}44` }}>
              <plan.Icon size={20} style={{ color: plan.color }} />
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: C.text }}>{plan.title}</div>
              <div className="text-sm" style={{ color: C.muted }}>{plan.subtitle}</div>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 rounded-lg text-xs font-bold"
            style={{ background: plan.verdictColor + "22", color: plan.verdictColor }}>
            {plan.verdict}
          </span>
        </div>

        {/* Impact KPI */}
        <div className="flex items-center gap-6 mt-4">
          <div>
            <div className="text-xs" style={{ color: C.muted }}>{plan.impact.label}</div>
            <div className="text-2xl font-black" style={{ color: plan.color }}>{plan.impact.value}</div>
            {plan.impact.sub && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{plan.impact.sub}</div>}
          </div>
          {done > 0 && (
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: C.muted }}>Progression</span>
                <span style={{ color: plan.color }}>{done}/{plan.steps.length} étapes</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: plan.color, borderRadius: 3, transition: "width 0.4s" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: "16px 24px" }}>
        <div className="text-xs font-semibold mb-3" style={{ color: C.muted, letterSpacing: 0.8 }}>
          ACTIONS À FAIRE
        </div>
        {plan.steps.map((step, i) => {
          const stepDone = completed.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleStepClick(i)}
              className="flex items-start gap-3 w-full text-left mb-3"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <span ref={(el) => (iconRefs.current[i] = el)} className="shrink-0" style={{ display: "inline-flex", marginTop: 1, transformOrigin: "50% 50%" }}>
                {stepDone
                  ? <CheckSquare size={18} style={{ color: plan.color }} />
                  : <Square size={18} style={{ color: C.muted }} />
                }
              </span>
              <div>
                <span className="text-sm" style={{
                  color: stepDone ? C.muted : C.text,
                  textDecoration: stepDone ? "line-through" : "none",
                }}>
                  {step.label}
                </span>
                {step.gain > 0 && (
                  <span className="ml-2 text-xs font-semibold" style={{ color: plan.color }}>
                    +{eur(step.gain)}/mois
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Détails toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-6 py-3 text-sm"
        style={{ background: "rgba(255,255,255,0.02)", border: "none", borderTop: `1px solid ${C.border}`, cursor: "pointer", color: C.muted }}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {open ? "Masquer le détail" : "Voir le calcul détaillé"}
      </button>

      {open && (
        <div style={{ padding: "12px 24px 20px", borderTop: `1px solid ${C.border}` }}>
          {plan.detail.map((line, i) => (
            <div key={i} className="flex justify-between text-xs py-1.5"
              style={{ borderBottom: i < plan.detail.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ color: C.muted }}>{line.split(":")[0]}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{line.split(":").slice(1).join(":").trim()}</span>
            </div>
          ))}
          {plan.note && (
            <div style={{
              marginTop: 12, background: "rgba(245,166,35,0.06)",
              borderLeft: `3px solid ${C.amber}`,
              borderRadius: "0 8px 8px 0", padding: "8px 12px",
              color: C.muted, fontSize: 11, lineHeight: 1.5,
            }}>
              {plan.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────── */
export default function Plans({ totals, simParams, patrimoine, transactions, profile }) {
  const horizon = simParams?.horizon || 20;
  const age = profile?.age;

  // Détection des avoirs déjà détenus pour éviter de recommander ce que l'utilisateur a déjà
  const hasPEA = (patrimoine?.actifs?.find((c) => c.id === "investissements")?.items || [])
    .some((i) => /\bPEA\b|CW8|WPEA/i.test(i.label));
  const hasRealEstate = (patrimoine?.actifs?.find((c) => c.id === "immobilier")?.items || [])
    .some((i) => i.value > 0);

  const plans = useMemo(() => [
    buildPlan1(totals, transactions, horizon),
    buildPlan2(totals, horizon, hasPEA),
    buildPlan3(totals, patrimoine, age, hasRealEstate),
  ], [totals, transactions, patrimoine, horizon, age, hasPEA, hasRealEstate]);

  const [completed, setCompleted] = useState({ plan1: [], plan2: [], plan3: [] });

  const toggle = (planId, stepIdx) => {
    setCompleted((prev) => {
      const list = prev[planId];
      return {
        ...prev,
        [planId]: list.includes(stepIdx) ? list.filter((i) => i !== stepIdx) : [...list, stepIdx],
      };
    });
  };

  const totalSteps = plans.reduce((s, p) => s + p.steps.length, 0);
  const totalDone  = Object.entries(completed).reduce((s, [pid, list]) => s + list.length, 0);
  const allDone = totalSteps > 0 && totalDone === totalSteps;

  const [toastNode, setToast] = useCelebrationToast();

  const handlePlanComplete = (plan) => {
    setToast({
      icon: <plan.Icon size={18} style={{ color: plan.color }} />,
      title: "Plan terminé !",
      subtitle: plan.title,
      color: plan.color,
    });
  };

  // Célébration renforcée quand TOUS les plans sont entièrement cochés
  const globalCardRef = useRef(null);
  const globalConfettiRef = useRef(null);
  useCelebrateOnTrue(allDone, { cardRef: globalCardRef, confettiRef: globalConfettiRef, color: C.green, confettiColors: CONFETTI_COLORS });
  const prevAllDone = usePrevious(allDone);
  useEffect(() => {
    if (!prevAllDone && allDone) {
      setToast({
        icon: <PartyPopper size={18} style={{ color: C.green }} />,
        title: "Tous les plans terminés !",
        subtitle: "Bravo, vous avez complété toutes les actions proposées.",
        color: C.green,
      });
    }
  }, [allDone]);

  return (
    <div className="flex flex-col gap-6">
      {toastNode}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: C.text }}>Plans d'action</h1>
        <p style={{ color: C.muted }}>Actions concrètes générées depuis votre situation réelle.</p>
      </div>

      {/* Progression globale */}
      {totalDone > 0 && (
        <div ref={globalCardRef} style={{ position: "relative", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 20px" }}>
          <div ref={globalConfettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible", zIndex: 5 }} />
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: C.text, fontWeight: 600 }}>Progression globale</span>
            <span style={{ color: C.green }}>{totalDone} / {totalSteps} étapes</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${Math.round((totalDone / totalSteps) * 100)}%`,
              background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`,
              transition: "width 0.4s",
            }} />
          </div>
        </div>
      )}

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          completed={completed[plan.id]}
          onToggle={(i) => toggle(plan.id, i)}
          onPlanComplete={handlePlanComplete}
        />
      ))}

      <div style={{ fontSize: 11, color: C.muted, textAlign: "center", paddingBottom: 8 }}>
        Plans indicatifs basés sur votre profil. Consultez un conseiller financier agréé AMF pour toute décision.
      </div>
    </div>
  );
}
