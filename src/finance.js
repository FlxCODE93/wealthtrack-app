/**
 * WealthTrack — Constantes et formules financières partagées.
 *
 * Centralise les hypothèses de rendement et les formules de calcul
 * (intérêts composés, amortissement de prêt, temps pour atteindre un
 * objectif) utilisées par App.jsx, FI.jsx, Plans.jsx et Chatbot.jsx,
 * pour éviter que les mêmes chiffres divergent silencieusement d'un
 * écran à l'autre.
 */

/* ────────────────────────────────────────────────────────────────────
   Hypothèses de rendement par défaut (taux nominaux annuels)
   ────────────────────────────────────────────────────────────────────
   Ces taux sont des références HISTORIQUES (performances passées sur
   longue période) utilisées comme valeurs par défaut dans les
   projections. Ils sont hors inflation, hors frais et hors fiscalité,
   et NE CONSTITUENT PAS UNE PROMESSE DE RENDEMENT FUTUR.            */

export const RATE_ETF_WORLD = 0.105; // ETF actions monde (ex: MSCI World) — perf. nominale historique récente
export const RATE_LIVRET_A  = 0.015; // Livret A
export const RATE_LEP       = 0.035; // Livret d'Épargne Populaire
export const RATE_BTC       = 0.30;  // Bitcoin — extrêmement volatil, valeur indicative uniquement
export const RATE_ETH       = 0.25;  // Ethereum — extrêmement volatil, valeur indicative uniquement
export const RATE_IMMO_APPRECIATION = 0.02; // Appréciation immobilière annuelle moyenne

/* Hypothèse PRUDENTE retenue pour les positions crypto dans le calcul du
   rendement pondéré du patrimoine (planification retraite / FI). Volontairement
   très inférieure aux références historiques BTC/ETH ci-dessus (extrêmement
   volatiles, non adaptées à une projection de revenu retraite fiable). */
export const RATE_CRYPTO_FI_PRUDENT = 0.05;

/* ────────────────────────────────────────────────────────────────────
   Scénarios de rendement (pessimiste / base / optimiste) par classe d'actif.
   Un rendement réel n'est JAMAIS lisse : ces fourchettes servent à tracer
   une BANDE d'incertitude autour de la trajectoire centrale, plutôt qu'une
   fausse exponentielle parfaite. `base` reprend les constantes ci-dessus
   pour rester cohérent avec FIRE / dashboard / PDF.
   ──────────────────────────────────────────────────────────────────── */
export const RATE_SCENARIOS = {
  etf:    { pess: 0.04,  base: RATE_ETF_WORLD, opt: 0.12 },  // krach long / médiane / cycle porteur
  livret: { pess: 0.01,  base: RATE_LIVRET_A,  opt: 0.03 },  // taux administré, faible amplitude
  immo:   { pess: -0.01, base: RATE_IMMO_APPRECIATION, opt: 0.04 },
  btc:    { pess: -0.10, base: 0.12,           opt: RATE_BTC }, // base ≪ historique : l'historique = borne haute
  eth:    { pess: -0.12, base: 0.10,           opt: RATE_ETH },
};

/* ────────────────────────────────────────────────────────────────────
   Hypothèses immobilières — achat à crédit (le levier EST l'intérêt de l'immo)
   ──────────────────────────────────────────────────────────────────── */
export const IMMO_DOWN_FRAC   = 0.10;  // apport personnel (10 %)
export const IMMO_NOTARY_FRAC = 0.08;  // frais de notaire (~7-8 % ancien)
export const IMMO_LOAN_RATE   = 0.035; // taux crédit annuel
export const IMMO_LOAN_YEARS  = 25;    // durée du prêt

/* Mensualité d'un prêt (annuité constante). */
export function loanPayment(principal, annualRate, years) {
  const i = annualRate / 12;
  const n = years * 12;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/* Capital restant dû après `monthsPaid` mensualités (amortissement réel —
   courbe convexe : les intérêts dominent au début, pas une droite). */
export function loanRemaining(principal, annualRate, years, monthsPaid) {
  const i = annualRate / 12;
  const n = years * 12;
  if (monthsPaid >= n) return 0;
  if (i === 0) return principal * (1 - monthsPaid / n);
  const pmt = loanPayment(principal, annualRate, years);
  return principal * Math.pow(1 + i, monthsPaid) - pmt * (Math.pow(1 + i, monthsPaid) - 1) / i;
}

/* Série annuelle d'un achat immobilier à crédit.
   - cash investi = apport + frais de notaire + mensualités versées (sorties réelles)
   - equity       = valeur du bien − capital restant dû
   - gains        = equity − cash investi (peut être négatif au début à cause des frais) */
export function immoDetailedSeries(price, years, startYear, opts = {}) {
  const apprec  = opts.apprec  ?? RATE_IMMO_APPRECIATION;
  const down    = (opts.downFrac   ?? IMMO_DOWN_FRAC)   * price;
  const notary  = (opts.notaryFrac ?? IMMO_NOTARY_FRAC) * price;
  const loanRate  = opts.loanRate  ?? IMMO_LOAN_RATE;
  const loanYears = opts.loanYears ?? IMMO_LOAN_YEARS;
  const principal = price - down;
  const pmt = loanPayment(principal, loanRate, loanYears);
  const out = [];
  for (let y = 0; y <= years; y++) {
    const propValue = price * Math.pow(1 + apprec, y);
    const monthsPaid = Math.min(y * 12, loanYears * 12);
    const remaining = loanRemaining(principal, loanRate, loanYears, monthsPaid);
    const equity = Math.round(propValue - remaining);
    const cash = Math.round(down + notary + pmt * monthsPaid);
    out.push({
      year: startYear + y,
      capital: equity,
      equity,                       // alias consommé par le graphique ImmoCard
      apports: cash,
      gains: equity - cash,
      propValue: Math.round(propValue),
      loanRemaining: Math.round(remaining),
    });
  }
  return out;
}

// Alias rétro-compatibles (anciens noms utilisés dans App.jsx/Simulations)
export const RATE_A = RATE_ETF_WORLD;
export const RATE_C = RATE_LIVRET_A;

export const RATE_DISCLAIMER =
  "Performances passées, hors inflation, frais et fiscalité — ne préjugent pas des performances futures.";

/* Fiscalité — valeurs de référence */
export const RATE_PFU = 0.30;             // Prélèvement Forfaitaire Unique (flat tax)
export const SEUIL_EXONERATION_CESSION = 305; // Seuil annuel d'exonération des plus-values crypto (art. 150 VH bis CGI)

/* ────────────────────────────────────────────────────────────────────
   Seuils du taux d'épargne (en %)
   Utilisés pour harmoniser les alertes/badges affichés à plusieurs
   endroits (tableau de bord, bannière d'alertes, plan d'action PDF).
   ──────────────────────────────────────────────────────────────────── */
export const SAVINGS_RATE_CRITICAL = 10; // en dessous : alerte rouge (épargne quasi nulle)
export const SAVINGS_RATE_TARGET   = 20; // en dessous : alerte orange (objectif recommandé)

/* ────────────────────────────────────────────────────────────────────
   Valeur future avec apport mensuel (intérêts composés mensuels)
   FV = PV·(1+i)^n + PMT·[(1+i)^n - 1]/i,  i = taux annuel/12, n = années*12
   ──────────────────────────────────────────────────────────────────── */
export function fv(initial, monthly, annualRate, years) {
  const i = annualRate / 12;
  const n = years * 12;
  const a = initial * Math.pow(1 + i, n);
  const b = i === 0 ? monthly * n : monthly * (Math.pow(1 + i, n) - 1) / i;
  return a + b;
}

/** Valeur future d'une rente mensuelle seule (capital initial nul). */
export function fvMonthly(monthly, annualRate, years) {
  return fv(0, monthly, annualRate, years);
}

/** Série annuelle de valeur future (pour graphiques). */
export function fvSeries(initial, monthly, annualRate, years, startYear) {
  const out = [];
  for (let y = 0; y <= years; y++)
    out.push({ year: startYear + y, value: Math.round(fv(initial, monthly, annualRate, y)) });
  return out;
}

/** Série annuelle détaillée : capital, apports cumulés, gains. */
export function fvDetailedSeries(initial, monthly, annualRate, years, startYear) {
  const out = [];
  for (let y = 0; y <= years; y++) {
    const capital = Math.round(fv(initial, monthly, annualRate, y));
    const apports = Math.round(initial + monthly * 12 * y);
    out.push({ year: startYear + y, capital, apports, gains: capital - apports });
  }
  return out;
}

/** Série détaillée avec BANDE d'incertitude pess/base/opt.
   `scenario` = { pess, base, opt }. Ajoute capPess/capOpt + `range` (paire
   [pess, opt] consommée par une Area Recharts pour dessiner la bande). */
export function fvBandSeries(initial, monthly, scenario, years, startYear) {
  const out = [];
  for (let y = 0; y <= years; y++) {
    const apports = Math.round(initial + monthly * 12 * y);
    const capital = Math.round(fv(initial, monthly, scenario.base, y));
    const capPess = Math.round(fv(initial, monthly, scenario.pess, y));
    const capOpt  = Math.round(fv(initial, monthly, scenario.opt,  y));
    out.push({
      year: startYear + y, capital, apports, gains: capital - apports,
      capPess, capOpt, range: [capPess, capOpt],
    });
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────
   Capacité d'emprunt / mensualité (formule de l'annuité)
   PV = PMT·[1-(1+i)^-n]/i
   ──────────────────────────────────────────────────────────────────── */
export function loanFromPayment(monthly, annualRate, years) {
  const i = annualRate / 12;
  const n = years * 12;
  return (monthly * (1 - Math.pow(1 + i, -n))) / i;
}

/** Alias arrondi, nom utilisé historiquement dans Plans.jsx/Chatbot.jsx. */
export function loanCap(monthly, annualRate, years) {
  return Math.round(loanFromPayment(monthly, annualRate, years));
}

/* ────────────────────────────────────────────────────────────────────
   Gain net (intérêts composés - apports cumulés)
   ──────────────────────────────────────────────────────────────────── */
export function longTermGain(monthlyAmount, years = 20, annualRate = RATE_ETF_WORLD) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return 0; // taux nul : aucun intérêt, gain nul (évite la division par zéro → NaN)
  const result = monthlyAmount * (Math.pow(1 + r, n) - 1) / r;
  return Math.round(result - monthlyAmount * n);
}

/* ────────────────────────────────────────────────────────────────────
   Temps pour atteindre un objectif
   ──────────────────────────────────────────────────────────────────── */

/**
 * Nombre d'années entières (0-80) pour que `fv(pv, monthly, rate, y)`
 * atteigne `target`. Retourne `null` si non atteint sous 80 ans.
 * Supporte un capital de départ (`pv`) non nul.
 */
export function yearsTo(pv, monthly, annualRate, target) {
  if (pv >= target) return 0;
  for (let y = 0; y <= 80; y++) {
    if (fv(pv, monthly, annualRate, y) >= target) return y;
  }
  return null;
}

/**
 * Nombre de mois entiers (0-960) pour que la valeur future, composée
 * mensuellement, atteigne `target`. Donne une précision mensuelle de la
 * date de liberté financière (vs `yearsTo`, précision annuelle).
 * Retourne `null` si non atteint sous 80 ans.
 */
export function monthsTo(pv, monthly, annualRate, target) {
  if (pv >= target) return 0;
  const i = annualRate / 12;
  for (let n = 0; n <= 960; n++) {
    const a = pv * Math.pow(1 + i, n);
    const b = i === 0 ? monthly * n : monthly * (Math.pow(1 + i, n) - 1) / i;
    if (a + b >= target) return n;
  }
  return null;
}

/**
 * Temps continu (en années, avec décimales) pour atteindre `target` en
 * partant d'un capital nul, par résolution algébrique directe.
 * Retourne `null` si `monthly <= 0`.
 */
export function yearsToTarget(monthly, annualRate, target) {
  if (monthly <= 0) return null;
  const r = annualRate / 12;
  const x = 1 + target * r / monthly;
  if (x <= 1) return 0;
  return Math.log(x) / Math.log(1 + r) / 12;
}

/* ────────────────────────────────────────────────────────────────────
   Crédit immobilier — rembourser par anticipation OU garder + investir ?
   ──────────────────────────────────────────────────────────────────── */

/**
 * Mensualité (hors assurance) d'un capital restant dû sur `months` mois au
 * taux nominal `annualRate`. Sert quand on ne connaît que le capital restant.
 */
export function monthlyPaymentFromRemaining(remainingPrincipal, annualRate, months) {
  if (months <= 0) return remainingPrincipal;
  const i = annualRate / 12;
  if (i === 0) return remainingPrincipal / months;
  return (remainingPrincipal * i) / (1 - Math.pow(1 + i, -months));
}

/**
 * Indemnités de remboursement anticipé (IRA), plafond légal France :
 * min(6 mois d'intérêts sur le capital remboursé, 3 % du capital restant dû).
 * (Crédit immobilier — art. R313-25 du Code de la consommation.)
 */
export function earlyRepaymentPenalty(repaidPrincipal, remainingPrincipal, annualRate) {
  const sixMonthsInterest = repaidPrincipal * (annualRate / 12) * 6;
  const threePctCap = remainingPrincipal * 0.03;
  return Math.max(0, Math.min(sixMonthsInterest, threePctCap));
}

/** Valeur future nette d'impôt sur les plus-values (PFU 30 %, PEA 0 %, …). */
function fvNetOfTax(initial, monthly, annualRate, months, taxRate) {
  const gross = fv(initial, monthly, annualRate, months / 12);
  const invested = initial + monthly * months;
  const gain = Math.max(0, gross - invested);
  return gross - gain * taxRate;
}

/**
 * Compare, sur la durée restante du prêt, deux stratégies à horizon identique :
 *   - REPAY : rembourser (total ou partiel) maintenant, puis investir la
 *             mensualité libérée chaque mois.
 *   - KEEP  : garder le prêt et investir l'épargne disponible en une fois.
 *
 * opts: { remainingPrincipal, annualRate, insuranceMonthly?, remainingMonths,
 *         lumpSum, investReturn, taxRate? }
 * Tous les taux en décimal (0.035 = 3,5 %).
 */
export function repayVsInvest(opts) {
  const {
    remainingPrincipal, annualRate, insuranceMonthly = 0,
    remainingMonths, lumpSum, investReturn, taxRate = 0,
  } = opts;

  const N = remainingMonths;
  const i = annualRate / 12;

  const pmtPI       = monthlyPaymentFromRemaining(remainingPrincipal, annualRate, N);
  const monthlyDebt = pmtPI + insuranceMonthly;

  // Capital remboursé avec l'épargne (l'IRA est payée en plus, prélevée sur l'épargne).
  const repaid    = Math.min(lumpSum, remainingPrincipal);
  const ira       = earlyRepaymentPenalty(repaid, remainingPrincipal, annualRate);
  const cashUsed  = Math.min(lumpSum, repaid + ira);
  const leftover  = Math.max(0, lumpSum - cashUsed);
  const newPrincipal = remainingPrincipal - repaid;

  // Remboursement partiel → on réduit la mensualité en gardant la durée.
  const newPmtPI       = newPrincipal <= 0 ? 0 : monthlyPaymentFromRemaining(newPrincipal, annualRate, N);
  const newMonthlyDebt = newPrincipal <= 0 ? 0 : newPmtPI + insuranceMonthly;
  const freedMonthly   = monthlyDebt - newMonthlyDebt;

  // Coût d'intérêt restant si on garde le prêt (vs si on rembourse).
  const interestKept    = pmtPI * N - remainingPrincipal;
  const interestRepaid  = newPmtPI * N - newPrincipal;
  const interestSaved   = Math.max(0, interestKept - interestRepaid);

  const repayWealth = fvNetOfTax(leftover, freedMonthly, investReturn, N, taxRate);
  const keepWealth  = fvNetOfTax(lumpSum, 0, investReturn, N, taxRate);

  return {
    pmtPI, monthlyDebt, ira, repaid, newPrincipal, freedMonthly,
    interestSaved, repayWealth, keepWealth,
    diff: keepWealth - repayWealth,                 // > 0 → garder gagne
    winner: keepWealth >= repayWealth ? "keep" : "repay",
  };
}

/**
 * Taux de rendement annuel (placement) à partir duquel GARDER le prêt devient
 * plus avantageux que rembourser. Recherche numérique 0 → 20 %.
 * Retourne null si garder gagne déjà à 0 % (prêt très coûteux : rembourser).
 */
export function breakevenInvestRate(opts) {
  for (let pct = 0; pct <= 20; pct += 0.1) {
    const r = pct / 100;
    const { winner } = repayVsInvest({ ...opts, investReturn: r });
    if (winner === "keep") return pct === 0 ? null : r;
  }
  return null;
}

/** Série annuelle des deux trajectoires (pour le graphe comparatif). */
export function repayVsInvestSeries(opts) {
  const {
    remainingPrincipal, annualRate, insuranceMonthly = 0,
    remainingMonths, lumpSum, investReturn, taxRate = 0, startYear = new Date().getFullYear(),
  } = opts;
  const base = repayVsInvest(opts);
  const years = Math.ceil(remainingMonths / 12);
  const out = [];
  for (let y = 0; y <= years; y++) {
    const m = Math.min(y * 12, remainingMonths);
    out.push({
      year: startYear + y,
      repay: Math.round(fvNetOfTax(base.repayWealth >= 0 ? lumpSum - Math.min(lumpSum, remainingPrincipal + base.ira) : 0, base.freedMonthly, investReturn, m, taxRate)),
      keep:  Math.round(fvNetOfTax(lumpSum, 0, investReturn, m, taxRate)),
    });
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────
   Plus-values crypto — méthode PMCA (art. 150 VH bis CGI)
   Méthode LÉGALE française : globale au portefeuille, pas FIFO par actif.

   Pour chaque cession :
     PV = prix_cession − (prix_total_acquisition × prix_cession / valeur_globale_portefeuille)
   où prix_total_acquisition est réduit, à chaque cession, de la fraction imputée.

   `valeur_globale_portefeuille` (valeur de TOUT le portefeuille crypto au jour
   de la cession) n'est pas dérivable des seuls lots/ventes → fournie par
   l'utilisateur (champ du formulaire 2086). Absente → cession marquée `estimated`.
   ──────────────────────────────────────────────────────────────────── */
export function pmcaCessions(lots = [], sells = []) {
  const events = [
    ...lots.map(l => ({ kind: "buy", date: l.date, cost: (+l.amount || 0) * (+l.costPerUnit || 0) })),
    ...sells.map(s => ({ kind: "sell", date: s.date, sell: s })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  let prixTotalAcq = 0; // prix total d'acquisition net des fractions déjà imputées
  const cessions = [];

  for (const e of events) {
    if (e.kind === "buy") { prixTotalAcq += e.cost; continue; }

    const s = e.sell;
    const proceeds = (+s.amount || 0) * (+s.pricePerUnit || 0);
    const pv = +s.portfolioValue > 0 ? +s.portfolioValue : null;
    const estimated = !(pv && pv >= proceeds);

    // Sans valeur globale fiable, on retombe sur prix_cession (fraction maximale imputée).
    const denom = estimated ? Math.max(proceeds, pv || proceeds) : pv;
    const acquisitionFraction = denom > 0 ? prixTotalAcq * (proceeds / denom) : 0;
    const gain = proceeds - acquisitionFraction;
    prixTotalAcq = Math.max(0, prixTotalAcq - acquisitionFraction);

    cessions.push({
      id: s.id, date: s.date, symbol: s.symbol,
      amount: +s.amount || 0, pricePerUnit: +s.pricePerUnit || 0,
      proceeds, portfolioValue: pv, acquisitionFraction,
      gain, estimated,
    });
  }
  return cessions;
}

/** Récapitulatif PMCA pour une année fiscale (montants 2086 / 2042-C). */
export function pmcaSummary(lots = [], sells = [], year = new Date().getFullYear() - 1) {
  const all = pmcaCessions(lots, sells);
  const cessions = all.filter(c => String(c.date).startsWith(String(year)));
  const totalProceeds = cessions.reduce((s, c) => s + c.proceeds, 0);
  const totalAcquisition = cessions.reduce((s, c) => s + c.acquisitionFraction, 0);
  const netGain = cessions.reduce((s, c) => s + c.gain, 0);
  // Exonération si total annuel des cessions ≤ 305 € (art. 150 VH bis).
  const exonerated = totalProceeds <= SEUIL_EXONERATION_CESSION;
  const tax = exonerated || netGain <= 0 ? 0 : netGain * RATE_PFU;
  const anyEstimated = cessions.some(c => c.estimated);
  return { year, cessions, totalProceeds, totalAcquisition, netGain, tax, exonerated, anyEstimated };
}

/* ────────────────────────────────────────────────────────────────────
   PER (Plan Épargne Retraite) — économie d'impôt + arbitrage vs CTO
   Versements déductibles du revenu imposable (dans le plafond épargne
   retraite). Sortie en capital : versements imposés au barème (≈ TMI
   retraite), plus-values au PFU 30 %.
   ──────────────────────────────────────────────────────────────────── */

/** Capital d'une rente annuelle (versement en début d'année) composée à `r`. */
function annualFV(annualContribution, r, years) {
  let cap = 0;
  for (let y = 0; y < years; y++) cap = (cap + annualContribution) * (1 + r);
  return cap;
}

/**
 * Compare verser sur un PER vs investir le même montant sur un CTO.
 * opts: { monthly, years, tmiNow, tmiRetraite, annualReturn, reinvestRefund? }
 * Taux en décimal (0.30 = 30 %). Hypothèse : sortie en capital.
 */
export function perSimulation(opts) {
  const {
    monthly, years, tmiNow, tmiRetraite, annualReturn, reinvestRefund = true,
  } = opts;
  const annual = monthly * 12;
  const r = annualReturn;
  const versements = annual * years;

  // Capital PER brut (versements composés)
  const capitalBrut = annualFV(annual, r, years);
  const gainsPER = Math.max(0, capitalBrut - versements);

  // Économie d'impôt annuelle à l'entrée (déduction × TMI actuelle)
  const economieImpotAnnuelle = annual * tmiNow;

  // Imposition à la sortie : versements au barème (TMI retraite), gains au PFU
  const impotSortie = versements * tmiRetraite + gainsPER * RATE_PFU;
  const netPERbase = capitalBrut - impotSortie;

  // L'économie d'impôt est réinvestie sur un CTO (gains au PFU à la sortie)
  let netRefund;
  if (reinvestRefund) {
    const capRefund = annualFV(economieImpotAnnuelle, r, years);
    const refundGains = Math.max(0, capRefund - economieImpotAnnuelle * years);
    netRefund = capRefund - refundGains * RATE_PFU;
  } else {
    netRefund = economieImpotAnnuelle * years;
  }
  const netPER = netPERbase + netRefund;

  // CTO direct : même versement, plus-values au PFU
  const capCTO = annualFV(annual, r, years);
  const gainsCTO = Math.max(0, capCTO - versements);
  const netCTO = capCTO - gainsCTO * RATE_PFU;

  return {
    versements, economieImpotAnnuelle, economieImpotTotale: economieImpotAnnuelle * years,
    capitalBrut, gainsPER, impotSortie, netRefund,
    netPER, netCTO, avantage: netPER - netCTO,
    winner: netPER >= netCTO ? "per" : "cto",
  };
}

/** Série annuelle PER brut vs CTO net (graphe). */
export function perSeries(opts, startYear = new Date().getFullYear()) {
  const { monthly, years, annualReturn } = opts;
  const annual = monthly * 12;
  const out = [];
  let capPER = 0, capCTO = 0;
  out.push({ year: startYear, per: 0, cto: 0 });
  for (let y = 1; y <= years; y++) {
    capPER = (capPER + annual) * (1 + annualReturn);
    capCTO = (capCTO + annual) * (1 + annualReturn);
    out.push({ year: startYear + y, per: Math.round(capPER), cto: Math.round(capCTO) });
  }
  return out;
}
