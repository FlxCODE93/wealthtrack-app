/* ────────────────────────────────────────────────────────────────────
   Score de santé financière + scénarios what-if — logique pure.
   Extrait d'App.jsx.
   ──────────────────────────────────────────────────────────────────── */
import { eur } from "./theme.js";
import { RATE_A } from "./finance.js";

export function calculateHealthScore(totals, patrimoine, simParams) {
  const breakdown = {};

  // 1. Taux d'épargne (40 pts)
  const savingsRate = totals.tauxEpargne || 0;
  let savingsScore = savingsRate >= 20 ? 40 : savingsRate >= 15 ? 35 : savingsRate >= 10 ? 30 : savingsRate >= 5 ? 20 : 10;
  breakdown.savings = { score: savingsScore, max: 40, label: `Épargne (${savingsRate.toFixed(1)} %)` };

  // 2. Diversification actifs (30 pts)
  const nonEmptyCats = (patrimoine?.actifs || []).filter(c => c.items.some(i => i.value > 0)).length;
  const divScore = nonEmptyCats >= 4 ? 30 : nonEmptyCats >= 3 ? 25 : nonEmptyCats >= 2 ? 20 : 10;
  breakdown.diversification = { score: divScore, max: 30, label: "Diversification" };

  // 3. Investissement mensuel (20 pts)
  const investRate = totals.revenus > 0 ? (totals.invest / totals.revenus) * 100 : 0;
  const investScore = investRate >= 15 ? 20 : investRate >= 10 ? 15 : investRate >= 5 ? 10 : 5;
  breakdown.investment = { score: investScore, max: 20, label: `Investissement (${investRate.toFixed(1)} %)` };

  // 4. Ratio dettes/actifs (10 pts)
  const totalActifs = (patrimoine?.actifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
  const totalPassifs = (patrimoine?.passifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
  const debtRatio = totalActifs > 0 ? (totalPassifs / totalActifs) * 100 : 0;
  const healthPts = debtRatio < 10 ? 10 : debtRatio < 30 ? 7 : debtRatio < 60 ? 4 : 2;
  breakdown.health = { score: healthPts, max: 10, label: "Ratio dettes/actifs" };

  const overall = Object.values(breakdown).reduce((s, b) => s + b.score, 0);
  return { overall, breakdown, savingsRate, investRate };
}

export function getScoreBadge(score) {
  if (score >= 85) return { level: "Excellent",    color: "#27a37a", ring: "rgba(39,163,122,0.2)" };
  if (score >= 70) return { level: "Satisfaisant", color: "#c8883a", ring: "rgba(200,136,58,0.2)"  };
  if (score >= 50) return { level: "À améliorer",  color: "#d47a2a", ring: "rgba(212,122,42,0.2)"  };
  return               { level: "Critique",      color: "#d95454", ring: "rgba(217,84,84,0.2)"   };
}

export function calculateWhatIfScenarios(totals, simParams) {
  const monthly = simParams?.monthly || 200;
  const rate = RATE_A;
  const mr = rate / 12;
  const n = 20 * 12;
  const fvFactor = (Math.pow(1 + mr, n) - 1) / mr;
  const currentFV = Math.round(monthly * fvFactor);

  return [
    {
      id: "epargne_plus", diff: "Moyen",
      title: `Épargner +300 €/mois`,
      description: `Passer de ${eur(monthly)} à ${eur(monthly + 300)} d'épargne mensuelle`,
      impact20y: Math.round(300 * fvFactor),
    },
    {
      id: "pea", diff: "Facile",
      title: "Ouvrir un PEA",
      description: "0 % d'impôts sur les gains après 5 ans (vs 30 % PFU)",
      impact20y: Math.round(currentFV * 0.15),
    },
    {
      id: "etf_ter", diff: "Facile",
      title: "Réduire les frais ETF",
      description: "TER 0,35 % → 0,15 % (CW8 → IWDA)",
      impact20y: Math.round(monthly * ((Math.pow(1 + (rate + 0.002) / 12, n) - 1) / ((rate + 0.002) / 12) - fvFactor)),
    },
  ];
}
