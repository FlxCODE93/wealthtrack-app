/* ────────────────────────────────────────────────────────────────────
   Score de santé financière — logique pure.
   Extrait d'App.jsx.
   ──────────────────────────────────────────────────────────────────── */

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

