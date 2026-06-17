import { describe, it, expect } from "vitest";
import {
  fv, fvMonthly, fvDetailedSeries, fvBandSeries,
  loanPayment, loanRemaining, loanFromPayment, loanCap,
  immoDetailedSeries, longTermGain, yearsTo, monthsTo, yearsToTarget,
  RATE_SCENARIOS, IMMO_DOWN_FRAC, IMMO_NOTARY_FRAC,
  monthlyPaymentFromRemaining, earlyRepaymentPenalty, repayVsInvest, breakevenInvestRate,
  pmcaCessions, pmcaSummary, SEUIL_EXONERATION_CESSION,
  perSimulation, perSeries,
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
});
