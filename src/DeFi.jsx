import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Zap, Plus, Trash2, RefreshCw, Shield, ShieldAlert, ShieldOff, AlertTriangle, TrendingUp, Wallet, Coins, Percent, Filter, Sparkles, X } from "lucide-react";
import { eur } from "./theme.js";
import { useT } from "./ThemeProvider.jsx";
import InfoTooltip from "./InfoTooltip.jsx";
import { useLocalStorage } from "./storage.js";

/* ─── Helpers ───────────────────────────────────────────────────────── */
const pct  = (n) => (n != null && !isNaN(n)) ? `${(+n).toFixed(2)} %` : "—";
const tvlFmt = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)} Md$` : n >= 1e6 ? `${(n / 1e6).toFixed(0)} M$` : `${(n / 1e3).toFixed(0)} k$`;

const CHAINS = ["ethereum", "polygon", "arbitrum", "optimism", "base", "avalanche", "bsc"];
const CHAIN_LABEL = {
  ethereum: "Ethereum", polygon: "Polygon", arbitrum: "Arbitrum",
  optimism: "Optimism", base: "Base", avalanche: "Avalanche", bsc: "BSC",
};

function riskOf(pool) {
  if (!pool) return "Élevé";
  if (pool.ilRisk === "no" && pool.tvlUsd > 500_000_000) return "Faible";
  if (pool.tvlUsd > 100_000_000) return "Moyen";
  if (pool.tvlUsd > 20_000_000)  return "Moyen";
  return "Élevé";
}

/* ─── Badge de risque (pastille colorée, cohérente avec le reste de WT) ── */
function RiskBadge({ risk }) {
  const T = useT();
  const RISK_TONE = {
    Faible: { bg: "rgba(0,200,150,0.12)",  color: T.green, Icon: Shield },
    Moyen:  { bg: "rgba(240,168,72,0.12)", color: T.amber, Icon: ShieldAlert },
    Élevé:  { bg: "rgba(255,92,122,0.12)", color: T.red,   Icon: ShieldOff },
  };
  const tone = RISK_TONE[risk] || RISK_TONE["Élevé"];
  const Icon = tone.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.color }}
    >
      <Icon size={11} />{risk}
    </span>
  );
}

const IL_TOOLTIP = "Le niveau de risque tient compte de la liquidité du protocole (TVL) et du risque de perte impermanente (impermanent loss) pour les pools de liquidité : un écart de prix entre les deux actifs d'une paire peut réduire la valeur de votre position par rapport à un simple holding.";
const APY_TOOLTIP = "APY (Annual Percentage Yield) : rendement annuel incluant l'effet des intérêts composés (réinvestissement automatique des gains). Variable et non garanti — peut fluctuer fortement d'un jour à l'autre.";
const TVL_TOOLTIP = "TVL (Total Value Locked) : valeur totale des actifs déposés dans le protocole. Plus elle est élevée, plus le protocole est généralement considéré comme établi et liquide.";

/* ─── DefiLlama fetch ───────────────────────────────────────────────── */
async function fetchPools() {
  const res = await fetch("https://yields.llama.fi/pools", { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
  const json = await res.json();
  return (json.data || [])
    .filter(p => p.apy > 0 && p.apy < 150 && p.tvlUsd > 1_000_000)
    .filter(p => CHAINS.includes(p.chain?.toLowerCase()))
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, 120);
}

/* ─── Form defaults ─────────────────────────────────────────────────── */
const EMPTY_FORM = {
  protocol: "", asset: "", chain: "ethereum",
  amount: "", entryApy: "",
  entryDate: new Date().toISOString().slice(0, 10),
};

// Anneau de focus visible (a11y) — s'ajoute par-dessus INPUT_STYLE sans entrer
// en conflit de spécificité avec la bordure inline (box-shadow vs border).
const INPUT_FOCUS_CLASS = "focus:ring-2 focus:ring-[#5b8def]/30 transition-shadow duration-150";

/* ─── Ligne de squelette (chargement) ───────────────────────────────── */
function SkeletonRow() {
  const T = useT();
  const bar = (w, align) => (
    <div style={{ justifySelf: align }}>
      <div className="animate-pulse rounded" style={{ height: 11, width: w, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr 100px 85px 110px 75px 80px",
      padding: "13px 16px", borderBottom: `1px solid ${T.border}`,
      alignItems: "center",
    }}>
      {bar("65%", "start")}
      {bar("45%", "start")}
      {bar("70%", "start")}
      {bar("50%", "end")}
      {bar("60%", "end")}
      {bar("55%", "center")}
      {bar("70%", "end")}
    </div>
  );
}

/* ─── Composant principal ───────────────────────────────────────────── */
export default function DeFi() {
  const T = useT();
  const INPUT_STYLE = {
    width: "100%", background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: "10px 14px", color: T.text, fontSize: 14,
    outline: "none", boxSizing: "border-box",
  };
  const LABEL_STYLE = {
    display: "block", color: T.muted, fontSize: 11, fontWeight: 700,
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6,
  };

  const [positions, setPositions] = useLocalStorage("wt_defi_positions", []);
  const [pools, setPools]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [loadErr, setLoadErr]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [chainFilter, setChainFilter] = useState("all");
  const [tab, setTab]             = useState("positions");

  /* ── Fetch DefiLlama ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const data = await fetchPools();
      setPools(data);
      setLastFetch(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setLoadErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Auto-refresh toutes les heures */
  useEffect(() => {
    const id = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  /* ── Fermeture du modal au clavier (Échap), cohérent avec le reste de WT ── */
  useEffect(() => {
    if (!showForm) return;
    const handler = (e) => { if (e.key === "Escape") setShowForm(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showForm]);

  /* ── Positions enrichies avec APY live ── */
  const enriched = useMemo(() => positions.map(pos => {
    const match = pools.find(p =>
      p.project?.toLowerCase() === pos.protocol?.toLowerCase() &&
      p.symbol?.toLowerCase().includes(pos.asset?.toLowerCase())
    );
    const liveApy = match?.apy ?? pos.entryApy ?? 0;
    const monthly = pos.amount * liveApy / 100 / 12;
    const yearly  = pos.amount * liveApy / 100;
    return { ...pos, liveApy, monthly, yearly, risk: riskOf(match), pool: match };
  }), [positions, pools]);

  /* ── Stats ── */
  const totalInvested = enriched.reduce((s, p) => s + (p.amount || 0), 0);
  const totalMonthly  = enriched.reduce((s, p) => s + p.monthly, 0);
  const totalYearly   = enriched.reduce((s, p) => s + p.yearly, 0);
  const avgApy        = totalInvested > 0 ? (totalYearly / totalInvested * 100) : 0;

  /* ── Opportunités filtrées ── */
  const opportunities = useMemo(() => pools
    .filter(p => chainFilter === "all" || p.chain?.toLowerCase() === chainFilter)
    .slice(0, 40)
  , [pools, chainFilter]);

  /* ── Handlers ── */
  const addPosition = () => {
    if (!form.protocol || !form.asset || !form.amount) return;
    setPositions(prev => [...prev, {
      id: Date.now(),
      protocol:  form.protocol.trim().toLowerCase(),
      asset:     form.asset.trim().toUpperCase(),
      chain:     form.chain,
      amount:    parseFloat(form.amount) || 0,
      entryApy:  parseFloat(form.entryApy) || 0,
      entryDate: form.entryDate,
    }]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setTab("positions");
  };

  const deletePosition = (id) => setPositions(prev => prev.filter(p => p.id !== id));

  const addFromPool = (pool) => {
    setForm({
      protocol:  pool.project || "",
      asset:     pool.symbol  || "",
      chain:     pool.chain?.toLowerCase() || "ethereum",
      entryApy:  (pool.apy || 0).toFixed(2),
      amount:    "",
      entryDate: new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
    setTab("positions");
  };

  /* ─── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6">

      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>DeFi Yield</h1>
          <p style={{ color: T.muted }}>Suivi de positions · Opportunités DefiLlama en temps réel</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastFetch && (
            <span style={{ color: T.muted, fontSize: 12 }}>MAJ {lastFetch}</span>
          )}
          <button onClick={fetchData} disabled={loading} style={{
            background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
            color: T.muted, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 13,
          }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
          <button onClick={() => setShowForm(true)} style={{
            background: T.blue, color: "#fff", border: "none", padding: "8px 18px",
            borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>

      {/* Disclaimer risque */}
      <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5" style={{ background: "rgba(255,90,95,0.06)", border: `1px solid ${T.red}33` }}>
        <AlertTriangle size={16} style={{ color: T.red, flexShrink: 0, marginTop: 2 }} />
        <div style={{ color: T.muted, lineHeight: 1.6 }}>
          <b style={{ color: T.text }}>La DeFi n'est pas un produit d'épargne réglementé.</b> Contrairement au Livret A,
          votre capital n'est pas garanti : risque de smart contract (bug, exploit, faillite du protocole), de perte
          impermanente sur les pools de liquidité, et forte volatilité des actifs sous-jacents. Les APY élevés sont
          souvent temporaires et peuvent chuter brutalement. N'investissez que ce que vous pouvez vous permettre de perdre intégralement.
        </div>
      </div>

      {/* Cartes résumé */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total investi",  value: eur(totalInvested), color: T.blue,  Icon: Wallet },
          { label: "Revenu mensuel", value: eur(totalMonthly),  color: T.green, Icon: Coins },
          { label: "Revenu annuel",  value: eur(totalYearly),   color: T.green, Icon: TrendingUp },
          { label: "APY moyen",      value: pct(avgApy),        color: T.amber, Icon: Percent },
        ].map(c => (
          <div key={c.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px" }}>
            <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
              <span style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
                {c.label}
              </span>
              <c.Icon size={16} style={{ color: c.color, opacity: 0.65, flexShrink: 0 }} />
            </div>
            <div style={{ color: c.color, fontSize: 22, fontWeight: 800 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {[
          { id: "positions",     label: `Mes positions (${positions.length})`, Icon: Wallet },
          { id: "opportunities", label: `Opportunités${pools.length ? ` (${pools.length})` : ""}`, Icon: Sparkles },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: tab === t.id ? T.blue : "transparent",
            color: tab === t.id ? "#fff" : T.muted,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Mes positions ── */}
      {tab === "positions" && (
        positions.length === 0 ? (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 48, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "rgba(91,141,239,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <Zap size={28} style={{ color: T.blue }} />
            </div>
            <div style={{ color: T.text, fontWeight: 600, marginBottom: 8 }}>Aucune position DeFi</div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
              Ajoutez vos positions manuellement ou explorez les opportunités
            </div>
            <button onClick={() => setTab("opportunities")} style={{
              background: T.blue, color: "#fff", border: "none", padding: "10px 20px",
              borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
            }}>
              Voir les opportunités
            </button>
          </div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "visible" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 110px 80px 100px 110px 75px 36px",
              padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
              fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase",
            }}>
              <span>Protocole</span><span>Actif / Chain</span>
              <span style={{ textAlign: "right" }}>Investi</span>
              <span style={{ textAlign: "right" }}>APY live<InfoTooltip text={APY_TOOLTIP} /></span>
              <span style={{ textAlign: "right" }}>Mensuel</span>
              <span style={{ textAlign: "right" }}>Annuel</span>
              <span style={{ textAlign: "center" }}>Risque<InfoTooltip text={IL_TOOLTIP} /></span>
              <span />
            </div>
            {enriched.map(pos => (
              <div key={pos.id} className="hover:bg-white/[0.025] transition-colors" style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 110px 80px 100px 110px 75px 36px",
                padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
                alignItems: "center", fontSize: 13,
              }}>
                <span style={{ color: T.text, fontWeight: 600, textTransform: "capitalize" }}>{pos.protocol}</span>
                <div>
                  <div style={{ color: T.text, fontWeight: 600 }}>{pos.asset}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>{CHAIN_LABEL[pos.chain] || pos.chain}</div>
                </div>
                <span style={{ textAlign: "right", color: T.text, fontWeight: 700 }}>{eur(pos.amount)}</span>
                <span style={{ textAlign: "right", color: T.amber, fontWeight: 700 }}>{pct(pos.liveApy)}</span>
                <span style={{ textAlign: "right", color: T.green }}>{eur(pos.monthly)}</span>
                <span style={{ textAlign: "right", color: T.green, fontWeight: 700 }}>{eur(pos.yearly)}</span>
                <div style={{ textAlign: "center" }}>
                  <RiskBadge risk={pos.risk} />
                </div>
                <button
                  onClick={() => deletePosition(pos.id)}
                  aria-label={`Supprimer ${pos.protocol}`}
                  className="hover:text-[#ff5c7a] transition-colors"
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {/* Ligne totaux */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 110px 80px 100px 110px 75px 36px",
              padding: "12px 16px", borderTop: `2px solid ${T.border}`,
              fontSize: 13, fontWeight: 700,
            }}>
              <span style={{ color: T.muted, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>TOTAL</span>
              <span />
              <span style={{ textAlign: "right", color: T.text }}>{eur(totalInvested)}</span>
              <span style={{ textAlign: "right", color: T.amber }}>{pct(avgApy)}</span>
              <span style={{ textAlign: "right", color: T.green }}>{eur(totalMonthly)}</span>
              <span style={{ textAlign: "right", color: T.green }}>{eur(totalYearly)}</span>
              <span /><span />
            </div>
          </div>
        )
      )}

      {/* ── Opportunités ── */}
      {tab === "opportunities" && (
        <>
          {/* Filtre chain */}
          <div>
            <div className="flex items-center gap-1.5" style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
              <Filter size={12} /> Réseau
            </div>
            <div className="flex flex-wrap gap-2">
              {["all", ...CHAINS].map(c => (
                <button key={c} onClick={() => setChainFilter(c)} style={{
                  padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  border: `1px solid ${chainFilter === c ? T.blue : T.border}`,
                  background: chainFilter === c ? T.blue + "22" : "transparent",
                  color: chainFilter === c ? T.blue : T.muted,
                }}>
                  {c === "all" ? "Toutes" : CHAIN_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {loadErr && (
            <div style={{
              color: T.red, fontSize: 13, padding: "12px 16px",
              background: "rgba(217,84,84,0.08)", borderRadius: 10,
              border: `1px solid rgba(217,84,84,0.2)`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} /> DefiLlama : {loadErr}
            </div>
          )}

          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "visible" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 100px 85px 110px 75px 80px",
              padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
              fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase",
            }}>
              <span>Protocole</span><span>Actif</span><span>Chain</span>
              <span style={{ textAlign: "right" }}>APY<InfoTooltip text={APY_TOOLTIP} /></span>
              <span style={{ textAlign: "right" }}>TVL<InfoTooltip text={TVL_TOOLTIP} /></span>
              <span style={{ textAlign: "center" }}>Risque<InfoTooltip text={IL_TOOLTIP} /></span>
              <span />
            </div>
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {loading && !pools.length ? (
                Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)
              ) : opportunities.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                  Aucune opportunité disponible pour ce réseau pour le moment.
                </div>
              ) : (
                opportunities.map(pool => {
                  const risk = riskOf(pool);
                  return (
                    <div key={pool.pool} className="hover:bg-white/[0.025] transition-colors" style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 100px 85px 110px 75px 80px",
                      padding: "11px 16px", borderBottom: `1px solid ${T.border}`,
                      alignItems: "center", fontSize: 12,
                    }}>
                      <span style={{ color: T.text, fontWeight: 600 }}>{pool.project}</span>
                      <span style={{ color: T.muted }}>{pool.symbol}</span>
                      <span style={{ color: T.muted, fontSize: 11 }}>{CHAIN_LABEL[pool.chain?.toLowerCase()] || pool.chain}</span>
                      <span style={{ textAlign: "right", fontWeight: 700, color: pool.apy > 15 ? T.amber : T.green }}>
                        {pct(pool.apy)}
                      </span>
                      <span style={{ textAlign: "right", color: T.muted }}>{tvlFmt(pool.tvlUsd)}</span>
                      <div style={{ textAlign: "center" }}>
                        <RiskBadge risk={risk} />
                      </div>
                      <button onClick={() => addFromPool(pool)} style={{
                        background: T.blue + "22", border: `1px solid ${T.blue}44`,
                        color: T.blue, padding: "5px 10px", borderRadius: 8,
                        cursor: "pointer", fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 4, justifySelf: "start",
                      }}>
                        <Plus size={11} /> Ajouter
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modal ajout ── */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          className="wt-fade-in"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="wt-scale-in"
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28, width: "100%", maxWidth: 420 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: T.text, fontWeight: 700, fontSize: 18 }}>Nouvelle position DeFi</h2>
              <button onClick={() => setShowForm(false)} aria-label="Fermer" style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
                <X size={18} />
              </button>
            </div>

            {[
              { label: "Protocole",       key: "protocol",  placeholder: "ex. lido, aave-v3, curve-dex" },
              { label: "Actif",           key: "asset",     placeholder: "ex. ETH, USDC, stETH" },
              { label: "Montant (€)",     key: "amount",    placeholder: "ex. 5000", type: "number" },
              { label: "APY d'entrée (%)",key: "entryApy",  placeholder: "ex. 3.5",  type: "number" },
              { label: "Date d'entrée",   key: "entryDate",                          type: "date" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={LABEL_STYLE}>{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={form[f.key]}
                  placeholder={f.placeholder || ""}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={INPUT_STYLE}
                  className={INPUT_FOCUS_CLASS}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Blockchain</label>
              <select
                value={form.chain}
                onChange={e => setForm(prev => ({ ...prev, chain: e.target.value }))}
                style={{ ...INPUT_STYLE, cursor: "pointer" }}
                className={INPUT_FOCUS_CLASS}
              >
                {CHAINS.map(c => <option key={c} value={c} style={{ background: T.card }}>{CHAIN_LABEL[c]}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{
                flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                color: T.muted, padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 600,
              }}>
                Annuler
              </button>
              <button
                onClick={addPosition}
                disabled={!form.protocol || !form.asset || !form.amount}
                style={{
                  flex: 2, background: T.blue, color: "#fff", border: "none",
                  padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 14,
                  opacity: (!form.protocol || !form.asset || !form.amount) ? 0.5 : 1,
                }}
              >
                Ajouter la position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
        Données <span style={{ color: T.text }}>DefiLlama</span> · APY variable, non garanti ·
        Actualisation automatique toutes les heures · Positions stockées localement
      </div>
    </div>
  );
}
