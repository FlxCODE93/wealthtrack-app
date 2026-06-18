import { describe, it, expect } from "vitest";
import {
  fv, fvMonthly, fvDetailedSeries, fvBandSeries,
  loanPayment, loanRemaining, loanFromPayment, loanCap,
  immoDetailedSeries, longTermGain, yearsTo, monthsTo, yearsToTarget,
  RATE_SCENARIOS, IMMO_DOWN_FRAC, IMMO_NOTARY_FRAC,
  monthlyPaymentFromRemaining, earlyRepaymentPenalty, repayVsInvest, breakevenInvestRate,
  pmcaCessions, pmcaSummary, SEUIL_EXONERATION_CESSION,
  perSimulation, perSeries,
  monthsElapsed, creditMensualite, creditCapitalRestant, creditInteretsRestants,
  creditCoutTotal, creditDateFin, creditsToPassifCategory, creditRemainingMonths,
  creditRevolvingStuck, creditProjectedRestant,
  smoothedMonthlyIncome, incomeCV, isIncomeVariable,
  INCOME_CV_THRESHOLD, INCOME_MIN_MONTHS,
} from "./finance.js";

/* ── fv (valeur future, intérêts composés mensuels) ──────────────── */
describe("fv", () => {
  it("rend le capital initial quand 0 an", () => {
    expect(fv(10000, 500, 0.05, 0)).toBe(10000);
  });
  it("apports seuls sans intérêt = somme versée", () => {
    // taux 0 : 0 initial + 100/mois * 12 mois = 1200
    expect(fv(0, 100, 0, 1)).toBeCloseTo(1200, 6);
  });
  it("capital initial seul composé (formule connue)", () => {
    // 1000 à 12%/an composé mensuel sur 1 an = 1000*(1.01)^12
    expect(fv(1000, 0, 0.12, 1)).toBeCloseTo(1000 * Math.pow(1.01, 12), 6);
  });
  it("croît avec le taux", () => {
    expect(fv(1000, 100, 0.10, 10)).toBeGreaterThan(fv(1000, 100, 0.04, 10));
  });
  it("gère taux nul sans division par zéro", () => {
    expect(Number.isFinite(fv(5000, 200, 0, 5))).toBe(true);
  });
});

describe("fvMonthly", () => {
  it("= fv avec capital initial nul", () => {
    expect(fvMonthly(300, 0.07, 8)).toBeCloseTo(fv(0, 300, 0.07, 8), 6);
  });
});

/* ── fvDetailedSeries ────────────────────────────────────────────── */
describe("fvDetailedSeries", () => {
  const s = fvDetailedSeries(1000, 200, 0.06, 10, 2026);
  it("a years+1 points", () => {
    expect(s).toHaveLength(11);
  });
  it("première année = capital initial, année commence à startYear", () => {
    expect(s[0].year).toBe(2026);
    expect(s[0].capital).toBe(1000);
  });
  it("capital = apports + gains à chaque point", () => {
    for (const p of s) expect(p.capital).toBe(p.apports + p.gains);
  });
  it("apports cumulés strictement croissants", () => {
    for (let i = 1; i < s.length; i++) expect(s[i].apports).toBeGreaterThan(s[i - 1].apports);
  });
});

/* ── fvBandSeries (bandes pess/base/opt) ─────────────────────────── */
describe("fvBandSeries", () => {
  const band = fvBandSeries(1000, 100, RATE_SCENARIOS.etf, 20, 2026);
  it("range = [pess, opt] et ordonné", () => {
    for (const p of band) {
      expect(p.range[0]).toBe(p.capPess);
      expect(p.range[1]).toBe(p.capOpt);
      expect(p.capOpt).toBeGreaterThanOrEqual(p.capPess);
    }
  });
  it("scénario base encadré par pess et opt", () => {
    const last = band[band.length - 1];
    expect(last.capital).toBeGreaterThanOrEqual(last.capPess);
    expect(last.capital).toBeLessThanOrEqual(last.capOpt);
  });
});

/* ── Prêt / amortissement ────────────────────────────────────────── */
describe("loanPayment / loanRemaining", () => {
  it("mensualité positive et cohérente", () => {
    const pmt = loanPayment(200000, 0.035, 25);
    expect(pmt).toBeGreaterThan(0);
    // ~1001 €/mois pour 200k à 3,5% sur 25 ans
    expect(pmt).toBeCloseTo(1001, 0);
  });
  it("capital restant = principal à 0 mensualité", () => {
    expect(loanRemaining(200000, 0.035, 25, 0)).toBeCloseTo(200000, 4);
  });
  it("capital restant = 0 à échéance", () => {
    expect(loanRemaining(200000, 0.035, 25, 25 * 12)).toBe(0);
  });
  it("amortissement convexe : moins remboursé au début qu'à la fin (intérêts dominent)", () => {
    const p = 200000, r = 0.035, y = 25;
    const remAfter1y = loanRemaining(p, r, y, 12);
    const remAfter2y = loanRemaining(p, r, y, 24);
    const firstYearPrincipal = p - remAfter1y;
    const secondYearPrincipal = remAfter1y - remAfter2y;
    expect(secondYearPrincipal).toBeGreaterThan(firstYearPrincipal);
  });
  it("taux nul : amortissement linéaire", () => {
    expect(loanRemaining(1200, 0, 1, 6)).toBeCloseTo(600, 6);
  });
});

describe("loanFromPayment / loanCap", () => {
  it("inverse approx de loanPayment", () => {
    const pmt = loanPayment(150000, 0.035, 20);
    expect(loanFromPayment(pmt, 0.035, 20)).toBeCloseTo(150000, 2);
  });
  it("loanCap = version arrondie", () => {
    expect(loanCap(1000, 0.035, 20)).toBe(Math.round(loanFromPayment(1000, 0.035, 20)));
  });
});

/* ── immoDetailedSeries (achat à crédit réel) ────────────────────── */
describe("immoDetailedSeries", () => {
  const price = 300000;
  const s = immoDetailedSeries(price, 25, 2026);
  it("inclut frais de notaire + apport dans le cash de départ (année 0)", () => {
    const expected = Math.round(price * IMMO_DOWN_FRAC + price * IMMO_NOTARY_FRAC);
    expect(s[0].apports).toBe(expected);
  });
  it("equity exposé en alias pour le graphique", () => {
    expect(s[0].equity).toBe(s[0].capital);
  });
  it("equity finale ≈ valeur du bien (prêt soldé)", () => {
    const last = s[s.length - 1];
    expect(Math.abs(last.capital - last.propValue)).toBeLessThan(2);
  });
  it("le bien s'apprécie dans le temps", () => {
    expect(s[s.length - 1].propValue).toBeGreaterThan(s[0].propValue);
  });
  it("gain = equity − cash investi", () => {
    for (const p of s) expect(p.gains).toBe(p.capital - p.apports);
  });
});

/* ── longTermGain ────────────────────────────────────────────────── */
describe("longTermGain", () => {
  it("gain = capital composé − apports versés, positif", () => {
    expect(longTermGain(100, 20, 0.07)).toBeGreaterThan(0);
  });
  it("gain nul si taux nul", () => {
    expect(longTermGain(100, 20, 0)).toBe(0);
  });
});

/* ── yearsTo / monthsTo / yearsToTarget ──────────────────────────── */
describe("yearsTo", () => {
  it("0 si déjà atteint", () => {
    expect(yearsTo(100000, 0, 0.05, 50000)).toBe(0);
  });
  it("null si hors d'atteinte sous 80 ans", () => {
    expect(yearsTo(0, 1, 0.01, 1e12)).toBeNull();
  });
  it("atteint la cible en un nombre d'années croissant avec la cible", () => {
    const a = yearsTo(0, 500, 0.06, 50000);
    const b = yearsTo(0, 500, 0.06, 100000);
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

describe("monthsTo", () => {
  it("0 si déjà atteint", () => {
    expect(monthsTo(60000, 0, 0.05, 50000)).toBe(0);
  });
  it("plus fin que yearsTo (mois ≤ années*12)", () => {
    const target = 80000;
    const m = monthsTo(0, 500, 0.06, target);
    const y = yearsTo(0, 500, 0.06, target);
    expect(m).toBeLessThanOrEqual(y * 12);
  });
});

describe("yearsToTarget", () => {
  it("null si pas d'épargne mensuelle", () => {
    expect(yearsToTarget(0, 0.05, 10000)).toBeNull();
  });
  it("renvoie une durée décimale positive", () => {
    expect(yearsToTarget(500, 0.06, 50000)).toBeGreaterThan(0);
  });
});

/* ── Crédit immobilier : rembourser vs investir ──────────────────── */
describe("monthlyPaymentFromRemaining", () => {
  it("cohérent avec loanPayment", () => {
    expect(monthlyPaymentFromRemaining(200000, 0.035, 300)).toBeCloseTo(loanPayment(200000, 0.035, 25), 4);
  });
  it("taux nul = amortissement linéaire", () => {
    expect(monthlyPaymentFromRemaining(12000, 0, 12)).toBeCloseTo(1000, 6);
  });
});

describe("earlyRepaymentPenalty (IRA)", () => {
  it("plafonnée à 3 % du capital restant", () => {
    // taux 8 % → 6 mois d'intérêts = 4 % > plafond 3 % → plafonné à 3 %
    const ira = earlyRepaymentPenalty(200000, 200000, 0.08);
    expect(ira).toBeCloseTo(200000 * 0.03, 6);
  });
  it("sinon = 6 mois d'intérêts sur le capital remboursé", () => {
    // petit taux → 6 mois d'intérêts < 3%
    const ira = earlyRepaymentPenalty(100000, 100000, 0.01);
    expect(ira).toBeCloseTo(100000 * (0.01 / 12) * 6, 6);
  });
  it("jamais négative", () => {
    expect(earlyRepaymentPenalty(0, 100000, 0.03)).toBe(0);
  });
});

describe("repayVsInvest", () => {
  const base = {
    remainingPrincipal: 150000, annualRate: 0.012, insuranceMonthly: 30,
    remainingMonths: 180, lumpSum: 160000, taxRate: 0.30,
  };
  it("prêt pas cher (1,2 %) + bon rendement → garder gagne", () => {
    const r = repayVsInvest({ ...base, investReturn: 0.07 });
    expect(r.winner).toBe("keep");
    expect(r.keepWealth).toBeGreaterThan(r.repayWealth);
  });
  it("prêt cher (5 %) + rendement faible → rembourser gagne", () => {
    const r = repayVsInvest({ ...base, annualRate: 0.05, investReturn: 0.01 });
    expect(r.winner).toBe("repay");
  });
  it("IRA et mensualité exposées et positives", () => {
    const r = repayVsInvest({ ...base, investReturn: 0.05 });
    expect(r.ira).toBeGreaterThan(0);
    expect(r.monthlyDebt).toBeGreaterThan(r.pmtPI);   // assurance incluse
  });
  it("remboursement total → mensualité entièrement libérée", () => {
    const r = repayVsInvest({ ...base, investReturn: 0.05 });
    expect(r.newPrincipal).toBe(0);
    expect(r.freedMonthly).toBeCloseTo(r.monthlyDebt, 6);
  });
});

describe("breakevenInvestRate", () => {
  it("renvoie un taux entre 0 et 20 %", () => {
    const r = breakevenInvestRate({
      remainingPrincipal: 150000, annualRate: 0.03, insuranceMonthly: 25,
      remainingMonths: 180, lumpSum: 160000, taxRate: 0.30,
    });
    expect(r === null || (r > 0 && r <= 0.20)).toBe(true);
  });
});

/* ── PMCA (plus-values crypto, art. 150 VH bis) ──────────────────── */
describe("pmcaCessions / pmcaSummary", () => {
  it("formule légale : 1 achat puis 1 cession partielle", () => {
    // Achat 1 BTC à 20 000. Cession 0.5 BTC à 30 000 (proceeds 15 000),
    // valeur globale portefeuille au moment = 30 000 (1 BTC × 30 000).
    // fraction acq = 20000 × (15000/30000) = 10000 → gain = 15000 − 10000 = 5000.
    const lots  = [{ id: 1, symbol: "BTC", amount: 1, costPerUnit: 20000, date: "2025-01-01" }];
    const sells = [{ id: 2, symbol: "BTC", amount: 0.5, pricePerUnit: 30000, date: "2025-06-01", portfolioValue: 30000 }];
    const [c] = pmcaCessions(lots, sells);
    expect(c.proceeds).toBe(15000);
    expect(c.acquisitionFraction).toBeCloseTo(10000, 6);
    expect(c.gain).toBeCloseTo(5000, 6);
    expect(c.estimated).toBe(false);
  });

  it("globale au portefeuille (multi-actifs), pas FIFO par actif", () => {
    const lots = [
      { id: 1, symbol: "BTC", amount: 1, costPerUnit: 20000, date: "2025-01-01" },
      { id: 2, symbol: "ETH", amount: 10, costPerUnit: 2000, date: "2025-02-01" }, // +20000 → acq total 40000
    ];
    // Cession ETH : proceeds 5000, valeur globale 50000 → fraction = 40000×(5000/50000)=4000 → gain 1000
    const sells = [{ id: 3, symbol: "ETH", amount: 2, pricePerUnit: 2500, date: "2025-05-01", portfolioValue: 50000 }];
    const [c] = pmcaCessions(lots, sells);
    expect(c.acquisitionFraction).toBeCloseTo(4000, 6);
    expect(c.gain).toBeCloseTo(1000, 6);
  });

  it("cession sans valeur de portefeuille → marquée estimée", () => {
    const lots  = [{ id: 1, symbol: "BTC", amount: 1, costPerUnit: 20000, date: "2025-01-01" }];
    const sells = [{ id: 2, symbol: "BTC", amount: 0.5, pricePerUnit: 30000, date: "2025-06-01" }];
    const [c] = pmcaCessions(lots, sells);
    expect(c.estimated).toBe(true);
  });

  it("exonération si total annuel des cessions ≤ 305 €", () => {
    const lots  = [{ id: 1, symbol: "BTC", amount: 1, costPerUnit: 100, date: "2025-01-01" }];
    const sells = [{ id: 2, symbol: "BTC", amount: 0.01, pricePerUnit: 200, date: "2025-06-01", portfolioValue: 200 }];
    const sum = pmcaSummary(lots, sells, 2025);
    expect(sum.totalProceeds).toBeLessThanOrEqual(SEUIL_EXONERATION_CESSION);
    expect(sum.exonerated).toBe(true);
    expect(sum.tax).toBe(0);
  });

  it("impôt = 30 % PFU du gain net si non exonéré", () => {
    const lots  = [{ id: 1, symbol: "BTC", amount: 1, costPerUnit: 20000, date: "2025-01-01" }];
    const sells = [{ id: 2, symbol: "BTC", amount: 0.5, pricePerUnit: 30000, date: "2025-06-01", portfolioValue: 30000 }];
    const sum = pmcaSummary(lots, sells, 2025);
    expect(sum.netGain).toBeCloseTo(5000, 6);
    expect(sum.tax).toBeCloseTo(1500, 6); // 5000 × 30%
  });

  it("ne compte que les cessions de l'année demandée", () => {
    const lots  = [{ id: 1, symbol: "BTC", amount: 2, costPerUnit: 20000, date: "2024-01-01" }];
    const sells = [
      { id: 2, symbol: "BTC", amount: 0.5, pricePerUnit: 30000, date: "2024-06-01", portfolioValue: 60000 },
      { id: 3, symbol: "BTC", amount: 0.5, pricePerUnit: 30000, date: "2025-06-01", portfolioValue: 45000 },
    ];
    const sum = pmcaSummary(lots, sells, 2025);
    expect(sum.cessions).toHaveLength(1);
    expect(sum.cessions[0].date).toBe("2025-06-01");
  });
});

/* ── PER (Plan Épargne Retraite) ─────────────────────────────────── */
describe("perSimulation", () => {
  const base = { monthly: 200, years: 20, tmiNow: 0.30, tmiRetraite: 0.11, annualReturn: 0.05 };

  it("économie d'impôt annuelle = versement annuel × TMI actuelle", () => {
    const s = perSimulation(base);
    expect(s.economieImpotAnnuelle).toBeCloseTo(200 * 12 * 0.30, 6);
  });

  it("capital brut > versements (rendement positif)", () => {
    const s = perSimulation(base);
    expect(s.capitalBrut).toBeGreaterThan(s.versements);
  });

  it("TMI entrée > TMI sortie → PER gagne", () => {
    const s = perSimulation(base);
    expect(s.winner).toBe("per");
    expect(s.avantage).toBeGreaterThan(0);
  });

  it("TMI égales → PER reste ≥ CTO (avantage du report d'impôt)", () => {
    const s = perSimulation({ ...base, tmiNow: 0.30, tmiRetraite: 0.30 });
    expect(s.netPER).toBeGreaterThanOrEqual(s.netCTO - 1);
  });

  it("TMI sortie très élevée vs entrée faible → CTO peut gagner", () => {
    const s = perSimulation({ ...base, tmiNow: 0.11, tmiRetraite: 0.41 });
    expect(s.netCTO).toBeGreaterThan(0);
    expect(s.avantage).toBeLessThan(perSimulation(base).avantage);
  });
});

describe("perSeries", () => {
  it("years+1 points, croissants", () => {
    const s = perSeries({ monthly: 200, years: 10, annualReturn: 0.05 }, 2026);
    expect(s).toHaveLength(11);
    expect(s[10].per).toBeGreaterThan(s[1].per);
  });
  it("avec TMI > 0, PER (avec éco. impôt réinvestie) dépasse le CTO", () => {
    const s = perSeries({ monthly: 200, years: 10, annualReturn: 0.05, tmiNow: 0.30 }, 2026);
    expect(s[10].per).toBeGreaterThan(s[10].cto);
  });
  it("avec TMI = 0, PER et CTO se rejoignent (pas de levier)", () => {
    const s = perSeries({ monthly: 200, years: 10, annualReturn: 0.05, tmiNow: 0 }, 2026);
    expect(s[10].per).toBe(s[10].cto);
  });
});

/* ── Mes crédits ──────────────────────────────────────────────────── */
describe("crédits — amortissable", () => {
  // Crédit auto : 20 000 € à 4 %/an sur 48 mois, démarré il y a 24 mois.
  const now = new Date("2026-01-15");
  const c = { id: 1, type: "auto", mode: "amortissable", label: "Voiture",
              capitalInitial: 20000, taux: 4, dureeMois: 48, dateDebut: "2024-01-15" };

  it("monthsElapsed compte les mois entiers", () => {
    expect(monthsElapsed("2024-01-15", now)).toBe(24);
    expect(monthsElapsed("2030-01-15", now)).toBe(0); // futur → 0
  });

  it("mensualité = formule d'annuité", () => {
    expect(creditMensualite(c)).toBeCloseTo(loanPayment(20000, 0.04, 4), 6);
  });

  it("capital restant au début = capital initial", () => {
    expect(creditCapitalRestant(c, new Date("2024-01-15"))).toBeCloseTo(20000, 0);
  });

  it("capital restant à la fin ≈ 0", () => {
    expect(creditCapitalRestant(c, new Date("2028-02-15"))).toBeCloseTo(0, 6);
  });

  it("capital restant à mi-parcours est entre 0 et l'initial", () => {
    const r = creditCapitalRestant(c, now);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(20000);
  });

  it("intérêts restants décroissent avec le temps", () => {
    const tot = creditInteretsRestants(c, new Date("2024-01-15"));
    const mid = creditInteretsRestants(c, now);
    expect(mid).toBeLessThan(tot);
    expect(mid).toBeGreaterThanOrEqual(0);
  });

  it("coût total = mensualité × durée − capital", () => {
    expect(creditCoutTotal(c)).toBeCloseTo(creditMensualite(c) * 48 - 20000, 6);
  });

  it("date de fin = début + durée", () => {
    expect(creditDateFin(c).getFullYear()).toBe(2028);
    expect(creditDateFin(c).getMonth()).toBe(0); // janvier
  });
});

describe("crédits — revolving", () => {
  const c = { id: 2, type: "revolving", mode: "revolving", label: "Carte",
              capitalRestant: 3000, taux: 18, paiementMensuel: 150 };

  it("mensualité = paiement saisi", () => {
    expect(creditMensualite(c)).toBe(150);
  });
  it("capital restant = saisi", () => {
    expect(creditCapitalRestant(c)).toBe(3000);
  });
  it("intérêts mensuels = capital × taux / 12", () => {
    expect(creditInteretsRestants(c)).toBeCloseTo(3000 * 0.18 / 12, 6);
  });
  it("coût total et date de fin = null (pas d'échéance)", () => {
    expect(creditCoutTotal(c)).toBeNull();
    expect(creditDateFin(c)).toBeNull();
  });
});

describe("creditsToPassifCategory", () => {
  it("mappe les crédits en items passif avec capital restant arrondi", () => {
    const cat = creditsToPassifCategory([
      { id: 2, mode: "revolving", label: "Carte", capitalRestant: 3000, taux: 18, paiementMensuel: 150 },
    ]);
    expect(cat.label).toBe("Crédits");
    expect(cat.items).toHaveLength(1);
    expect(cat.items[0].value).toBe(3000);
  });
  it("liste vide → catégorie sans items", () => {
    expect(creditsToPassifCategory([]).items).toHaveLength(0);
  });
});

describe("crédits — capital déjà remboursé (override)", () => {
  // 100 000 € à 3 %/an sur 240 mois, 30 000 € déjà remboursés, sans date fiable.
  const c = { type: "immo", mode: "amortissable", label: "Maison",
              capitalInitial: 100000, taux: 3, dureeMois: 240,
              dateDebut: "2099-01-01", capitalRembourse: 30000 };

  it("capital restant = initial − remboursé (ignore la date)", () => {
    expect(creditCapitalRestant(c)).toBe(70000);
  });
  it("mensualités restantes < durée totale et > 0", () => {
    const n = creditRemainingMonths(c);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(240);
  });
  it("intérêts restants cohérents = mensualité × mois restants − capital restant", () => {
    const i = creditInteretsRestants(c);
    expect(i).toBeCloseTo(creditMensualite(c) * creditRemainingMonths(c) - 70000, 4);
    expect(i).toBeGreaterThan(0);
  });
  it("échéance dérivée = aujourd'hui + mois restants (futur)", () => {
    expect(creditDateFin(c).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("crédits — garde-fous & helpers", () => {
  it("dureeMois = 0 ne produit pas Infinity/NaN", () => {
    const c = { mode: "amortissable", capitalInitial: 10000, taux: 3, dureeMois: 0 };
    expect(Number.isFinite(creditMensualite(c))).toBe(true);
    expect(Number.isFinite(creditCapitalRestant(c, new Date()))).toBe(true);
  });

  it("creditRevolvingStuck : paiement ≤ intérêts mensuels → bloqué", () => {
    const stuck = { mode: "revolving", capitalRestant: 3000, taux: 20, paiementMensuel: 40 }; // intérêt ≈ 50/mois
    const ok    = { mode: "revolving", capitalRestant: 3000, taux: 20, paiementMensuel: 200 };
    expect(creditRevolvingStuck(stuck)).toBe(true);
    expect(creditRevolvingStuck(ok)).toBe(false);
  });

  it("creditProjectedRestant : amortissable décroît jusqu'à 0", () => {
    const c = { mode: "amortissable", capitalInitial: 20000, taux: 4, dureeMois: 48, dateDebut: new Date().toISOString().slice(0,10) };
    const now = creditProjectedRestant(c, 0);
    const mid = creditProjectedRestant(c, 24);
    const end = creditProjectedRestant(c, 48);
    expect(mid).toBeLessThan(now);
    expect(end).toBeCloseTo(0, 0);
  });

  it("creditProjectedRestant : revolving bloqué ne descend pas à 0", () => {
    const stuck = { mode: "revolving", capitalRestant: 3000, taux: 20, paiementMensuel: 40 };
    expect(creditProjectedRestant(stuck, 60)).toBeGreaterThan(0);
  });
});

describe("revenu lissé", () => {
  // 12 mois, dont 3 à 0 € (freelance creux)
  const histoVar = [4000,0,3000,5000,0,4500,3500,0,4200,3800,5000,4000]
    .map((rev, i) => ({ m: `M${i}`, rev, dep: 1500, inv: 0 }));
  const histoStable = Array.from({ length: 12 }, (_, i) => ({ m: `M${i}`, rev: 3000, dep: 1500, inv: 0 }));

  it("smoothedMonthlyIncome = moyenne des rev sur la fenêtre (zéros inclus)", () => {
    const total = 4000+0+3000+5000+0+4500+3500+0+4200+3800+5000+4000;
    expect(smoothedMonthlyIncome(histoVar, 12)).toBeCloseTo(total / 12, 6);
  });
  it("smoothedMonthlyIncome ne prend que les N derniers mois", () => {
    expect(smoothedMonthlyIncome(histoStable, 3)).toBeCloseTo(3000, 6);
  });
  it("smoothedMonthlyIncome histo vide → 0", () => {
    expect(smoothedMonthlyIncome([], 12)).toBe(0);
  });
  it("incomeCV élevé pour revenus en dents de scie, ~0 pour constant", () => {
    expect(incomeCV(histoVar, 12)).toBeGreaterThan(INCOME_CV_THRESHOLD);
    expect(incomeCV(histoStable, 12)).toBeCloseTo(0, 6);
  });
  it("isIncomeVariable : vrai si CV > seuil sur ≥ 4 mois", () => {
    expect(isIncomeVariable(histoVar, "salarie_stable")).toBe(true);
  });
  it("isIncomeVariable : faux pour salarié stable régulier", () => {
    expect(isIncomeVariable(histoStable, "salarie_stable")).toBe(false);
  });
  it("isIncomeVariable : vrai par fallback profil même si CV faible", () => {
    expect(isIncomeVariable(histoStable, "independant")).toBe(true);
    expect(isIncomeVariable(histoStable, "interimaire")).toBe(true);
  });
  it("isIncomeVariable : faux si < 4 mois de données et profil stable", () => {
    const court = histoVar.slice(0, 3);
    expect(isIncomeVariable(court, "salarie_stable")).toBe(false);
  });
});
