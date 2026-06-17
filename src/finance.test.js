import { describe, it, expect } from "vitest";
import {
  fv, fvMonthly, fvDetailedSeries, fvBandSeries,
  loanPayment, loanRemaining, loanFromPayment, loanCap,
  immoDetailedSeries, longTermGain, yearsTo, monthsTo, yearsToTarget,
  RATE_SCENARIOS, IMMO_DOWN_FRAC, IMMO_NOTARY_FRAC,
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
