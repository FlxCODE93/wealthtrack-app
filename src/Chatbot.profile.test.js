import { describe, it, expect } from "vitest";
import { classify } from "./Chatbot.jsx";

/* L'assistant doit adapter le fonds d'urgence au profil : CDI = 3 mois,
   revenus variables = 6 mois (cf. mkEmergencyFund). */
const ctxBase = {
  totals: { chargesFixes: 1500, depensesVar: 500, invest: 0 },
  simParams: {},
  patrimoine: { actifs: [], passifs: [] },
};

const tableText = (data) => (data.table || []).flat().join(" ");
const allText   = (data) => [data.intro, ...(data.bullets || []), data.note, tableText(data)].join(" ");

describe("Assistant — fonds d'urgence adapté au profil", () => {
  it("CDI : cible minimum 3 mois", () => {
    const data = classify("fonds d'urgence", { ...ctxBase, profileType: "salarie_stable" });
    expect(tableText(data)).toMatch(/3 mois/);
    expect(tableText(data)).not.toMatch(/9 mois/);
  });

  it("CDI : ne parle PAS de revenus variables/freelance", () => {
    const data = classify("fonds d'urgence", { ...ctxBase, profileType: "salarie_stable" });
    expect(allText(data).toLowerCase()).not.toMatch(/freelance|intérim|interim|variable/);
  });

  it("Indépendant : cible 6 à 9 mois", () => {
    const data = classify("fonds d'urgence", { ...ctxBase, profileType: "independant" });
    expect(tableText(data)).toMatch(/6 mois/);
    expect(tableText(data)).toMatch(/9 mois/);
  });

  it("Indépendant : mentionne les revenus variables", () => {
    const data = classify("fonds d'urgence", { ...ctxBase, profileType: "independant" });
    expect(allText(data).toLowerCase()).toMatch(/variable|freelance|intérim|interim/);
  });

  it("profil absent → comportement CDI par défaut (3 mois)", () => {
    const data = classify("fonds d'urgence", ctxBase);
    expect(tableText(data)).toMatch(/3 mois/);
  });
});
