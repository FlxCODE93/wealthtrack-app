/**
 * WealthTrack — Crypto Tracker
 * Holdings · Staking · P&L · CSV export
 * Prix live via CoinGecko API (gratuit, sans clé)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Plus, Trash2, Download, AlertTriangle, TrendingUp, TrendingDown,
  Trophy, Zap, ExternalLink, Star, Wallet, Layers, Percent, Lock,
  Shield, ShieldAlert, ShieldOff, ShieldQuestion, Search, X, Coins, ChevronLeft,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ExpandableChart } from "./ChartComponents.jsx";
import { useT } from "./ThemeProvider.jsx";
import { useEur as useEurCtx, useDiscreet } from "./ui.jsx";
import { SEUIL_EXONERATION_CESSION } from "./finance.js";
import { API_URL } from "./config.js";
import { useLocalStorage } from "./storage.js";
import InfoTooltip from "./InfoTooltip.jsx";

const eur = (n, dec = 0) =>
  n == null ? "—" :
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });

const pct = (n) =>
  n == null ? "—" :
  `${n >= 0 ? "+" : ""}${n.toFixed(2)} %`;

/* Prix formaté avec une précision adaptée (les altcoins valent souvent < 1 €) */
const eurSmart = (n) => {
  if (n == null) return "—";
  const dec = n >= 100 ? 0 : n >= 1 ? 2 : 4;
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: dec, maximumFractionDigits: dec });
};

/* Grands nombres (capitalisation, volume) en k€ / M€ / Md€ */
const fmtLarge = (n) => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Md€`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`;
  return eur(n);
};

const fmtSupply = (n) => n == null ? "—" : n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

const MARKET_RANGES = [
  { id: "1",   label: "24 h" },
  { id: "7",   label: "7 j" },
  { id: "30",  label: "30 j" },
  { id: "365", label: "1 an" },
];

/* ─── Catalogue de monnaies ─────────────────────────────────────────── */
const COINS = [
  { id: "bitcoin",          symbol: "BTC",  name: "Bitcoin" },
  { id: "ethereum",         symbol: "ETH",  name: "Ethereum" },
  { id: "solana",           symbol: "SOL",  name: "Solana" },
  { id: "cardano",          symbol: "ADA",  name: "Cardano" },
  { id: "ripple",           symbol: "XRP",  name: "XRP" },
  { id: "polkadot",         symbol: "DOT",  name: "Polkadot" },
  { id: "chainlink",        symbol: "LINK", name: "Chainlink" },
  { id: "avalanche-2",      symbol: "AVAX", name: "Avalanche" },
  { id: "matic-network",    symbol: "MATIC",name: "Polygon" },
  { id: "cosmos",           symbol: "ATOM", name: "Cosmos" },
  { id: "near",             symbol: "NEAR", name: "NEAR Protocol" },
  { id: "uniswap",          symbol: "UNI",  name: "Uniswap" },
];

/* Données staking statiques (utilisées si le serveur est hors ligne) */
const STAKING_STATIC = [
  { coin:"CRO",  name:"Crypto.com Coin",  flexApy:10.0, lock1m:12.0, lock3m:14.0, category:"native",  risk:"Faible",  note:"Taux de base ; boosted avec tier Ruby+" },
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
  { coin:"ETH",  name:"Ethereum",         flexApy: 4.0, lock1m:null, lock3m:null, category:"eth",     risk:"Faible",  note:"Liquid staking — retrait sans délai" },
  { coin:"POL",  name:"Polygon (POL)",    flexApy: 4.0, lock1m:null, lock3m:null, category:"pos",     risk:"Faible",  note:"Anciennement MATIC" },
  { coin:"TRX",  name:"TRON",             flexApy: 4.0, lock1m:null, lock3m:null, category:"pos",     risk:"Moyen",   note:"3 jours d'unbonding" },
  { coin:"ALGO", name:"Algorand",         flexApy: 3.5, lock1m:null, lock3m:null, category:"pos",     risk:"Faible",  note:"Récompenses automatiques" },
  { coin:"XRP",  name:"XRP",              flexApy: 2.5, lock1m: 3.5, lock3m: 4.5, category:"earn",    risk:"Faible",  note:"" },
  { coin:"BNB",  name:"BNB",              flexApy: 2.5, lock1m: 3.5, lock3m: 4.5, category:"earn",    risk:"Faible",  note:"" },
  { coin:"LTC",  name:"Litecoin",         flexApy: 2.0, lock1m: 3.0, lock3m: 4.0, category:"earn",    risk:"Faible",  note:"" },
  { coin:"BTC",  name:"Bitcoin",          flexApy: 0.5, lock1m: 1.0, lock3m: 1.5, category:"earn",    risk:"Faible",  note:"Bitcoin peu adapté au staking" },
];

/* Mapping symbol → CoinGecko ID pour les images staking */
const STAKING_COIN_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano",
  XRP: "ripple", DOT: "polkadot", ATOM: "cosmos", AVAX: "avalanche-2",
  POL: "matic-network", NEAR: "near", BNB: "binancecoin",
  CRO: "crypto-com-chain", DYDX: "dydx", TIA: "celestia",
  INJ: "injective-protocol", EGLD: "elrond-erd-2", APT: "aptos",
  SUI: "sui", SEI: "sei-network", TRX: "tron", LTC: "litecoin", ALGO: "algorand",
};

/* APY staking estimés (source: staking rewards.com, indicatifs) */
const STAKING_APY = {
  ethereum: 3.8, solana: 7.2, cardano: 4.5,
  polkadot: 13.5, cosmos: 18.0, near: 9.0,
  "avalanche-2": 8.3, "matic-network": 4.8,
};

/* ─── Données de démo ───────────────────────────────────────────────── */
let _nextId = 10;
const nextId = () => ++_nextId;

const DEFAULT_HOLDINGS = [
  { id: 1, coinId: "bitcoin",  symbol: "BTC", name: "Bitcoin",          amount: 0.12,  buyPrice: 38000, buyDate: "2024-01-15", type: "spot" },
  { id: 2, coinId: "ethereum", symbol: "ETH", name: "Ethereum",         amount: 1.5,   buyPrice: 2100,  buyDate: "2024-03-20", type: "spot" },
  { id: 3, coinId: "ethereum", symbol: "ETH", name: "Ethereum Staking", amount: 1.0,   buyPrice: 1900,  buyDate: "2023-11-01", type: "staking" },
  { id: 4, coinId: "solana",   symbol: "SOL", name: "Solana",           amount: 25,    buyPrice: 95,    buyDate: "2024-05-10", type: "spot" },
];

/* ─── CoinGecko API ─────────────────────────────────────────────────── */
async function fetchCoinGeckoPrices(coinIds) {
  const ids = [...new Set(coinIds)].join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true&include_market_cap=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

/* ─── CSV export ────────────────────────────────────────────────────── */
function exportCSV(holdings, prices) {
  const header = "Coin,Symbole,Quantité,Prix achat (€),Date achat,Prix actuel (€),Valeur (€),Gain/Perte (€),Gain/Perte (%),Type,Impôt PFU estimé (€)";
  const rows = holdings.map((h) => {
    const price     = prices[h.coinId]?.eur ?? h.buyPrice;
    const value     = h.amount * price;
    const cost      = h.amount * h.buyPrice;
    const gainAbs   = value - cost;
    const gainPct   = ((value / cost - 1) * 100).toFixed(2);
    const tax       = gainAbs > 0 ? Math.round(gainAbs * 0.30) : 0;
    return `"${h.name}","${h.symbol}",${h.amount},${h.buyPrice},"${h.buyDate}",${price},${value.toFixed(2)},${gainAbs.toFixed(2)},${gainPct},"${h.type}",${tax}`;
  });
  const csv   = [header, ...rows].join("\n");
  const blob  = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link  = document.createElement("a");
  link.href   = URL.createObjectURL(blob);
  link.download = `wealthtrack-crypto-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

/* ─── Sous-composants ───────────────────────────────────────────────── */

const COIN_COLORS = {
  BTC:"#f7931a", ETH:"#627eea", SOL:"#9945ff", ADA:"#0033ad",
  DOT:"#e6007a", ATOM:"#6f7390", AVAX:"#e84142", POL:"#8247e5",
  NEAR:"#00c08b", XRP:"#346aa9", BNB:"#f3ba2f", CRO:"#002d74",
  DYDX:"#5c5ce6", TIA:"#7c3aed", INJ:"#00a3ff", EGLD:"#1b46c2",
  APT:"#fa6947", SUI:"#4da2ff", SEI:"#9d1f1f", TRX:"#ef0027",
  LTC:"#a6a9aa", ALGO:"#07d4a5",
};

function CoinIcon({ symbol, src, size = 32 }) {
  const [err, setErr] = React.useState(false);
  const color = COIN_COLORS[symbol] || "#4a90d9";
  if (!err && src) {
    return (
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "contain", background: "#fff", flexShrink: 0, display: "block" }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color + "22", border: `2px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size <= 28 ? 8 : 10, fontWeight: 800, color,
      letterSpacing: -0.5,
    }}>
      {symbol.slice(0, 3)}
    </div>
  );
}

function GainBadge({ abs, pct: p }) {
  const T = useT();
  const up = abs >= 0;
  return (
    <div>
      <div style={{ color: up ? T.green : T.red, fontWeight: 700, fontSize: 13 }}>
        {up ? "+" : ""}{eur(abs)}
      </div>
      <div style={{ color: up ? T.green : T.red, fontSize: 11 }}>
        {pct(p)}
      </div>
    </div>
  );
}

// Anneau de focus visible (a11y) — s'ajoute par-dessus le style inline sans
// entrer en conflit de spécificité avec la bordure inline (box-shadow vs border).
const INPUT_FOCUS_CLASS = "focus:ring-2 focus:ring-[#5b8def]/30 transition-shadow duration-150";

/* ─── Badge de risque (pastille colorée, cohérente avec DeFi) ──────────── */
function RiskBadge({ risk }) {
  const T = useT();
  const RISK_TONE = {
    "Faible": { bg: "rgba(0,200,150,0.12)",   color: T.green, Icon: Shield },
    "Moyen":  { bg: "rgba(240,168,72,0.12)",  color: T.amber, Icon: ShieldAlert },
    "Élevé":  { bg: "rgba(255,92,122,0.12)",  color: T.red,   Icon: ShieldOff },
    "—":      { bg: "rgba(255,255,255,0.05)", color: T.muted, Icon: ShieldQuestion },
  };
  const tone = RISK_TONE[risk] || RISK_TONE["—"];
  const Icon = tone.Icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.color }}>
      <Icon size={11} />{risk}
    </span>
  );
}

/* ─── Ligne de squelette (chargement initial des prix) ──────────────────── */
function SkeletonRow() {
  const T = useT();
  const bar = (w, align) => (
    <div style={{ justifySelf: align }}>
      <div className="animate-pulse rounded" style={{ height: 11, width: w, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 90px 100px 100px 120px 36px",
      padding: "12px 16px", borderBottom: `1px solid ${T.border}`, alignItems: "center",
    }}>
      {bar("55%", "start")}
      {bar("40%", "end")}
      {bar("60%", "end")}
      {bar("60%", "end")}
      {bar("50%", "end")}
      {bar("16px", "center")}
    </div>
  );
}

/* ─── Mini-graphique 7 jours (table Marchés) ─────────────────────────── */
function Sparkline({ data, positive }) {
  const T = useT();
  const points = (data || []).map((p, i) => ({ i, p }));
  if (points.length < 2) return <div style={{ width: 100, height: 32 }} />;
  const color = positive ? T.green : T.red;
  const gradId = `spark-${positive ? "up" : "down"}`;
  return (
    <ResponsiveContainer width={100} height={32}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="p" stroke={color} strokeWidth={1.5}
          fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Modale de détail d'une cryptomonnaie (prix, stats, graphique) ──── */
function CoinDetailModal({ coin, onClose, chart, chartLoading, range, onRangeChange }) {
  const T = useT();
  if (!coin) return null;

  const chartChange = chart && chart.length > 1
    ? ((chart[chart.length - 1].price - chart[0].price) / chart[0].price) * 100
    : null;
  const fallbackChange = range === "1" ? coin.price_change_percentage_24h : coin.price_change_percentage_7d_in_currency;
  const displayChange = chartChange ?? fallbackChange;
  const positive = (displayChange ?? 0) >= 0;

  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const tickFormatter = (ts) => {
    const d = new Date(ts);
    if (range === "1")   return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (range === "365") return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  const stats = [
    { label: "Capitalisation",         value: fmtLarge(coin.market_cap) },
    { label: "Volume 24h",             value: fmtLarge(coin.total_volume) },
    { label: "Offre en circulation",   value: `${fmtSupply(coin.circulating_supply)} ${coin.symbol?.toUpperCase()}` },
    { label: "Variation 7j",           value: pct(coin.price_change_percentage_7d_in_currency), color: (coin.price_change_percentage_7d_in_currency ?? 0) >= 0 ? T.green : T.red },
    { label: "Plus haut historique",   value: eurSmart(coin.ath), sub: `${fmtDate(coin.ath_date)} · ${pct(coin.ath_change_percentage)}` },
    { label: "Plus bas historique",    value: eurSmart(coin.atl), sub: `${fmtDate(coin.atl_date)} · ${pct(coin.atl_change_percentage)}` },
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(8,10,20,0.7)", backdropFilter: "blur(4px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20,
        padding: 24, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* En-tête */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={coin.symbol?.toUpperCase()} src={coin.image} size={40} />
            <div>
              <div style={{ color: T.text, fontWeight: 800, fontSize: 18 }}>{coin.name}</div>
              <div style={{ color: T.muted, fontSize: 12 }}>{coin.symbol?.toUpperCase()} · Rang #{coin.market_cap_rank ?? "—"}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Prix */}
        <div className="flex items-end gap-3 mb-4 flex-wrap">
          <div style={{ color: T.text, fontWeight: 800, fontSize: 30 }}>{eurSmart(coin.current_price)}</div>
          <div style={{
            color: positive ? T.green : T.red, fontWeight: 700, fontSize: 14,
            display: "flex", alignItems: "center", gap: 4, marginBottom: 6,
          }}>
            {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {pct(displayChange)}
          </div>
        </div>

        {/* Sélecteur de période */}
        <div className="flex gap-1 mb-3" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4 }}>
          {MARKET_RANGES.map((r) => (
            <button key={r.id} onClick={() => onRangeChange(r.id)} style={{
              flex: 1, padding: "6px 0", borderRadius: 8, border: "none",
              background: range === r.id ? T.blue : "transparent",
              color: range === r.id ? "#fff" : T.muted,
              fontWeight: range === r.id ? 700 : 500, fontSize: 12, cursor: "pointer",
            }}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Graphique */}
        <div style={{ height: 220, marginBottom: 16 }}>
          {chartLoading ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 12 }}>
              Chargement du graphique…
            </div>
          ) : chart && chart.length > 1 ? (
            <ExpandableChart height={220} title="Historique du cours">
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="coinDetailGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={positive ? T.green : T.red} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={positive ? T.green : T.red} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" tickFormatter={tickFormatter} stroke={T.muted} tick={{ fontSize: 10 }}
                  interval={Math.max(0, Math.floor(chart.length / 6) - 1)} />
                <YAxis domain={["auto", "auto"]} tickFormatter={(v) => eurSmart(v)} stroke={T.muted} tick={{ fontSize: 10 }} width={70} />
                <Tooltip
                  contentStyle={{ background: "rgba(20,20,45,0.95)", border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }}
                  itemStyle={{ color: T.text }}
                  labelStyle={{ color: T.muted }}
                  formatter={(v) => [eurSmart(v), "Prix"]}
                  labelFormatter={tickFormatter}
                />
                <Area type="monotone" dataKey="price" stroke={positive ? T.green : T.red} strokeWidth={2}
                  fill="url(#coinDetailGradient)" dot={false} />
              </AreaChart>
            </ExpandableChart>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 12 }}>
              Données indisponibles.
            </div>
          )}
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {stats.map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ color: T.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.color || T.text, fontWeight: 700, fontSize: 14 }}>{s.value}</div>
              {s.sub && <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        <a href={`https://www.coingecko.com/en/coins/${coin.id}`} target="_blank" rel="noopener noreferrer"
          style={{ color: T.blue, fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
          Voir sur CoinGecko <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────────── */
export default function Crypto({ setView, marketsOnly = false }) {
  const T = useT();
  const fmtCtx = useEurCtx();
  const discreet = useDiscreet();
  const [holdings, setHoldings]     = useLocalStorage("wt_crypto_holdings", DEFAULT_HOLDINGS);
  const [prices, setPrices]         = useState({});
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tab, setTab]               = useState(marketsOnly ? "marches" : "holdings"); // holdings | marches | staking
  const [showForm, setShowForm]     = useState(false);

  // Marchés (explorateur de cryptos façon Finary)
  const [marketCoins, setMarketCoins]     = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError]     = useState(null);
  const [marketSearch, setMarketSearch]   = useState("");
  const [selectedCoin, setSelectedCoin]   = useState(null);
  const [coinChart, setCoinChart]         = useState([]);
  const [coinChartLoading, setCoinChartLoading] = useState(false);
  const [coinChartRange, setCoinChartRange]     = useState("7");

  // Logos CoinGecko pour les opportunités
  const [coinImages, setCoinImages] = useState({});

  useEffect(() => {
    if (Object.keys(coinImages).length > 0) return;
    const ids = Object.values(STAKING_COIN_IDS).join(",");
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&ids=${ids}&per_page=50`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        data.forEach(c => { map[c.symbol.toUpperCase()] = c.image; });
        setCoinImages(map);
      })
      .catch(() => {});
  }, [coinImages]);

  // Opportunités staking Crypto.com
  const [offers, setOffers]           = useState(STAKING_STATIC);
  const [offersSource, setOffersSource] = useState("static");
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerFilter, setOfferFilter] = useState("all"); // all | low | medium | high
  const [offerSort, setOfferSort]     = useState("apy"); // apy | coin | risk

  const fetchOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/staking-offers`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error("server error");
      const json = await r.json();
      if (json.success && json.data?.length) {
        setOffers(json.data);
        setOffersSource(json.source);
      }
    } catch {
      // serveur hors ligne → garde STAKING_STATIC déjà chargé
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  /* Formulaire d'ajout */
  const [form, setForm] = useState({
    coinId: "bitcoin", amount: "", buyPrice: "", buyDate: "", type: "spot",
  });

  /* Fetch prix */
  const refresh = useCallback(async () => {
    const ids = [...new Set(holdings.map((h) => h.coinId))];
    if (!ids.length) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCoinGeckoPrices(ids);
      setPrices(data);
      setLastUpdate(new Date());
    } catch (e) {
      setError("Impossible de récupérer les prix. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  useEffect(() => { refresh(); }, [refresh]);

  /* Marchés : liste des cryptos (top 100) */
  const fetchMarketCoins = useCallback(async () => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d");
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      setMarketCoins(await res.json());
    } catch {
      setMarketError("Impossible de récupérer les données de marché. Vérifiez votre connexion.");
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "marches" && marketCoins.length === 0) fetchMarketCoins();
  }, [tab, marketCoins.length, fetchMarketCoins]);

  /* Marchés : graphique de la crypto sélectionnée */
  const fetchCoinChart = useCallback(async (coinId, days) => {
    setCoinChartLoading(true);
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=eur&days=${days}`);
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const data = await res.json();
      setCoinChart((data.prices || []).map(([time, price]) => ({ time, price })));
    } catch {
      setCoinChart([]);
    } finally {
      setCoinChartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCoin) fetchCoinChart(selectedCoin.id, coinChartRange);
  }, [selectedCoin, coinChartRange, fetchCoinChart]);

  /* Calculs portefeuille */
  const enriched = holdings.map((h) => {
    const p     = prices[h.coinId];
    const cur   = p?.eur ?? null;
    const chg   = p?.eur_24h_change ?? null;
    const value = cur != null ? h.amount * cur : null;
    const cost  = h.amount * h.buyPrice;
    const gain  = value != null ? value - cost : null;
    const gainP = (gain != null && cost > 0) ? (gain / cost) * 100 : null;
    return { ...h, currentPrice: cur, change24h: chg, value, cost, gain, gainPct: gainP };
  });

  const totalValue = enriched.reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost  = enriched.reduce((s, h) => s + h.cost, 0);

  // Sync vers Patrimoine : écrit wt_crypto_sync à chaque recalcul
  useEffect(() => {
    if (!enriched.length) return;
    const items = enriched.map((h) => ({
      label: h.type === "staking" ? `${h.symbol} (Staking)` : h.name,
      value: Math.round(h.value ?? h.amount * h.buyPrice),
    }));
    try {
      localStorage.setItem("wt_crypto_sync", JSON.stringify({ items, updatedAt: Date.now() }));
    } catch {}
  }, [enriched]);
  const totalGain  = totalValue - totalCost;
  const totalGainP = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const best  = enriched.reduce((b, h) => (h.gainPct ?? -Infinity) > (b?.gainPct ?? -Infinity) ? h : b, null);
  const worst = enriched.reduce((w, h) => (h.gainPct ?? Infinity) < (w?.gainPct ?? Infinity) ? h : w, null);

  /* Staking */
  const staking = holdings.filter((h) => h.type === "staking").map((h) => {
    const apy     = STAKING_APY[h.coinId] ?? null;
    const curP    = prices[h.coinId]?.eur ?? h.buyPrice;
    const value   = h.amount * curP;
    const annualY = apy != null ? (value * apy) / 100 : null;
    return { ...h, apy, value, annualYield: annualY, monthlyYield: annualY != null ? annualY / 12 : null };
  });

  /* Ajouter position */
  const addHolding = () => {
    const coin = COINS.find((c) => c.id === form.coinId);
    if (!coin || !form.amount || !form.buyPrice) return;
    const newH = {
      id:       nextId(),
      coinId:   form.coinId,
      symbol:   coin.symbol,
      name:     coin.name + (form.type === "staking" ? " Staking" : ""),
      amount:   parseFloat(form.amount),
      buyPrice: parseFloat(form.buyPrice),
      buyDate:  form.buyDate || new Date().toISOString().slice(0, 10),
      type:     form.type,
    };
    setHoldings((prev) => [...prev, newH]);
    setForm({ coinId: "bitcoin", amount: "", buyPrice: "", buyDate: "", type: "spot" });
    setShowForm(false);
  };

  const removeHolding = (id) => setHoldings((prev) => prev.filter((h) => h.id !== id));

  const inp = {
    background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
    color: T.text, borderRadius: 10, padding: "8px 12px", fontSize: 13,
    outline: "none",
  };

  /* ── RENDU ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          {setView && (
            <button onClick={() => setView(marketsOnly ? "outils" : "patrimoine")}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", color: T.text, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <ChevronLeft size={16} style={{ color: T.blue }} />
              {marketsOnly ? "Retour aux Outils" : "Retour au Patrimoine"}
            </button>
          )}
          <h1 className="text-3xl font-bold" style={{ color: T.text }}>{marketsOnly ? "Marché des cryptoactifs" : "Crypto Portfolio"}</h1>
          <p style={{ color: T.muted }}>
            {marketsOnly ? "Cours en temps réel · Top 100 · Capitalisation" : "Valorisation en temps réel · Holdings & Staking"}
            {lastUpdate && (
              <span style={{ fontSize: 11, marginLeft: 8 }}>
                — {lastUpdate.toLocaleTimeString("fr-FR")}
              </span>
            )}
          </p>
        </div>
      </div>


      {/* API error */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.25)`,
          borderRadius: 12, padding: "10px 16px", fontSize: 12, color: T.red,
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Summary cards */}
      {!marketsOnly && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Valeur totale", value: fmtCtx(totalValue), color: T.text, Icon: Wallet },
          { label: "P&L total", value: `${totalGain >= 0 ? "+" : ""}${fmtCtx(totalGain)}`, color: totalGain >= 0 ? T.green : T.red, Icon: totalGain >= 0 ? TrendingUp : TrendingDown },
          { label: "Performance", value: pct(totalGainP), color: totalGainP >= 0 ? T.green : T.red, Icon: Percent },
          { label: "Positions", value: `${holdings.length}`, color: T.blue, Icon: Layers },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px" }}>
            <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
              <span style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
                {kpi.label}
              </span>
              <kpi.Icon size={16} style={{ color: kpi.color, opacity: 0.65, flexShrink: 0 }} />
            </div>
            <div style={{ color: kpi.color, fontSize: 22, fontWeight: 800 }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      )}

      {/* Best / Worst */}
      {!marketsOnly && best && worst && best.id !== worst.id && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Meilleure perf.", Icon: Trophy, h: best },
            { label: "Moins bonne perf.", Icon: TrendingDown, h: worst },
          ].map(({ label, Icon, h }) => (
            <div key={label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 16px" }}>
              <div style={{ color: T.muted, fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon size={11} />{label}
              </div>
              <div className="flex justify-between items-center">
                <div className="font-semibold text-sm" style={{ color: T.text }}>{h.symbol} — {h.name}</div>
                <div style={{ color: h.gainPct >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 14 }}>
                  {pct(h.gainPct)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {!marketsOnly && (
      <div className="flex gap-1" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4 }}>
        {[
          { id: "holdings",     label: "Holdings",                     Icon: Wallet },
          { id: "staking",      label: `Staking (${staking.length})`,  Icon: Lock },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
              background: tab === t.id ? T.blue : "transparent",
              color: tab === t.id ? "#fff" : T.muted,
              fontWeight: tab === t.id ? 700 : 500,
              cursor: "pointer", fontSize: 13, transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* ── TAB: Holdings ── */}
      {tab === "holdings" && (
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "visible" }}>
          {/* En-têtes */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 90px 100px 100px 120px 36px",
            padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
            fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase",
          }}>
            <span>Actif</span>
            <span style={{ textAlign: "right" }}>Quantité</span>
            <span style={{ textAlign: "right" }}>Prix actuel</span>
            <span style={{ textAlign: "right" }}>Valeur</span>
            <span style={{ textAlign: "right" }}>P&L<InfoTooltip text="P&L (Profit & Loss) : plus ou moins-value latente (non réalisée) sur la position, calculée par rapport au prix d'acquisition moyen. Elle ne devient imposable qu'au moment d'une cession (vente, échange crypto→fiat, etc.)." align="right" /></span>
            <span />
          </div>

          {enriched.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "rgba(91,141,239,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
              }}>
                <Wallet size={24} style={{ color: T.blue }} />
              </div>
              <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>Aucune position</div>
              <div style={{ color: T.muted, fontSize: 13 }}>Ajoutez votre première position crypto ci-dessous.</div>
            </div>
          ) : loading && Object.keys(prices).length === 0 ? (
            enriched.map((h) => <SkeletonRow key={h.id} />)
          ) : (
            enriched.map((h) => (
            <div key={h.id} className="hover:bg-white/[0.025] transition-colors" style={{
              display: "grid", gridTemplateColumns: "1fr 90px 100px 100px 120px 36px",
              padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
              alignItems: "center", fontSize: 13,
            }}>
              <div>
                <div className="font-semibold" style={{ color: T.text }}>{h.symbol}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{h.name}</div>
                {h.type === "staking" && (
                  <span className="inline-flex items-center gap-1 mt-0.5 rounded-full text-[10px] font-bold" style={{ color: T.amber, background: "rgba(245,166,35,0.15)", padding: "1px 6px" }}>
                    <Lock size={9} /> STAKING
                  </span>
                )}
              </div>
              <div style={{ textAlign: "right", color: T.muted, filter: discreet ? "blur(8px)" : "none", userSelect: discreet ? "none" : "auto" }}>{h.amount}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: T.text }}>{h.currentPrice ? eur(h.currentPrice, 0) : "—"}</div>
                {h.change24h != null && (
                  <div style={{ fontSize: 11, color: h.change24h >= 0 ? T.green : T.red }}>
                    {pct(h.change24h)} 24h
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", color: T.text, fontWeight: 600 }}>
                {h.value != null ? fmtCtx(h.value) : "—"}
              </div>
              <div style={{ textAlign: "right" }}>
                <GainBadge abs={h.gain} pct={h.gainPct} />
              </div>
              <button onClick={() => removeHolding(h.id)}
                aria-label={`Supprimer ${h.name}`}
                className="hover:text-[#ff5c7a] transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, display: "flex" }}>
                <Trash2 size={13} />
              </button>
            </div>
            ))
          )}

          {/* Ajouter */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{
              width: "100%", background: "none", border: "none", padding: "12px 16px",
              color: T.blue, cursor: "pointer", fontSize: 13, textAlign: "left",
              display: "flex", alignItems: "center", gap: 6, borderTop: `1px solid ${T.border}`,
            }}>
              <Plus size={14} /> Ajouter une position
            </button>
          ) : (
            <div style={{ padding: 16, borderTop: `1px solid ${T.border}` }}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <select value={form.coinId} onChange={(e) => setForm({ ...form, coinId: e.target.value })} style={inp} className={INPUT_FOCUS_CLASS}>
                  {COINS.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: T.panel }}>{c.symbol} — {c.name}</option>
                  ))}
                </select>
                <input placeholder="Quantité" value={form.amount} type="number"
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inp} className={INPUT_FOCUS_CLASS} />
                <input placeholder="Prix achat (€)" value={form.buyPrice} type="number"
                  onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} style={inp} className={INPUT_FOCUS_CLASS} />
                <input placeholder="Date achat" value={form.buyDate} type="date"
                  onChange={(e) => setForm({ ...form, buyDate: e.target.value })} style={inp} className={INPUT_FOCUS_CLASS} />
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inp} className={INPUT_FOCUS_CLASS}>
                  <option value="spot" style={{ background: T.panel }}>Spot</option>
                  <option value="staking" style={{ background: T.panel }}>Staking</option>
                </select>
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={addHolding} style={{
                  background: T.green, color: "#0a0f1e", border: "none",
                  borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700,
                }}>
                  Ajouter
                </button>
                <button onClick={() => setShowForm(false)} style={{
                  background: "none", border: `1px solid ${T.border}`, color: T.muted,
                  borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Marchés ── */}
      {tab === "marches" && (() => {
        const q = marketSearch.trim().toLowerCase();
        const filtered = q
          ? marketCoins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q))
          : marketCoins;

        return (
          <div className="flex flex-col gap-4">
            {/* Recherche */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
              <input
                placeholder="Rechercher une cryptomonnaie (nom ou symbole)…"
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                style={{ ...inp, width: "100%", paddingLeft: 36 }}
                className={INPUT_FOCUS_CLASS}
              />
            </div>

            {marketError && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "10px 16px", fontSize: 12, color: T.red, display: "flex", gap: 8, alignItems: "center" }}>
                <AlertTriangle size={14} /> {marketError}
              </div>
            )}

            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div className="hidden sm:grid" style={{
                gridTemplateColumns: "40px 1fr 100px 80px 80px 80px 110px 110px 110px",
                padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
                fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase",
              }}>
                <span>#</span>
                <span>Actif</span>
                <span style={{ textAlign: "right" }}>Prix</span>
                <span style={{ textAlign: "right" }}>1h</span>
                <span style={{ textAlign: "right" }}>24h</span>
                <span style={{ textAlign: "right" }}>7j</span>
                <span style={{ textAlign: "right" }}>Cap. boursière</span>
                <span style={{ textAlign: "right" }}>Volume 24h</span>
                <span style={{ textAlign: "right" }}>7 derniers jours</span>
              </div>

              {marketLoading && marketCoins.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                  Aucune cryptomonnaie trouvée pour « {marketSearch} ».
                </div>
              ) : (
                filtered.map((c) => {
                  const chg1h = c.price_change_percentage_1h_in_currency;
                  const chg24 = c.price_change_percentage_24h;
                  const chg7  = c.price_change_percentage_7d_in_currency;
                  return (
                    <button key={c.id} onClick={() => { setSelectedCoin(c); setCoinChartRange("7"); }}
                      className="hover:bg-white/[0.025] transition-colors hidden sm:grid"
                      style={{
                        gridTemplateColumns: "40px 1fr 100px 80px 80px 80px 110px 110px 110px",
                        padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
                        alignItems: "center", fontSize: 13, width: "100%",
                        background: "none", border: "none", cursor: "pointer", textAlign: "left",
                      }}>
                      <span style={{ color: T.muted, fontSize: 12 }}>{c.market_cap_rank ?? "—"}</span>
                      <div className="flex items-center gap-2">
                        <CoinIcon symbol={c.symbol?.toUpperCase()} src={c.image} size={26} />
                        <div>
                          <div className="font-semibold" style={{ color: T.text }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: T.muted }}>{c.symbol?.toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", color: T.text, fontWeight: 600 }}>{eurSmart(c.current_price)}</div>
                      <div style={{ textAlign: "right", color: (chg1h ?? 0) >= 0 ? T.green : T.red, fontWeight: 600, fontSize: 12 }}>
                        {pct(chg1h)}
                      </div>
                      <div style={{ textAlign: "right", color: (chg24 ?? 0) >= 0 ? T.green : T.red, fontWeight: 600, fontSize: 12 }}>
                        {pct(chg24)}
                      </div>
                      <div style={{ textAlign: "right", color: (chg7 ?? 0) >= 0 ? T.green : T.red, fontWeight: 600, fontSize: 12 }}>
                        {pct(chg7)}
                      </div>
                      <div style={{ textAlign: "right", color: T.muted, fontSize: 12 }}>{fmtLarge(c.market_cap)}</div>
                      <div style={{ textAlign: "right", color: T.muted, fontSize: 12 }}>{fmtLarge(c.total_volume)}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Sparkline data={c.sparkline_in_7d?.price} positive={(chg7 ?? 0) >= 0} />
                      </div>
                    </button>
                  );
                })
              )}

              {/* Vue mobile : cartes compactes */}
              {!(marketLoading && marketCoins.length === 0) && filtered.length > 0 && (
                <div className="flex sm:hidden flex-col">
                  {filtered.map((c) => {
                    const chg24 = c.price_change_percentage_24h;
                    return (
                      <button key={c.id} onClick={() => { setSelectedCoin(c); setCoinChartRange("7"); }}
                        className="hover:bg-white/[0.025] transition-colors flex items-center justify-between gap-2"
                        style={{
                          padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
                          background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                        }}>
                        <div className="flex items-center gap-2">
                          <CoinIcon symbol={c.symbol?.toUpperCase()} src={c.image} size={26} />
                          <div>
                            <div className="font-semibold" style={{ color: T.text, fontSize: 13 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: T.muted }}>{c.symbol?.toUpperCase()}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{eurSmart(c.current_price)}</div>
                          <div style={{ color: (chg24 ?? 0) >= 0 ? T.green : T.red, fontWeight: 600, fontSize: 11 }}>{pct(chg24)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: T.muted, textAlign: "center" }}>
              Données fournies par CoinGecko · Top 100 par capitalisation
            </div>
          </div>
        );
      })()}

      {/* ── TAB: Staking ── */}
      {tab === "staking" && (() => {
        const filtered = offers
          .filter(o => {
            if (offerFilter === "low")    return o.risk === "Faible";
            if (offerFilter === "medium") return o.risk === "Moyen";
            if (offerFilter === "high")   return o.risk === "Élevé";
            return true;
          })
          .slice()
          .sort((a, b) => {
            if (offerSort === "apy")  return b.flexApy - a.flexApy;
            if (offerSort === "coin") return a.coin.localeCompare(b.coin);
            if (offerSort === "risk") {
              const order = { "Faible": 0, "Moyen": 1, "Élevé": 2, "—": 3 };
              return order[a.risk] - order[b.risk];
            }
            return 0;
          });

        const best = [...offers].sort((a, b) => b.flexApy - a.flexApy)[0];

        return (
          <div className="flex flex-col gap-6">
            {/* Mes positions de staking */}
            <div className="flex flex-col gap-3">
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>Mes positions</div>
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                {staking.length === 0 ? (
                  <div style={{ padding: "40px 16px", textAlign: "center" }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%", background: "rgba(240,168,72,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
                    }}>
                      <Lock size={24} style={{ color: T.amber }} />
                    </div>
                    <div style={{ color: T.text, fontWeight: 600, marginBottom: 4 }}>Aucune position de staking</div>
                    <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
                      Ajoutez une position avec le type « Staking » depuis l'onglet Holdings.
                    </div>
                    <button onClick={() => { setTab("holdings"); setShowForm(true); }} style={{
                      background: T.blue, color: "#fff", border: "none", padding: "10px 20px",
                      borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
                    }}>
                      Ajouter une position
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 80px 80px 100px 110px",
                      padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
                      fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase",
                    }}>
                      <span>Actif</span>
                      <span style={{ textAlign: "right" }}>Quantité</span>
                      <span style={{ textAlign: "right" }}>APY</span>
                      <span style={{ textAlign: "right" }}>Valeur</span>
                      <span style={{ textAlign: "right" }}>Rendement annuel</span>
                    </div>
                    {staking.map((h) => (
                      <div key={h.id} className="hover:bg-white/[0.025] transition-colors" style={{
                        display: "grid", gridTemplateColumns: "1fr 80px 80px 100px 110px",
                        padding: "12px 16px", borderBottom: `1px solid ${T.border}`,
                        alignItems: "center", fontSize: 13,
                      }}>
                        <div>
                          <div className="font-semibold" style={{ color: T.text }}>{h.symbol}</div>
                          <div style={{ fontSize: 11, color: T.muted }}>{h.name}</div>
                        </div>
                        <div style={{ textAlign: "right", color: T.muted, filter: discreet ? "blur(8px)" : "none", userSelect: discreet ? "none" : "auto" }}>{h.amount}</div>
                        <div style={{ textAlign: "right", color: T.amber, fontWeight: 700 }}>
                          {h.apy != null ? `${h.apy} %` : "—"}
                        </div>
                        <div style={{ textAlign: "right", color: T.text }}>{fmtCtx(h.value)}</div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: T.green, fontWeight: 700 }}>{h.annualYield != null ? fmtCtx(h.annualYield) : "—"}</div>
                          <div style={{ fontSize: 11, color: T.muted }}>{h.monthlyYield != null ? `${fmtCtx(h.monthlyYield)}/mois` : ""}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>
                      APY estimatifs. Sources : staking récompenses publiques. Varient selon le réseau.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Opportunités de staking Crypto.com */}
            <div className="flex flex-col gap-4">
              {/* Header info */}
              <div style={{
                background: "rgba(245,166,35,0.07)", border: `1px solid rgba(245,166,35,0.25)`,
                borderRadius: 14, padding: "14px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              }}>
                <div className="flex items-center gap-3">
                  <Zap size={18} style={{ color: T.amber }} />
                  <div>
                    <div style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
                      Offres de staking Crypto.com
                    </div>
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                      {offersSource === "live"
                        ? "Données en direct depuis crypto.com"
                        : offersSource === "fallback"
                        ? "Données du serveur — indicatives (mai 2025)"
                        : "Données indicatives (mai 2025) · Vérifiez sur crypto.com"}
                      {" · "}
                      <a href="https://crypto.com/en-fr/staking" target="_blank" rel="noopener noreferrer"
                        style={{ color: T.blue, textDecoration: "underline" }}>
                        Voir le site officiel
                      </a>
                    </div>
                  </div>
                </div>
                <button onClick={fetchOffers} disabled={offersLoading} style={{
                  background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
                  color: offersLoading ? T.muted : T.text, borderRadius: 8, padding: "7px 12px",
                  cursor: offersLoading ? "default" : "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <RefreshCw size={12} className={offersLoading ? "animate-spin" : ""} />
                  {offersLoading ? "Chargement…" : "Actualiser"}
                </button>
              </div>
  
              {/* KPIs top */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Meilleur APY flexible", value: `${best?.flexApy ?? "—"} %`, sub: best?.coin, color: T.green },
                  { label: "Offres disponibles",    value: offers.length, sub: "cryptos listées", color: T.blue },
                  { label: "Taux Bitcoin (référence)", value: `${offers.find(o=>o.coin==="BTC")?.flexApy ?? "—"} %`, sub: "flexible, sans lock", color: T.muted },
                ].map(k => (
                  <div key={k.label} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 14px" }}>
                    <div style={{ color: T.muted, fontSize: 11 }}>{k.label}</div>
                    <div style={{ color: k.color, fontWeight: 700, fontSize: 20, marginTop: 4 }}>{k.value}</div>
                    <div style={{ color: T.muted, fontSize: 11 }}>{k.sub}</div>
                  </div>
                ))}
              </div>
  
              {/* Filtres + tri */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>Risque :</span>
                {[["all","Tous"],["low","Faible"],["medium","Moyen"],["high","Élevé"]].map(([v, l]) => (
                  <button key={v} onClick={() => setOfferFilter(v)} style={{
                    background: offerFilter === v ? "rgba(255,255,255,0.1)" : "transparent",
                    border: `1px solid ${offerFilter === v ? T.text : T.border}`,
                    color: offerFilter === v ? T.text : T.muted,
                    borderRadius: 20, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                  }}>{l}</button>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ color: T.muted, fontSize: 12 }}>Trier par :</span>
                  {[["apy","APY"],["coin","Nom"],["risk","Risque"]].map(([v, l]) => (
                    <button key={v} onClick={() => setOfferSort(v)} style={{
                      background: offerSort === v ? "rgba(47,155,255,0.12)" : "transparent",
                      border: `1px solid ${offerSort === v ? T.blue : T.border}`,
                      color: offerSort === v ? T.blue : T.muted,
                      borderRadius: 20, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                    }}>{l}</button>
                  ))}
                </div>
              </div>
  
              {/* Table des offres */}
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                {/* Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "52px 1fr 90px 90px 90px 80px 36px",
                  padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
                  fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase",
                }}>
                  <span />
                  <span>Actif</span>
                  <span style={{ textAlign: "right" }}>Flexible</span>
                  <span style={{ textAlign: "right" }}>1 mois</span>
                  <span style={{ textAlign: "right" }}>3 mois</span>
                  <span style={{ textAlign: "center" }}>Risque</span>
                  <span />
                </div>
  
                {filtered.map((o, i) => {
                  const isBest = o.coin === best?.coin && o.flexApy === best?.flexApy;
                  return (
                    <div key={`${o.coin}-${i}`} className="hover:bg-white/[0.025] transition-colors" style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr 90px 90px 90px 80px 36px",
                      padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
                      alignItems: "center",
                      background: isBest ? "rgba(245,166,35,0.04)" : "transparent",
                    }}>
                      {/* Icône */}
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <CoinIcon symbol={o.coin} src={coinImages[o.coin]} size={32} />
                      </div>
  
                      {/* Nom */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{o.coin}</span>
                          <span style={{ fontSize: 12, color: T.muted }}>{o.name}</span>
                          {isBest && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: "rgba(245,166,35,0.2)", color: T.amber }}>
                              <Star size={9} fill="currentColor" /> TOP APY
                            </span>
                          )}
                        </div>
                        {o.note && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{o.note}</div>}
                      </div>
  
                      {/* APY flexible */}
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          fontWeight: 700, fontSize: 14,
                          color: o.flexApy >= 8 ? T.green : o.flexApy >= 4 ? T.cyan : T.muted,
                        }}>
                          {o.flexApy > 0 ? `${o.flexApy.toFixed(1)} %` : "—"}
                        </span>
                      </div>
  
                      {/* APY 1 mois */}
                      <div style={{ textAlign: "right", color: o.lock1m ? T.green : T.muted, fontSize: 13, fontWeight: o.lock1m ? 600 : 400 }}>
                        {o.lock1m ? `${o.lock1m.toFixed(1)} %` : "—"}
                      </div>
  
                      {/* APY 3 mois */}
                      <div style={{ textAlign: "right", color: o.lock3m ? T.green : T.muted, fontSize: 13, fontWeight: o.lock3m ? 600 : 400 }}>
                        {o.lock3m ? `${o.lock3m.toFixed(1)} %` : "—"}
                      </div>
  
                      {/* Risque badge */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <RiskBadge risk={o.risk} />
                      </div>
  
                      {/* Lien Crypto.com */}
                      <a href="https://crypto.com/en-fr/staking" target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", justifyContent: "center", color: T.muted, opacity: 0.6 }}>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  );
                })}
              </div>
  
              {/* Disclaimer */}
              <div className="flex items-start gap-2" style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, padding: "0 4px" }}>
                <AlertTriangle size={13} style={{ color: T.amber, flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0 }}>
                  Les taux sont indicatifs et varient selon votre niveau de staking CRO, les conditions du réseau et la politique de Crypto.com.
                  Les revenus de staking sont susceptibles d'être imposés comme des BNC (Bénéfices Non Commerciaux) en France — consultez un expert-comptable.
                  Unbonding = période pendant laquelle vos fonds sont bloqués après déstaking.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modale détail crypto (tab Marchés) */}
      <CoinDetailModal coin={selectedCoin} onClose={() => setSelectedCoin(null)}
        chart={coinChart} chartLoading={coinChartLoading} range={coinChartRange} onRangeChange={setCoinChartRange} />
    </div>
  );
}
