import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── Mock du client Supabase ──────────────────────────────────────────
   Builder chaînable : from().select().eq() (lecture) et from().upsert() (écriture).
   `__setCloudRows` configure ce que renvoie une lecture ; `__upserts` capture
   les écritures pour assertion.
   ──────────────────────────────────────────────────────────────────── */
let cloudRows = [];
const upserts = [];

const builder = {
  select() { return this; },
  eq() { return Promise.resolve({ data: cloudRows, error: null }); },
  upsert(rows) { upserts.push(rows); return Promise.resolve({ error: null }); },
};

vi.mock("./supabaseClient.js", () => ({
  supabase: { from: () => builder },
  isSupabaseConfigured: true,
}));

import { storage, hydrateFromCloud, pushAllToCloud, clearCloudSync, flushPendingCloudWrites, syncOnLogin, clearLocalAppData } from "./storage.js";

/* ── Stub localStorage (Map en mémoire) ──────────────────────────────── */
function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
    _map: m,
  };
}

beforeEach(() => {
  cloudRows = [];
  upserts.length = 0;
  vi.stubGlobal("localStorage", makeLocalStorage());
  clearCloudSync();
});

/* ── hydrateFromCloud ─────────────────────────────────────────────────── */
describe("hydrateFromCloud", () => {
  it("écrit les lignes cloud dans le cache local", async () => {
    cloudRows = [
      { key: "wt_transactions", value: [{ id: 1, amount: -500 }] },
      { key: "wt_plan", value: "premium" },
    ];
    await hydrateFromCloud("user-123");
    expect(storage.get("wt_transactions", null)).toEqual([{ id: 1, amount: -500 }]);
    expect(storage.get("wt_plan", null)).toBe("premium");
  });

  it("ne fait rien sans userId", async () => {
    await hydrateFromCloud(null);
    expect(localStorage.length).toBe(0);
  });

  it("cloud vide laisse le cache local intact", async () => {
    storage.set("wt_local", { a: 1 });
    cloudRows = [];
    await hydrateFromCloud("user-123");
    expect(storage.get("wt_local", null)).toEqual({ a: 1 });
  });
});

/* ── pushAllToCloud ───────────────────────────────────────────────────── */
describe("pushAllToCloud", () => {
  it("pousse tout le localStorage en upsert", async () => {
    storage.set("wt_a", { x: 1 });
    storage.set("wt_b", "hello");
    await pushAllToCloud("user-123");
    expect(upserts).toHaveLength(1);
    const rows = upserts[0];
    expect(rows).toHaveLength(2);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.wt_a).toEqual({ x: 1 });
    expect(byKey.wt_b).toBe("hello");
    expect(rows.every((r) => r.user_id === "user-123")).toBe(true);
  });

  it("ne pousse rien si localStorage vide", async () => {
    await pushAllToCloud("user-123");
    expect(upserts).toHaveLength(0);
  });

  it("ignore les valeurs non-JSON", async () => {
    localStorage.setItem("wt_bad", "{not json");
    storage.set("wt_good", 42);
    await pushAllToCloud("user-123");
    const rows = upserts[0];
    expect(rows.map((r) => r.key)).toContain("wt_good");
    expect(rows.map((r) => r.key)).not.toContain("wt_bad");
  });

  it("ne synchronise JAMAIS les clés système (token auth Supabase)", async () => {
    localStorage.setItem("sb-abcd-auth-token", JSON.stringify({ access_token: "secret" }));
    storage.set("wt_x", 1);
    await pushAllToCloud("user-123");
    const rows = upserts[0] || [];
    expect(rows.map((r) => r.key)).toContain("wt_x");
    expect(rows.map((r) => r.key)).not.toContain("sb-abcd-auth-token");
  });
});

/* ── write-through après login ────────────────────────────────────────── */
describe("write-through cloud", () => {
  it("storage.set pousse en cloud une fois le user actif", async () => {
    await pushAllToCloud("user-123"); // pose activeUserId
    upserts.length = 0;
    storage.set("wt_new", { v: 9 });
    // L'écriture cloud est debouncée : on force l'envoi puis on laisse résoudre.
    flushPendingCloudWrites();
    await Promise.resolve();
    expect(upserts.length).toBeGreaterThanOrEqual(1);
    expect(upserts[0].key).toBe("wt_new");
    expect(upserts[0].value).toEqual({ v: 9 });
  });

  it("clearCloudSync stoppe le write-through", async () => {
    await pushAllToCloud("user-123");
    clearCloudSync();
    upserts.length = 0;
    storage.set("wt_x", 1);
    await Promise.resolve();
    expect(upserts).toHaveLength(0);
  });
});

/* ── Isolation multi-utilisateur (appareil partagé) — SÉCURITÉ ──────────── */
describe("isolation multi-utilisateur", () => {
  it("purge les données d'un autre utilisateur au login et ne les pousse PAS dans le nouveau compte", async () => {
    // Le frère s'est connecté avant : ses données traînent en local.
    storage.set("wt_transactions", [{ id: 1, amount: -9999 }]);
    localStorage.setItem("wealthtrack_data_owner", "frere-uid");
    cloudRows = [];        // le nouvel utilisateur a un cloud VIDE
    upserts.length = 0;

    await syncOnLogin("moi-uid");

    // Les données du frère sont parties, rien n'a été poussé dans mon compte.
    expect(storage.get("wt_transactions", null)).toBeNull();
    expect(upserts).toHaveLength(0);
    expect(localStorage.getItem("wealthtrack_data_owner")).toBe("moi-uid");
  });

  it("conserve et sème le cloud pour le MÊME utilisateur de retour (cloud vide)", async () => {
    storage.set("wt_transactions", [{ id: 2, amount: -42 }]);
    localStorage.setItem("wealthtrack_data_owner", "moi-uid");
    cloudRows = [];
    upserts.length = 0;

    await syncOnLogin("moi-uid");

    // Mêmes données conservées + poussées en cloud (1re synchro).
    expect(storage.get("wt_transactions", null)).toEqual([{ id: 2, amount: -42 }]);
    expect(upserts.length).toBeGreaterThanOrEqual(1);
  });

  it("hydrate depuis le cloud du bon utilisateur après changement de compte", async () => {
    storage.set("wt_transactions", [{ id: 1, amount: -9999 }]); // données du frère
    localStorage.setItem("wealthtrack_data_owner", "frere-uid");
    cloudRows = [{ key: "wt_transactions", value: [{ id: 3, amount: -7 }] }]; // mon cloud

    await syncOnLogin("moi-uid");

    expect(storage.get("wt_transactions", null)).toEqual([{ id: 3, amount: -7 }]);
  });
});
