import { describe, it, expect } from "vitest";
import { coupleLinkState, shareFromPatrimoine } from "./couple.js";

const ME = "user-me";
const OTHER = "user-other";
const MY_EMAIL = "me@example.com";
const PARTNER_EMAIL = "partner@example.com";

describe("coupleLinkState", () => {
  it("retourne 'none' si aucun lien", () => {
    expect(coupleLinkState(null, ME, MY_EMAIL)).toBe("none");
    expect(coupleLinkState(undefined, ME, MY_EMAIL)).toBe("none");
  });

  it("'pending_outgoing' quand je suis le requester d'un lien pending", () => {
    const link = { status: "pending", requester_id: ME, partner_id: null, partner_email: PARTNER_EMAIL };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("pending_outgoing");
  });

  it("'pending_incoming' quand le lien pending vise mon email", () => {
    const link = { status: "pending", requester_id: OTHER, partner_id: null, partner_email: MY_EMAIL };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("pending_incoming");
  });

  it("compare les emails sans tenir compte de la casse", () => {
    const link = { status: "pending", requester_id: OTHER, partner_id: null, partner_email: "ME@Example.com" };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("pending_incoming");
  });

  it("'accepted' quand le lien est accepté et me concerne", () => {
    const asReq = { status: "accepted", requester_id: ME, partner_id: OTHER, partner_email: PARTNER_EMAIL };
    const asPart = { status: "accepted", requester_id: OTHER, partner_id: ME, partner_email: MY_EMAIL };
    expect(coupleLinkState(asReq, ME, MY_EMAIL)).toBe("accepted");
    expect(coupleLinkState(asPart, ME, MY_EMAIL)).toBe("accepted");
  });

  it("'declined' quand le requester voit son lien refusé", () => {
    const link = { status: "declined", requester_id: ME, partner_id: null, partner_email: PARTNER_EMAIL };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("declined");
  });

  it("'none' si le lien ne me concerne pas", () => {
    const link = { status: "pending", requester_id: OTHER, partner_id: null, partner_email: "tiers@example.com" };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("none");
  });
});

describe("shareFromPatrimoine", () => {
  const patrimoine = {
    actifs:  [{ items: [{ value: 100000 }, { value: 50000 }] }, { items: [{ value: 20000 }] }],
    passifs: [{ items: [{ value: 30000 }] }],
  };

  it("calcule netWorth = Σ actifs − Σ passifs", () => {
    const s = shareFromPatrimoine(patrimoine, { firstName: "Alex" }, 800);
    expect(s).toEqual({ firstName: "Alex", netWorth: 140000, monthly: 800 });
  });

  it("tolère un patrimoine vide / valeurs manquantes", () => {
    expect(shareFromPatrimoine({}, {}, undefined)).toEqual({ firstName: "", netWorth: 0, monthly: 0 });
    expect(shareFromPatrimoine({ actifs: [], passifs: [] }, { firstName: "Sam" }, 0))
      .toEqual({ firstName: "Sam", netWorth: 0, monthly: 0 });
  });
});
