/**
 * WealthTrack — API Express
 * Endpoints: /api/import-transactions · /api/categorize · /api/save-transactions
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *   (ou: npm run server)
 *
 * Optionnel PostgreSQL:
 *   DATABASE_URL=postgresql://user:pass@localhost/wealthtrack node server.js
 */

import express    from "express";
import cors       from "cors";
import multer     from "multer";
import Papa       from "papaparse";
import rateLimit  from "express-rate-limit";
import path       from "path";

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/* CORS : localhost en dev + origines de prod via CORS_ORIGINS (séparées par des virgules).
   Ex : CORS_ORIGINS="https://wealthtrack.app,https://www.wealthtrack.app" */
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const localhostRe = /^http:\/\/localhost:\d+$/;

app.use(
  cors({
    origin(origin, cb) {
      // Pas d'origine (curl, same-origin) → autorisé
      if (!origin) return cb(null, true);
      if (localhostRe.test(origin) || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origine non autorisée par CORS : ${origin}`));
    },
  })
);
app.use(express.json({ limit: "64kb" }));

/* ─── Rate limiting ──────────────────────────────────────────────── */
const apiLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const importLimiter = rateLimit({ windowMs: 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: "Trop de fichiers importés. Réessayez dans une minute." } });
const aiLimiter     = rateLimit({ windowMs: 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: "Trop de requêtes IA. Réessayez dans une minute." } });

app.use("/api", apiLimiter);

/* ─── MIME / extension helper ────────────────────────────────────── */
const ALLOWED_EXTS = new Set([".csv", ".ofx"]);
function validateUpload(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return ALLOWED_EXTS.has(ext);
}

/* ─── Catégories & mots-clés (miroir frontend) ───────────────────── */
const CATS = {
  SALAIRE:           { label: "Salaire",         type: "revenu",           cat: "Salaire"      },
  LOYER:             { label: "Loyer",            type: "charge_fixe",     cat: "Logement"     },
  INVESTISSEMENT:    { label: "Investissement",   type: "investissement",  cat: "Épargne"      },
  PRET:              { label: "Prêt / Crédit",    type: "charge_fixe",     cat: "Crédit"       },
  CHARGES_FIXES:     { label: "Charges fixes",    type: "charge_fixe",     cat: "Assurances"   },
  CHARGES_VARIABLES: { label: "Dépenses var.",    type: "depense_variable",cat: "Alimentation" },
};

const KW = {
  SALAIRE:           /salaire|pa[iy]e|virement.*employ|bonus|prime\b|rémunération|remuneration/i,
  LOYER:             /loyer|rent\b|syndic|charge.*immeuble/i,
  INVESTISSEMENT:    /\betf\b|action\b|crypto|bitcoin|ethereum|bourse|trading|degiro|trade republic|binance|coinbase/i,
  PRET:              /remboursement.*cr[eé]dit|mensualit[eé]|emprunt|cr[eé]dit immobilier/i,
  CHARGES_FIXES:     /\bedf\b|[eé]lectricit[eé]|\beau\b|\bgaz\b|internet|adsl|fibre|assurance|t[eé]l[eé]phone|orange|sfr|bouygues|\bfree\b|netflix|spotify|cotisation|mutuelle|abonnement/i,
  CHARGES_VARIABLES: /carrefour|leclerc|lidl|auchan|restaurant|pizza|mcdonald|uber eats|deliveroo|ratp|sncf|pharmacie|essence/i,
};

function catByKw(desc) {
  for (const [cat, re] of Object.entries(KW)) {
    if (re.test(desc)) return { category: cat, confidence: 0.95 };
  }
  return null;
}

function catByAmount(amount) {
  if (amount >  1500) return { category: "SALAIRE",           confidence: 0.40 };
  if (amount < -800)  return { category: "LOYER",             confidence: 0.30 };
  if (amount < -1500) return { category: "INVESTISSEMENT",    confidence: 0.30 };
  return              { category: "CHARGES_VARIABLES", confidence: 0.20 };
}

function categorize(description, amount) {
  return catByKw(description) || catByAmount(amount);
}

/* ─── Tier 3 — Claude API ────────────────────────────────────────── */
async function categorizeWithAI(description, amount, date) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non définie");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 60,
      messages: [{
        role:    "user",
        content: `Catégorise cette transaction bancaire française. Réponds UNIQUEMENT avec: CATEGORY|confidence (ex: SALAIRE|0.92)\n\nCatégories possibles: SALAIRE, LOYER, INVESTISSEMENT, PRET, CHARGES_FIXES, CHARGES_VARIABLES\n\nDate: ${date}\nDescription: ${description}\nMontant: ${amount}€`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data  = await res.json();
  const text  = data.content?.[0]?.text?.trim() || "";
  const [cat, conf] = text.split("|");
  const category = Object.keys(CATS).includes(cat?.trim()) ? cat.trim() : "CHARGES_VARIABLES";
  return { category, confidence: parseFloat(conf) || 0.75 };
}

/* ─── Helpers CSV ────────────────────────────────────────────────── */
function detectCols(headers) {
  const find = (patterns) =>
    headers.find((h) => patterns.some((p) => new RegExp(p, "i").test(h.trim()))) || null;
  return {
    date:   find(["date", "jour", "day"]),
    desc:   find(["libellé", "libelle", "description", "label", "intitulé", "operation"]),
    amount: find(["^montant$", "^amount$", "montant", "amount", "somme", "valeur"]),
    debit:  find(["debit", "débit", "sortie"]),
    credit: find(["credit", "crédit", "entrée"]),
  };
}

function parseAmt(str) {
  const n = parseFloat(String(str || "0").replace(/[€\s ]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function parseDate(str) {
  const s = String(str || "").trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y.length === 2 ? "20" + y : y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

/* ─── Store en mémoire (→ remplacer par PostgreSQL) ─────────────── */
const memoryStore = [];

/* ─── DeFi — cache DefiLlama (actualisé toutes les heures) ──────── */
let defiCache = { data: null, fetchedAt: null };

async function refreshDefiCache() {
  try {
    const res  = await fetch("https://yields.llama.fi/pools");
    const json = await res.json();
    defiCache  = {
      data: (json.data || [])
        .filter(p => p.apy > 0 && p.apy < 150 && p.tvlUsd > 1_000_000)
        .filter(p => ["ethereum","polygon","arbitrum","optimism","base","avalanche","bsc"].includes(p.chain?.toLowerCase()))
        .sort((a, b) => b.tvlUsd - a.tvlUsd)
        .slice(0, 200),
      fetchedAt: new Date().toISOString(),
    };
    console.log(`  DeFi cache → ${defiCache.data.length} pools`);
  } catch (e) {
    console.error("  DeFi cache refresh failed:", e.message);
  }
}

refreshDefiCache();
setInterval(refreshDefiCache, 60 * 60 * 1000);

/* ─── Routes ─────────────────────────────────────────────────────── */

/**
 * POST /api/import-transactions
 * Accepte multipart/form-data { file: <CSV> }
 * Retourne { success, count, transactions }
 */
app.post("/api/import-transactions", importLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "Aucun fichier." });
    if (!validateUpload(req.file)) {
      return res.status(400).json({ success: false, error: "Format non supporté. Utilisez CSV ou OFX." });
    }

    const text   = req.file.buffer.toString("utf-8");
    const parsed = Papa.parse(text.trim(), {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      delimitersToGuess: [",", ";", "\t", "|"],
      transformHeader: (h) => h.trim(),
    });

    if (!parsed.data.length) return res.status(400).json({ success: false, error: "Fichier vide." });

    const headers = parsed.meta.fields || [];
    const cols    = detectCols(headers);

    const transactions = await Promise.all(
      parsed.data.map(async (row, i) => {
        let amount = 0;
        if (cols.amount) {
          amount = parseAmt(row[cols.amount]);
        } else {
          amount = parseAmt(row[cols.credit]) - parseAmt(row[cols.debit]);
        }

        const description = cols.desc ? String(row[cols.desc] || "").trim() : `Transaction ${i + 1}`;
        const date        = cols.date ? parseDate(String(row[cols.date] || "")) : "";

        let result = categorize(description, amount);

        // Tier 3 pour les faibles confiances
        if (result.confidence < 0.7 && process.env.ANTHROPIC_API_KEY) {
          try {
            result = await categorizeWithAI(description, amount, date);
          } catch (_) { /* garde le résultat Tier 1/2 */ }
        }

        return {
          date, description, amount,
          category:      result.category,
          confidence:    result.confidence,
          categoryLabel: CATS[result.category]?.label || result.category,
          type:          CATS[result.category]?.type  || "depense_variable",
          cat:           CATS[result.category]?.cat   || "Alimentation",
        };
      })
    );

    res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/categorize
 * Body: { description, amount, date }
 * Tier 3 à la demande (pour bouton ✨ dans le composant)
 */
app.post("/api/categorize", aiLimiter, async (req, res) => {
  const { description = "", amount = 0, date = "" } = req.body;

  if (typeof description !== "string" || description.length > 500) {
    return res.status(400).json({ success: false, error: "Description invalide." });
  }
  if (typeof amount !== "number" || !isFinite(amount)) {
    return res.status(400).json({ success: false, error: "Montant invalide." });
  }

  // Tier 1 d'abord
  const tier1 = catByKw(description);
  if (tier1 && tier1.confidence >= 0.8) {
    return res.json({ ...tier1, source: "keywords" });
  }

  // Tier 3 si clé disponible
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await categorizeWithAI(description, amount, date);
      return res.json({ ...result, source: "claude" });
    } catch (err) {
      return res.status(503).json({ success: false, error: "Claude API indisponible: " + err.message });
    }
  }

  // Fallback Tier 2
  const tier2 = catByAmount(amount);
  res.json({ ...tier2, source: "heuristic" });
});

/**
 * POST /api/save-transactions
 * Body: { profile, transactions: [{date, description, amount, category}] }
 */
app.post("/api/save-transactions", (req, res) => {
  const { profile = "default", transactions = [] } = req.body;
  if (typeof profile !== "string" || profile.length > 64) {
    return res.status(400).json({ success: false, error: "Profil invalide." });
  }
  if (!Array.isArray(transactions) || transactions.length > 5000) {
    return res.status(400).json({ success: false, error: "Transactions invalides." });
  }
  const saved = transactions.map((tx, i) => ({
    id:         `${Date.now()}_${i}`,
    profile_id: profile,
    created_at: new Date().toISOString(),
    ...tx,
  }));
  memoryStore.push(...saved);
  res.json({ success: true, imported: saved.length });
});

/**
 * GET /api/transactions?profile=default
 */
app.get("/api/transactions", (req, res) => {
  const { profile = "default" } = req.query;
  const txs = memoryStore.filter((t) => t.profile_id === profile);
  res.json({ success: true, count: txs.length, transactions: txs });
});

/* ─── Tax — store en mémoire ─────────────────────────────────────── */
/*
  SQL schema (PostgreSQL) :
  CREATE TABLE tax_lots (
    id BIGINT PRIMARY KEY, user_id TEXT DEFAULT 'default',
    symbol TEXT NOT NULL, name TEXT, amount NUMERIC NOT NULL,
    cost_per_unit NUMERIC NOT NULL, date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE tax_sells (
    id BIGINT PRIMARY KEY, user_id TEXT DEFAULT 'default',
    symbol TEXT NOT NULL, amount NUMERIC NOT NULL,
    price_per_unit NUMERIC NOT NULL, date DATE NOT NULL,
    notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE tax_reports (
    id SERIAL PRIMARY KEY, user_id TEXT DEFAULT 'default',
    tax_year INT NOT NULL, net_gain NUMERIC, estimated_tax NUMERIC,
    generated_at TIMESTAMPTZ DEFAULT NOW(), payload JSONB
  );
*/
const taxStore = { lots: [], sells: [], reports: [] };

function fifoServer(lots, sells) {
  const remaining = lots.map(l => ({ ...l, remaining: l.amount }));
  const results   = [];
  for (const sell of [...sells].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    let toSell = sell.amount, costUsed = 0;
    for (const lot of remaining.filter(l => l.symbol === sell.symbol).sort((a, b) => new Date(a.date) - new Date(b.date))) {
      if (toSell <= 0) break;
      const used = Math.min(lot.remaining, toSell);
      costUsed += used * lot.costPerUnit; lot.remaining -= used; toSell -= used;
    }
    const proceeds = sell.amount * sell.pricePerUnit;
    const gain     = proceeds - costUsed;
    results.push({ id: sell.id, date: sell.date, symbol: sell.symbol, amount: sell.amount, proceeds, costBasis: costUsed, gain, tax: gain > 0 ? gain * 0.30 : 0 });
  }
  return results;
}

/* GET /api/tax/ping */
app.get("/api/tax/ping", (_req, res) => res.json({ ok: true }));

/* GET /api/tax/lots */
app.get("/api/tax/lots", (req, res) => {
  const { userId = "default" } = req.query;
  res.json({ success: true, data: taxStore.lots.filter(l => l.userId === userId) });
});

/* POST /api/tax/lots */
app.post("/api/tax/lots", (req, res) => {
  const { id, symbol, name, amount, costPerUnit, date, userId = "default" } = req.body;
  if (!symbol || !amount || !costPerUnit || !date) return res.status(400).json({ success: false, error: "Champs manquants." });
  const lot = { id: id || Date.now(), userId, symbol: String(symbol).toUpperCase(), name: name || symbol, amount: +amount, costPerUnit: +costPerUnit, date };
  taxStore.lots.push(lot);
  res.json({ success: true, data: lot });
});

/* DELETE /api/tax/lots/:id */
app.delete("/api/tax/lots/:id", (req, res) => {
  const id = parseInt(req.params.id);
  taxStore.lots = taxStore.lots.filter(l => l.id !== id);
  res.json({ success: true });
});

/* GET /api/tax/sells */
app.get("/api/tax/sells", (req, res) => {
  const { userId = "default" } = req.query;
  res.json({ success: true, data: taxStore.sells.filter(s => s.userId === userId) });
});

/* POST /api/tax/sells */
app.post("/api/tax/sells", (req, res) => {
  const { id, symbol, amount, pricePerUnit, date, notes, userId = "default" } = req.body;
  if (!symbol || !amount || !pricePerUnit || !date) return res.status(400).json({ success: false, error: "Champs manquants." });
  const sell = { id: id || Date.now(), userId, symbol: String(symbol).toUpperCase(), amount: +amount, pricePerUnit: +pricePerUnit, date, notes: notes || "" };
  taxStore.sells.push(sell);
  res.json({ success: true, data: sell });
});

/* DELETE /api/tax/sells/:id */
app.delete("/api/tax/sells/:id", (req, res) => {
  const id = parseInt(req.params.id);
  taxStore.sells = taxStore.sells.filter(s => s.id !== id);
  res.json({ success: true });
});

/**
 * GET /api/tax/summary?year=2025&userId=default
 * Calcul FIFO côté serveur + rapport persisté
 */
app.get("/api/tax/summary", (req, res) => {
  const { year = new Date().getFullYear() - 1, userId = "default" } = req.query;
  const lots    = taxStore.lots.filter(l => l.userId === userId);
  const sells   = taxStore.sells.filter(s => s.userId === userId);
  const all     = fifoServer(lots, sells);
  const inYear  = all.filter(c => c.date?.startsWith(String(year)));

  const netGain = inYear.reduce((s, c) => s + c.gain, 0);
  const gains   = inYear.filter(c => c.gain > 0).reduce((s, c) => s + c.gain, 0);
  const losses  = inYear.filter(c => c.gain < 0).reduce((s, c) => s + c.gain, 0);
  const tax     = netGain > 0 ? netGain * 0.30 : 0;

  const byAsset = {};
  inYear.forEach(c => {
    if (!byAsset[c.symbol]) byAsset[c.symbol] = { symbol: c.symbol, gain: 0, loss: 0, tax: 0, proceeds: 0 };
    if (c.gain >= 0) byAsset[c.symbol].gain += c.gain; else byAsset[c.symbol].loss += c.gain;
    byAsset[c.symbol].tax      += c.tax;
    byAsset[c.symbol].proceeds += c.proceeds;
  });

  const report = { id: Date.now(), userId, taxYear: +year, netGain, gains, losses, estimatedTax: tax, byAsset: Object.values(byAsset), cessions: inYear, generatedAt: new Date().toISOString() };
  taxStore.reports.push(report);

  res.json({ success: true, ...report });
});

/**
 * GET /api/defi/opportunities
 * Cache DefiLlama actualisé toutes les heures
 */
app.get("/api/defi/opportunities", (req, res) => {
  if (!defiCache.data) {
    return res.status(503).json({ success: false, error: "Cache en cours d'initialisation, réessayez dans quelques secondes." });
  }
  const { chain, minApy, limit = 100 } = req.query;
  let data = defiCache.data;
  if (chain) data = data.filter(p => p.chain?.toLowerCase() === chain.toLowerCase());
  if (minApy) data = data.filter(p => p.apy >= parseFloat(minApy));
  res.json({ success: true, count: data.length, fetchedAt: defiCache.fetchedAt, data: data.slice(0, Math.min(parseInt(limit), 500)) });
});

/* ─── Staking Crypto.com ─────────────────────────────────────────── */
/*
 * Offres indicatives basées sur les taux publics Crypto.com Earn (mai 2025).
 * Le serveur essaie de scraper la page live ; si Cloudflare bloque ou que le
 * rendu JS est nécessaire, il retombe sur ce dataset statique.
 * Source : https://crypto.com/en-fr/staking
 */
const STAKING_OFFERS_FALLBACK = [
  // ── Flagship & native ───────────────────────────────────────────
  { coin:"CRO",  name:"Crypto.com Coin",  flexApy:10.0, lock1m:12.0, lock3m:14.0, category:"native",  risk:"Faible",  note:"Taux de base sans carte ; boostedavec tier Ruby+" },
  // ── PoS haute performance ────────────────────────────────────────
  { coin:"TIA",  name:"Celestia",         flexApy:12.0, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"Unbonding 21 jours" },
  { coin:"INJ",  name:"Injective",        flexApy:11.5, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"Unbonding 21 jours" },
  { coin:"DOT",  name:"Polkadot",         flexApy:11.0, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"Unbonding 28 jours" },
  { coin:"EGLD", name:"MultiversX",       flexApy: 9.0, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"10 jours d'unbonding" },
  { coin:"ATOM", name:"Cosmos",           flexApy: 8.0, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"Unbonding 21 jours" },
  { coin:"DYDX", name:"dYdX",             flexApy: 7.5, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"Unbonding 30 jours" },
  { coin:"NEAR", name:"NEAR Protocol",    flexApy: 6.5, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"2-3 jours d'unbonding" },
  { coin:"SOL",  name:"Solana",           flexApy: 6.0, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"Liquide — pas d'unbonding" },
  { coin:"APT",  name:"Aptos",            flexApy: 6.0, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"" },
  { coin:"SEI",  name:"Sei",              flexApy: 6.0, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"21 jours d'unbonding" },
  { coin:"SUI",  name:"Sui",              flexApy: 5.5, lock1m:null, lock3m:null, category:"pos",     risk:"Élevé",   note:"" },
  { coin:"ADA",  name:"Cardano",          flexApy: 4.5, lock1m:null, lock3m:null, category:"pos",     risk:"Faible",  note:"Délégation, pas de lock" },
  { coin:"AVAX", name:"Avalanche",        flexApy: 4.5, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"" },
  { coin:"POL",  name:"Polygon (POL)",    flexApy: 4.0, lock1m:null, lock3m:null, category:"pos",     risk:"Faible",  note:"Anciennement MATIC" },
  { coin:"TRX",  name:"TRON",             flexApy: 4.0, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"3 jours d'unbonding" },
  { coin:"ALGO", name:"Algorand",         flexApy: 3.5, lock1m:null, lock3m:null, category:"pos",     risk:"Faible",  note:"Récompenses automatiques" },
  // ── Liquid staking ETH ──────────────────────────────────────────
  { coin:"ETH",  name:"Ethereum",         flexApy: 4.0, lock1m:null, lock3m:null, category:"eth",     risk:"Faible",  note:"Liquid staking — retrait sans délai" },
  // ── Earn / Lending ──────────────────────────────────────────────
  { coin:"XRP",  name:"XRP",              flexApy: 2.5, lock1m: 3.5, lock3m: 4.5, category:"earn",    risk:"Faible",  note:"" },
  { coin:"BNB",  name:"BNB",              flexApy: 2.5, lock1m: 3.5, lock3m: 4.5, category:"earn",    risk:"Faible",  note:"" },
  { coin:"LTC",  name:"Litecoin",         flexApy: 2.0, lock1m: 3.0, lock3m: 4.0, category:"earn",    risk:"Faible",  note:"" },
  { coin:"BTC",  name:"Bitcoin",          flexApy: 0.5, lock1m: 1.0, lock3m: 1.5, category:"earn",    risk:"Faible",  note:"Taux bas — asset peu adapté au staking" },
];

let stakingCache = { data: null, ts: 0, source: "none" };
const STAKING_TTL = 4 * 60 * 60 * 1000; // 4h

app.get("/api/staking-offers", async (req, res) => {
  if (stakingCache.data && Date.now() - stakingCache.ts < STAKING_TTL)
    return res.json({ success: true, source: stakingCache.source, ts: stakingCache.ts, data: stakingCache.data });

  try {
    const r = await fetch("https://crypto.com/en-fr/staking", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html  = await r.text();

    // Crypto.com est rendu côté client via Next.js — on tente d'extraire __NEXT_DATA__
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error("__NEXT_DATA__ absent");

    const nd      = JSON.parse(m[1]);
    const rewards = nd?.props?.pageProps?.pageData?.stakingRewards
                 || nd?.props?.pageProps?.stakingAssets
                 || null;

    if (!rewards || !Array.isArray(rewards) || rewards.length === 0)
      throw new Error("données non trouvées dans __NEXT_DATA__");

    // Normalisation vers notre format
    const parsed = rewards.map(r => ({
      coin:     r.symbol || r.coin || "?",
      name:     r.name || r.assetName || "",
      flexApy:  parseFloat(r.flexibleApy || r.apy || r.flexApy || 0),
      lock1m:   parseFloat(r.oneMonthApy || r.lock1m || 0) || null,
      lock3m:   parseFloat(r.threeMonthApy || r.lock3m || 0) || null,
      category: "scraped",
      risk:     "—",
      note:     r.description || "",
    })).filter(o => o.flexApy > 0);

    stakingCache = { ts: Date.now(), source: "live", data: parsed };
    console.log(`[staking] Scraped ${parsed.length} offres depuis crypto.com`);
    return res.json({ success: true, source: "live", ts: stakingCache.ts, data: parsed });

  } catch (e) {
    console.log(`[staking] Scrape échoué (${e.message}) → fallback statique`);
    stakingCache = { ts: Date.now(), source: "fallback", data: STAKING_OFFERS_FALLBACK };
    return res.json({ success: true, source: "fallback", ts: stakingCache.ts, data: STAKING_OFFERS_FALLBACK });
  }
});

/* ─── Démarrage ──────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  WealthTrack API  →  http://localhost:${PORT}`);
  console.log(`  Claude Tier 3    →  ${process.env.ANTHROPIC_API_KEY ? "✓ activé" : "✗ ANTHROPIC_API_KEY manquante"}\n`);
});
