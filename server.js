/**
 * WealthTrack — API Express (service STATELESS)
 *
 * Principe : ce serveur ne stocke AUCUNE donnée utilisateur.
 *   - Les transactions, lots et ventes fiscales vivent côté client + Supabase
 *     (avec RLS). Le calcul fiscal FIFO est fait dans le front.
 *   - Le serveur ne fait que : catégorisation (heuristique + IA), parsing de
 *     fichiers importés, et proxy/cache de données PUBLIQUES (staking).
 *
 * Endpoints :
 *   POST /api/import-transactions  — parse CSV/OFX → transactions catégorisées
 *   POST /api/categorize           — catégorise une transaction (IA Tier 3)
 *   GET  /api/staking-offers       — offres staking (public, scrape + fallback)
 *   GET  /api/tax/ping             — health check (badge "serveur connecté")
 *   GET  /api/health               — health check
 *
 * Env :
 *   ANTHROPIC_API_KEY   clé Claude (catégorisation IA)
 *   CORS_ORIGINS        origines de prod autorisées (séparées par des virgules)
 *   PORT                port d'écoute (défaut 3001)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" }); // fallback

import express    from "express";
import cors       from "cors";
import multer     from "multer";
import Papa       from "papaparse";
import rateLimit  from "express-rate-limit";
import path       from "path";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.disable("x-powered-by");

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

/* ─── Authentification (vérif JWT Supabase) ──────────────────────────
   Protège les endpoints coûteux (IA). Le front envoie le token Supabase
   dans `Authorization: Bearer <jwt>`. On le valide via Supabase.
   Si SUPABASE_URL/ANON_KEY ne sont pas configurés (dev local), l'auth est
   désactivée (pass-through) pour ne pas bloquer le développement.
   Env : SUPABASE_URL, SUPABASE_ANON_KEY
   ──────────────────────────────────────────────────────────────────── */
const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseAnon = process.env.SUPABASE_ANON_KEY;
const authEnabled  = Boolean(supabaseUrl && supabaseAnon);
const supabaseAuth = authEnabled ? createClient(supabaseUrl, supabaseAnon) : null;

if (!authEnabled) {
  console.warn("  ⚠ Auth désactivée (SUPABASE_URL/ANON_KEY absents) — endpoints IA ouverts. NE PAS déployer ainsi.");
}

async function requireAuth(req, res, next) {
  if (!authEnabled) return next(); // dev local : pass-through
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: "Authentification requise." });
  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ success: false, error: "Session invalide." });
    req.user = data.user;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Session invalide." });
  }
}

/* ─── Vérification de plan (service_role) ────────────────────────────
   Lit le plan AUTORITATIF depuis la table `subscriptions` (écrite par le
   seul webhook Stripe). Bloque l'accès aux endpoints payants si le user
   n'a pas le plan requis. Protège les coûts API (IA) contre les abus.
   Env : SUPABASE_SERVICE_ROLE_KEY (clé service, JAMAIS exposée au front).
   ──────────────────────────────────────────────────────────────────── */
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const planEnabled  = Boolean(authEnabled && serviceKey);
const supabaseAdmin = planEnabled ? createClient(supabaseUrl, serviceKey) : null;
const PAID_STATUS  = new Set(["active", "trialing", "past_due"]);

if (authEnabled && !serviceKey) {
  console.warn("  ⚠ SUPABASE_SERVICE_ROLE_KEY absente — vérif de plan désactivée (endpoints payants ouverts aux comptes free).");
}

/** Middleware : exige que le user ait un des plans de `allowed` (set/array). */
function requirePlan(allowed) {
  const allow = new Set(allowed);
  return async (req, res, next) => {
    if (!planEnabled) return next(); // dev local / non configuré : pass-through
    try {
      const { data } = await supabaseAdmin
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", req.user.id)
        .maybeSingle();
      const active = data && PAID_STATUS.has(data.status);
      if (active && allow.has(data.plan)) return next();
      return res.status(403).json({ success: false, error: "Plan insuffisant pour cette fonctionnalité.", code: "PLAN_REQUIRED" });
    } catch {
      return res.status(403).json({ success: false, error: "Plan non vérifiable.", code: "PLAN_REQUIRED" });
    }
  };
}

/* ─── MIME / extension helper ────────────────────────────────────── */
const ALLOWED_EXTS = new Set([".csv", ".ofx", ".pdf"]);
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
  if (amount < -1500) return { category: "INVESTISSEMENT",    confidence: 0.30 };
  if (amount < -800)  return { category: "LOYER",             confidence: 0.30 };
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
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data  = await res.json();
  const text  = data.content?.[0]?.text?.trim() || "";
  const [cat, conf] = text.split("|");
  const category = Object.keys(CATS).includes(cat?.trim()) ? cat.trim() : "CHARGES_VARIABLES";
  return { category, confidence: parseFloat(conf) || 0.75 };
}

/* ─── Import PDF — extraction texte + structuration par Claude ───────
   Un relevé PDF n'est pas structuré : on extrait le texte brut, puis on
   demande à Claude de le transformer en transactions JSON. Gère la grande
   variété de mises en page des banques françaises.
   Retourne [{ date, description, amount }]. amount < 0 = débit. */
async function extractTransactionsFromPDF(buffer) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Import PDF indisponible (ANTHROPIC_API_KEY non configurée côté serveur).");

  let text = "";
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = (result.text || "").trim();
  } catch {
    throw new Error("PDF illisible ou corrompu.");
  }
  if (!text) throw new Error("Aucun texte trouvé dans le PDF (relevé scanné ? l'OCR n'est pas supporté).");

  const clipped = text.slice(0, 30000); // borne les coûts/latence

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Voici le texte brut d'un relevé bancaire français extrait d'un PDF. Extrais TOUTES les transactions.\n\nRéponds UNIQUEMENT avec un JSON valide : un tableau d'objets {"date":"YYYY-MM-DD","description":"libellé","amount":nombre}. Règles : amount NÉGATIF pour un débit/retrait, POSITIF pour un crédit/dépôt. Aucune transaction inventée. Aucun texte hors du JSON.\n\n---DÉBUT RELEVÉ---\n${clipped}\n---FIN RELEVÉ---`,
      }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Extraction IA échouée (Claude API ${res.status}).`);
  const data = await res.json();
  let out = (data.content?.[0]?.text || "").trim();
  out = out.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

  let arr;
  try { arr = JSON.parse(out); }
  catch { throw new Error("Le PDF n'a pas pu être interprété (format de relevé non reconnu)."); }
  if (!Array.isArray(arr)) throw new Error("Extraction PDF : format inattendu.");

  return arr
    .filter((t) => t && typeof t.amount === "number" && isFinite(t.amount))
    .slice(0, 5000)
    .map((t) => ({
      date:        String(t.date || "").slice(0, 10),
      description: String(t.description || "").trim().slice(0, 200) || "Transaction",
      amount:      t.amount,
    }));
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

/* ════════════════════════════════════════════════════════════════════
   ROUTES — stateless (aucune donnée utilisateur stockée serveur)
   ════════════════════════════════════════════════════════════════════ */

/* GET /api/health · GET /api/tax/ping — health checks */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY) }));
app.get("/api/tax/ping", (_req, res) => res.json({ ok: true }));

/**
 * POST /api/import-transactions
 * multipart/form-data { file: <CSV/OFX> } → { success, count, transactions }
 * Parse + catégorise. Ne stocke rien : le front persiste via Supabase.
 */
app.post("/api/import-transactions", requireAuth, requirePlan(["pro", "couple"]), importLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "Aucun fichier." });
    if (!validateUpload(req.file)) {
      return res.status(400).json({ success: false, error: "Format non supporté. Utilisez CSV, OFX ou PDF." });
    }

    const isPdf = /pdf/i.test(req.file.mimetype || "") || /\.pdf$/i.test(req.file.originalname || "");

    // Normalise tous les formats vers une liste { date, description, amount }.
    let rows;
    if (isPdf) {
      rows = await extractTransactionsFromPDF(req.file.buffer);
      if (!rows.length) return res.status(400).json({ success: false, error: "Aucune transaction détectée dans le PDF." });
    } else {
      const text   = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse(text.trim(), {
        header: true, skipEmptyLines: true, dynamicTyping: false,
        delimitersToGuess: [",", ";", "\t", "|"],
        transformHeader: (h) => h.trim(),
      });

      if (!parsed.data.length) return res.status(400).json({ success: false, error: "Fichier vide." });
      if (parsed.data.length > 5000) return res.status(400).json({ success: false, error: "Fichier trop volumineux (max 5000 lignes)." });

      const headers = parsed.meta.fields || [];
      const cols    = detectCols(headers);
      rows = parsed.data.map((row, i) => ({
        amount: cols.amount
          ? parseAmt(row[cols.amount])
          : parseAmt(row[cols.credit]) - parseAmt(row[cols.debit]),
        description: cols.desc ? String(row[cols.desc] || "").trim() : `Transaction ${i + 1}`,
        date:        cols.date ? parseDate(String(row[cols.date] || "")) : "",
      }));
    }

    // Catégorisation commune (mots-clés + IA Tier 3 sur les faibles confiances).
    const transactions = await Promise.all(
      rows.map(async ({ date, description, amount }) => {
        let result = categorize(description, amount);
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
    next(err);
  }
});

/**
 * POST /api/categorize
 * Body: { description, amount, date } → { category, confidence, source }
 */
app.post("/api/categorize", requireAuth, requirePlan(["pro", "couple"]), aiLimiter, async (req, res, next) => {
  try {
    const { description = "", amount = 0, date = "" } = req.body;

    if (typeof description !== "string" || description.length > 500) {
      return res.status(400).json({ success: false, error: "Description invalide." });
    }
    if (typeof amount !== "number" || !isFinite(amount)) {
      return res.status(400).json({ success: false, error: "Montant invalide." });
    }

    // Tier 1 (mots-clés)
    const tier1 = catByKw(description);
    if (tier1 && tier1.confidence >= 0.8) {
      return res.json({ ...tier1, source: "keywords" });
    }

    // Tier 3 (IA) si clé disponible
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const result = await categorizeWithAI(description, amount, date);
        return res.json({ ...result, source: "claude" });
      } catch (err) {
        return res.status(503).json({ success: false, error: "Claude API indisponible: " + err.message });
      }
    }

    // Fallback Tier 2 (montant)
    res.json({ ...catByAmount(amount), source: "heuristic" });
  } catch (err) {
    next(err);
  }
});

/* ─── Staking Crypto.com (données publiques) ─────────────────────────
 * Offres indicatives basées sur les taux publics Crypto.com Earn (mai 2025).
 * Le serveur tente de scraper la page live ; en cas d'échec (Cloudflare,
 * rendu JS, markup modifié), il retombe sur ce dataset statique.
 * ─────────────────────────────────────────────────────────────────── */
const STAKING_OFFERS_FALLBACK = [
  { coin:"CRO",  name:"Crypto.com Coin",  flexApy:10.0, lock1m:12.0, lock3m:14.0, category:"native",  risk:"Faible",  note:"Taux de base sans carte ; boosté avec tier Ruby+" },
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
  { coin:"ETH",  name:"Ethereum",         flexApy: 4.0, lock1m:null, lock3m:null, category:"eth",     risk:"Faible",  note:"Liquid staking — retrait sans délai" },
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
    const html = await r.text();

    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error("__NEXT_DATA__ absent");

    const nd      = JSON.parse(m[1]);
    const rewards = nd?.props?.pageProps?.pageData?.stakingRewards
                 || nd?.props?.pageProps?.stakingAssets
                 || null;

    if (!rewards || !Array.isArray(rewards) || rewards.length === 0)
      throw new Error("données non trouvées dans __NEXT_DATA__");

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

    if (parsed.length === 0) throw new Error("aucune offre exploitable");

    stakingCache = { ts: Date.now(), source: "live", data: parsed };
    console.log(`[staking] Scraped ${parsed.length} offres depuis crypto.com`);
    return res.json({ success: true, source: "live", ts: stakingCache.ts, data: parsed });
  } catch (e) {
    console.log(`[staking] Scrape échoué (${e.message}) → fallback statique`);
    stakingCache = { ts: Date.now(), source: "fallback", data: STAKING_OFFERS_FALLBACK };
    return res.json({ success: true, source: "fallback", ts: stakingCache.ts, data: STAKING_OFFERS_FALLBACK });
  }
});

/* ─── Stripe ──────────────────────────────────────────────────────────
   L'intégration Stripe (checkout + webhook) vit dans les Edge Functions
   Supabase (supabase/functions/stripe-*), co-localisées avec la DB/auth.
   Ce serveur Express ne gère QUE la vérification de plan (cf. requirePlan).
   ──────────────────────────────────────────────────────────────────── */

/* ─── 404 + gestionnaire d'erreurs global ────────────────────────── */
app.use("/api", (_req, res) => res.status(404).json({ success: false, error: "Endpoint introuvable." }));

app.use((err, _req, res, _next) => {
  // Erreur CORS → 403 ; reste → 500. Jamais de crash silencieux.
  if (err?.message?.startsWith("Origine non autorisée")) {
    return res.status(403).json({ success: false, error: "Origine non autorisée." });
  }
  console.error("Erreur serveur:", err?.message || err);
  res.status(err?.status || 500).json({ success: false, error: err?.message || "Erreur interne." });
});

/* ─── Démarrage ──────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  WealthTrack API (stateless)  →  http://localhost:${PORT}`);
  console.log(`  Claude Tier 3                →  ${process.env.ANTHROPIC_API_KEY ? "✓ activé" : "✗ ANTHROPIC_API_KEY manquante"}\n`);
});
