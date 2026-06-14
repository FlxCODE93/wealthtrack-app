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
