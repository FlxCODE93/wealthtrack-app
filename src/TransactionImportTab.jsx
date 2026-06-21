import React, { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Upload, RefreshCw, Check, X, Sparkles, AlertTriangle } from "lucide-react";
import { C, eur } from "./theme.js";
import { authHeader } from "./supabaseClient.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

async function extractPDFText(file) {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map((i) => i.str).join(" "));
  }
  return pages.join("\n");
}

/* ─── Catégories ────────────────────────────────────────────────────── */
export const IMPORT_CATS = {
  SALAIRE:           { label: "Salaire",         type: "revenu",           cat: "Salaire",      color: "#27a37a" },
  LOYER:             { label: "Loyer",            type: "charge_fixe",     cat: "Logement",     color: "#f97316" },
  INVESTISSEMENT:    { label: "Investissement",   type: "investissement",  cat: "Épargne",      color: "#3b7de8" },
  PRET:              { label: "Prêt / Crédit",    type: "charge_fixe",     cat: "Crédit",       color: "#8b5cf6" },
  CHARGES_FIXES:     { label: "Charges fixes",    type: "charge_fixe",     cat: "Assurances",   color: "#c8883a" },
  CHARGES_VARIABLES: { label: "Dépenses var.",    type: "depense_variable",cat: "Alimentation", color: "#64748b" },
};

/* ─── Tier 1 — mots-clés ────────────────────────────────────────────── */
const KW = {
  SALAIRE:           /salaire|pa[iy]e|virement.*employ|bonus|prime\b|rémunération|remuneration/i,
  LOYER:             /loyer|rent\b|syndic|charge.*immeuble/i,
  INVESTISSEMENT:    /\betf\b|action\b|crypto|bitcoin|ethereum|bourse|trading|degiro|trade republic|binance|coinbase|broker|achat titre/i,
  PRET:              /remboursement.*cr[eé]dit|mensualit[eé]|emprunt|cr[eé]dit immobilier|cr[eé]dit auto|pr[eé]t personnel/i,
  CHARGES_FIXES:     /\bedf\b|[eé]lectricit[eé]|\beau\b|\bgaz\b|internet|adsl|fibre|assurance|t[eé]l[eé]phone|orange|sfr|bouygues|\bfree\b|netflix|spotify|disney|cotisation|mutuelle|abonnement/i,
  CHARGES_VARIABLES: /carrefour|leclerc|lidl|auchan|intermarch[eé]|casino|monoprix|restaurant|resto|pizza|burger|mcdonald|subway|uber eats|deliveroo|caf[eé]|starbucks|cin[eé]ma|sport|gym|\bratp\b|\bsncf\b|taxi|z[aà]ra|h&m|pharmacie|coiffeur|essence|\bbar\b/i,
};

function categorizeByKeywords(desc) {
  for (const [cat, re] of Object.entries(KW)) {
    if (re.test(desc)) return { category: cat, confidence: 0.95 };
  }
  return null;
}

/* ─── Tier 2 — heuristique montant ─────────────────────────────────── */
function categorizeByAmount(amount) {
  if (amount >  1500)              return { category: "SALAIRE",           confidence: 0.40 };
  if (amount < -1500)              return { category: "INVESTISSEMENT",    confidence: 0.30 };
  if (amount < -800)               return { category: "LOYER",             confidence: 0.30 };
  if (amount < 0 && amount > -80)  return { category: "CHARGES_FIXES",    confidence: 0.25 };
  return                                  { category: "CHARGES_VARIABLES", confidence: 0.20 };
}

function categorize(description, amount) {
  return categorizeByKeywords(description) || categorizeByAmount(amount);
}

/* ─── Parsing CSV ───────────────────────────────────────────────────── */
function parseAmount(str) {
  if (!str && str !== 0) return null;
  const cleaned = String(str).replace(/[€\s ]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(str) {
  if (!str) return "";
  const s = str.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const year = y.length === 2 ? "20" + y : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // ISO YYYY-MM-DD — already fine
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function detectColumns(headers) {
  const find = (patterns) =>
    headers.find((h) => patterns.some((p) => new RegExp(p, "i").test(h.trim()))) || null;
  return {
    date:   find(["date", "jour", "day", "dat"]),
    desc:   find(["libellé", "libelle", "description", "label", "intitulé", "intitule", "détail", "detail", "opération", "operation", "référence"]),
    amount: find(["^montant$", "^amount$", "^somme$", "^valeur$", "montant", "amount", "somme", "valeur"]),
    debit:  find(["debit", "débit", "déb", "sortie", "withdrawal"]),
    credit: find(["credit", "crédit", "crédits", "entrée", "entree", "deposit"]),
  };
}

function parseCSVText(text) {
  const result = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader: (h) => h.trim(),
  });

  if (!result.data.length) {
    throw new Error("Fichier vide ou format non reconnu.");
  }

  const headers = result.meta.fields || [];
  const cols = detectColumns(headers);

  if (!cols.desc && !cols.amount && !cols.debit && !cols.credit) {
    throw new Error(
      `Colonnes non reconnues. En-têtes trouvés : ${headers.join(", ")}. ` +
      `Le fichier doit avoir des colonnes de type date, libellé, montant.`
    );
  }

  return result.data
    .map((row, i) => {
      let amount = 0;
      if (cols.amount) {
        amount = parseAmount(row[cols.amount]) ?? 0;
      } else if (cols.debit || cols.credit) {
        const debit  = parseAmount(row[cols.debit])  ?? 0;
        const credit = parseAmount(row[cols.credit]) ?? 0;
        amount = credit - debit;
      }

      const description = (cols.desc ? String(row[cols.desc] || "") : "").trim();
      const date = cols.date ? parseDate(String(row[cols.date] || "")) : "";
      const { category, confidence } = categorize(description, amount);

      return {
        id: `csv_${i}_${Date.now()}`,
        date,
        description: description || `Ligne ${i + 1}`,
        amount,
        category,
        confidence,
        userConfirmed: false,
      };
    })
    .filter((tx, i) => tx.amount !== 0 || tx.description !== `Ligne ${i + 1}`);
}

/* ─── Parsing OFX (regex, compatible SGML legacy + XML) ────────────── */
function parseOFXText(text) {
  const blocks = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];
  if (!blocks.length) throw new Error("Format OFX non reconnu ou aucune transaction trouvée.");

  return blocks.map((block, i) => {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const amount = parseFloat(get("TRNAMT")) || 0;
    const description = get("MEMO") || get("NAME") || `Transaction ${i + 1}`;
    const raw = get("DTPOSTED");
    const date = raw.length >= 8
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      : "";
    const { category, confidence } = categorize(description, amount);
    return { id: `ofx_${i}_${Date.now()}`, date, description, amount, category, confidence, userConfirmed: false };
  });
}

/* ─── Données de démo ───────────────────────────────────────────────── */
const DEMO_ROWS = [
  { date: "2026-06-01", description: "VIREMENT SALAIRE TECH CORP SA",            amount:  3200 },
  { date: "2026-06-03", description: "PRELEVEMENT LOYER NEXITY AGENCE",           amount:  -950 },
  { date: "2026-06-05", description: "ACHAT ETF IWDA DEGIRO",                     amount:  -500 },
  { date: "2026-06-07", description: "LIDL SAINT-GERMAIN COURSES",                amount:   -78 },
  { date: "2026-06-10", description: "EDF MENSUALITE ELECTRICITE",                amount:   -82 },
  { date: "2026-06-12", description: "NETFLIX ABONNEMENT MENSUEL",                amount: -17.99},
  { date: "2026-06-14", description: "RESTAURANT LE PETIT BISTROT",               amount:   -48 },
  { date: "2026-06-15", description: "REMBOURSEMENT CREDIT IMMOBILIER BNP",       amount:  -832 },
  { date: "2026-06-18", description: "CARREFOUR CITY MONTPARNASSE",               amount:  -134 },
  { date: "2026-06-20", description: "PRIME EXCEPTIONNELLE Q2",                   amount:   600 },
  { date: "2026-06-22", description: "RATP NAVIGO PASS SEMAINE",                  amount: -22.8 },
  { date: "2026-06-25", description: "ZARA VETEMENTS EN LIGNE",                   amount:   -89 },
  { date: "2026-06-27", description: "PAIEMENT INCONNU REF ZX92847",              amount:   -30 },
];

function makeDemoTx(row, i) {
  const { category, confidence } = categorize(row.description, row.amount);
  return { id: `demo_${i}`, ...row, category, confidence, userConfirmed: false };
}

/* ─── Sous-composants ───────────────────────────────────────────────── */
function ConfidenceBadge({ confidence, userConfirmed }) {
  if (userConfirmed) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.green }}>
      <Check size={11} /> Confirmé
    </span>
  );
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8) return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: C.green, fontSize: 11 }}><Check size={10} /> {pct} %</span>;
  if (confidence >= 0.6) return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: C.amber, fontSize: 11 }}><AlertTriangle size={10} /> {pct} %</span>;
  return <span style={{ color: C.red, fontSize: 11 }}>? {pct} %</span>;
}

/* ─── Composant principal ───────────────────────────────────────────── */
export default function TransactionImportTab({ onImport }) {
  const [transactions, setTransactions] = useState([]);
  const [dragOver, setDragOver]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [fileName, setFileName]         = useState(null);
  const [aiPending, setAiPending]       = useState(new Set());
  const fileRef = useRef();

  /* Parse file */
  const processFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
      let parsed;
      if (isPdf) {
        // PDF : extraction texte dans le navigateur (pdfjs-dist),
        // puis structuration via Edge Function Supabase (Claude Haiku).
        if (!SUPABASE_URL) throw new Error("Service d'import non configuré (VITE_SUPABASE_URL manquant).");
        const pdfText = await extractPDFText(file);
        if (!pdfText.trim()) throw new Error("Aucun texte lisible dans ce PDF (relevé scanné non supporté).");
        const headers = await authHeader();
        headers["apikey"] = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
        headers["Content-Type"] = "application/json";
        const res = await fetch(`${SUPABASE_URL}/functions/v1/import-pdf`, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: pdfText }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || "Échec de l'import du PDF.");
        parsed = (data.transactions || []).map((t, i) => {
          const { category, confidence } = categorize(t.description || "", t.amount || 0);
          return {
            id: `pdf_${i}_${Date.now()}`,
            date: t.date || "",
            description: t.description || `Ligne ${i + 1}`,
            amount: typeof t.amount === "number" ? t.amount : 0,
            category, confidence, userConfirmed: false,
          };
        });
      } else {
        const text = await file.text();
        parsed = file.name.toLowerCase().endsWith(".ofx") ? parseOFXText(text) : parseCSVText(text);
      }
      if (!parsed.length) throw new Error("Aucune transaction trouvée dans le fichier.");
      setTransactions(parsed);
    } catch (err) {
      setError(err.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  /* Edit catégorie */
  const updateCategory = (id, category) => {
    setTransactions((prev) =>
      prev.map((tx) => tx.id === id ? { ...tx, category, confidence: 1, userConfirmed: true } : tx)
    );
  };

  /* Confirmer une transaction */
  const confirmTx = (id) => {
    setTransactions((prev) =>
      prev.map((tx) => tx.id === id ? { ...tx, userConfirmed: true } : tx)
    );
  };

  /* Tier 3 — appel Claude via backend */
  const requestAI = async (tx) => {
    setAiPending((prev) => new Set(prev).add(tx.id));
    try {
      const res = await fetch(`${API_URL}/api/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ description: tx.description, amount: tx.amount, date: tx.date }),
      });
      if (!res.ok) throw new Error("Serveur indisponible");
      const data = await res.json();
      if (data.category) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === tx.id ? { ...t, category: data.category, confidence: data.confidence, userConfirmed: false } : t
          )
        );
      }
    } catch {
      /* silently fallback */
    } finally {
      setAiPending((prev) => { const s = new Set(prev); s.delete(tx.id); return s; });
    }
  };

  /* Import final → App */
  const handleImportClick = () => {
    if (!onImport || !transactions.length) return;
    const mapped = transactions.map((tx) => {
      const cfg = IMPORT_CATS[tx.category] || IMPORT_CATS.CHARGES_VARIABLES;
      return {
        id: Date.now() + Math.random(),
        label: tx.description,
        cat: cfg.cat,
        type: cfg.type,
        amount: tx.amount,
        source: "api",
        date: tx.date || new Date().toISOString().slice(0, 10),
      };
    });
    onImport(mapped);
  };

  /* Résumé par catégorie */
  const summary = Object.entries(
    transactions.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([cat, count]) => ({ cat, count, cfg: IMPORT_CATS[cat] || IMPORT_CATS.CHARGES_VARIABLES }));

  const lowConf = transactions.filter((tx) => !tx.userConfirmed && tx.confidence < 0.7).length;
  const totalIn  = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  /* ── Rendu ─────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: C.text }}>Importer un relevé</h1>
        <p style={{ color: C.muted }}>CSV ou OFX — catégorisation automatique par mots-clés</p>
      </div>

      {/* ── Zone de dépôt ── */}
      {!transactions.length && !loading && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? C.blue : C.border}`,
              borderRadius: 20,
              padding: "52px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(47,155,255,0.06)" : "rgba(255,255,255,0.01)",
              transition: "all 0.2s",
            }}
          >
            <input
              ref={fileRef} type="file" accept=".csv,.ofx,.pdf,application/pdf"
              onChange={handleFileInput} style={{ display: "none" }}
            />
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <Upload size={52} style={{ color: C.muted, opacity: 0.5 }} />
            </div>
            <div className="text-xl font-semibold mb-1" style={{ color: C.text }}>
              Glissez votre relevé ici
            </div>
            <div className="text-sm" style={{ color: C.muted }}>
              Formats acceptés : CSV, OFX, PDF — exportez depuis votre espace bancaire
            </div>

            <div className="flex gap-3 justify-center flex-wrap" style={{ marginTop: 24 }}>
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                style={{
                  background: C.blue, color: "#fff", border: "none",
                  padding: "11px 22px", borderRadius: 10, cursor: "pointer",
                  fontWeight: 700, fontSize: 14,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Upload size={14} /> Choisir un fichier
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFileName("données_demo.csv");
                  setError(null);
                  setTransactions(DEMO_ROWS.map(makeDemoTx));
                }}
                style={{
                  background: "rgba(255,255,255,0.04)", color: C.muted,
                  border: `1px solid ${C.border}`, padding: "11px 22px",
                  borderRadius: 10, cursor: "pointer", fontWeight: 500, fontSize: 14,
                }}
              >
                Données de démonstration
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 20, color: C.red, fontSize: 13, maxWidth: 480, margin: "20px auto 0", display: "flex", alignItems: "flex-start", gap: 6, justifyContent: "center" }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {error}
              </div>
            )}
          </div>

          {/* Guide format */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <div className="font-semibold text-sm mb-3" style={{ color: C.text }}>Format CSV attendu</div>
            <div
              style={{
                fontFamily: "monospace", fontSize: 12,
                background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "12px 16px", color: C.muted,
                lineHeight: 1.8, overflowX: "auto", whiteSpace: "nowrap",
              }}
            >
              Date;Libellé;Montant<br />
              01/06/2026;VIREMENT SALAIRE;2800<br />
              03/06/2026;PRELEVEMENT LOYER;-950<br />
              05/06/2026;ACHAT ETF DEGIRO;-500
            </div>
            <div className="text-xs mt-4 leading-relaxed" style={{ color: C.muted }}>
              <span style={{ color: C.text, fontWeight: 600 }}>Comment exporter depuis votre banque :</span><br />
              <b style={{ color: C.text }}>BNP Paribas</b> → Mes comptes → Télécharger relevé → CSV &nbsp;·&nbsp;
              <b style={{ color: C.text }}>Société Générale</b> → Historique → Exporter → CSV<br />
              <b style={{ color: C.text }}>Boursorama</b> → Mes comptes → Télécharger → CSV &nbsp;·&nbsp;
              <b style={{ color: C.text }}>Crédit Agricole</b> → Comptes → Relevé → Exporter
            </div>
          </div>
        </>
      )}

      {/* ── Chargement ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: C.muted }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <RefreshCw size={36} style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
          </div>
          <div>Analyse du fichier en cours…</div>
        </div>
      )}

      {/* ── Résultats ── */}
      {transactions.length > 0 && (
        <>
          {/* Barre résumé */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 20px" }}>
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div>
                <div className="font-bold text-lg" style={{ color: C.text }}>
                  {transactions.length} transactions — <span style={{ color: C.muted, fontWeight: 400, fontSize: 14 }}>{fileName}</span>
                </div>
                <div className="flex gap-4 mt-1 text-sm">
                  <span style={{ color: C.green }}>+{eur(totalIn)} entrants</span>
                  <span style={{ color: C.red }}>{eur(totalOut)} sortants</span>
                  {lowConf > 0 && (
                    <span style={{ color: C.amber, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={12} /> {lowConf} à confirmer
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {summary.map(({ cat, count, cfg }) => (
                  <span key={cat} className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: cfg.color + "22", color: cfg.color }}>
                    {cfg.label} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleImportClick}
              style={{
                background: C.green, color: "#0a0f1e", border: "none",
                padding: "12px 24px", borderRadius: 12, cursor: "pointer",
                fontWeight: 700, fontSize: 14,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Check size={15} /> Importer {transactions.length} transactions
              </span>
            </button>
            <button
              onClick={() => { setTransactions([]); setFileName(null); setError(null); }}
              style={{
                background: "rgba(255,255,255,0.03)", color: C.muted,
                border: `1px solid ${C.border}`, padding: "12px 20px",
                borderRadius: 12, cursor: "pointer",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <X size={14} /> Recommencer
              </span>
            </button>
          </div>

          {/* Tableau des transactions */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            {/* En-têtes */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 95px 175px 90px 36px",
              padding: "10px 16px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 10, fontWeight: 700, color: C.muted,
              letterSpacing: 0.8, textTransform: "uppercase",
            }}>
              <span>Date</span>
              <span>Description</span>
              <span style={{ textAlign: "right" }}>Montant</span>
              <span>Catégorie</span>
              <span style={{ textAlign: "center" }}>Confiance</span>
              <span />
            </div>

            {/* Lignes */}
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {transactions.map((tx) => {
                const cfg = IMPORT_CATS[tx.category] || IMPORT_CATS.CHARGES_VARIABLES;
                const isLow = !tx.userConfirmed && tx.confidence < 0.7;
                const pending = aiPending.has(tx.id);

                return (
                  <div
                    key={tx.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr 95px 175px 90px 36px",
                      padding: "9px 16px",
                      borderBottom: `1px solid ${C.border}`,
                      alignItems: "center",
                      background: isLow ? "rgba(245,166,35,0.03)" : "transparent",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: C.muted, fontSize: 11 }}>{tx.date}</span>

                    <span style={{
                      color: C.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      paddingRight: 8,
                    }} title={tx.description}>
                      {tx.description}
                    </span>

                    <span style={{
                      textAlign: "right", fontWeight: 700,
                      color: tx.amount >= 0 ? C.green : C.red,
                    }}>
                      {tx.amount >= 0 ? "+" : ""}{eur(tx.amount)}
                    </span>

                    {/* Dropdown catégorie éditable */}
                    <select
                      value={tx.category}
                      onChange={(e) => updateCategory(tx.id, e.target.value)}
                      style={{
                        background: cfg.color + "18",
                        border: `1px solid ${cfg.color}55`,
                        color: cfg.color,
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 11, fontWeight: 700,
                        cursor: "pointer", width: "100%",
                        outline: "none",
                      }}
                    >
                      {Object.entries(IMPORT_CATS).map(([key, c]) => (
                        <option key={key} value={key} style={{ background: C.panel, color: C.text }}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    {/* Indicateur confiance */}
                    <div style={{ textAlign: "center" }}>
                      <ConfidenceBadge confidence={tx.confidence} userConfirmed={tx.userConfirmed} />
                    </div>

                    {/* Action : confirmer ou demander IA */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {tx.userConfirmed ? (
                        <Check size={14} style={{ color: C.green }} />
                      ) : isLow ? (
                        <button
                          onClick={() => requestAI(tx)}
                          disabled={pending}
                          title="Catégoriser par IA (nécessite le serveur)"
                          style={{
                            background: "none", border: "none",
                            cursor: pending ? "default" : "pointer",
                            color: pending ? C.muted : C.violet,
                            padding: 2, display: "flex", alignItems: "center",
                          }}
                        >
                          {pending ? <RefreshCw size={12} /> : <Sparkles size={13} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => confirmTx(tx.id)}
                          title="Confirmer"
                          style={{
                            background: "none", border: "none",
                            cursor: "pointer", color: C.muted,
                            padding: 2, display: "flex", alignItems: "center",
                          }}
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note Tier 3 */}
          <div style={{
            background: "rgba(59,130,246,0.06)", border: `1px solid rgba(59,130,246,0.2)`,
            borderRadius: 12, padding: "12px 16px", fontSize: 12, color: C.muted,
          }}>
            <span style={{ color: C.violet, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}><Sparkles size={12} /> Catégorisation IA (Tier 3) </span>
            — Le bouton <Sparkles size={11} style={{ display: "inline", verticalAlign: "middle" }} /> sur les lignes à faible confiance appelle Claude via le serveur Express
            (<code style={{ color: C.text }}>{API_URL}</code>). Lancez <code style={{ color: C.text }}>npm run server</code> pour l'activer.
          </div>
        </>
      )}
    </div>
  );
}
