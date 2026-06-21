import React from "react";
import { C, eur } from "./theme.js";
import {
  BarChart3, LayoutDashboard, ListTree, TrendingUp, Wallet, Flag, Bitcoin,
  Building2, Target, Zap, Calculator, MessageCircle, Users, User, Lock, Crown, Coins,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

/**
 * Deux "vues figées" du dashboard WealthTrack — Free vs Premium —
 * destinées à servir de start/end frame pour une vidéo de transition
 * (section Pricing de la landing page).
 *
 * Accès : http://localhost:5182/?frame=free  ou  ?frame=premium
 *
 * Le contenu reflète exactement les listes "features" / "locked" du
 * plan Gratuit et Premium définies dans Landing.jsx (PRICING), elles-
 * mêmes alignées sur la page "Tarifs" de l'application (PricingPage).
 */

/* ── Données de démo ───────────────────────────────────────────── */

function genWealthSeries(start, monthly, rate, months) {
  const out = [];
  let v = start;
  for (let i = 0; i < months; i++) {
    out.push({ i, value: Math.round(v) });
    v = v * (1 + rate) + monthly;
  }
  return out;
}

// Plan Gratuit : historique limité à 12 mois
const FREE_WEALTH_SERIES = genWealthSeries(168000, 600, 0.004, 12);
// Plan Premium : "Historique illimité" → vue sur 36 mois
const PREMIUM_WEALTH_SERIES = genWealthSeries(140000, 750, 0.0045, 36);

const ALLOC = [
  { name: "ETF / Actions", value: 45, color: C.blue },
  { name: "Immobilier", value: 30, color: C.amber },
  { name: "Épargne", value: 18, color: C.green },
  { name: "Crypto", value: 7, color: "#8b5cf6" },
];

function genSeries(start, growth, steps = 8) {
  const out = [];
  let v = start;
  for (let i = 0; i < steps; i++) {
    out.push({ i, value: Math.round(v) });
    v *= 1 + growth;
  }
  return out;
}

const SIM_ETF  = genSeries(10000, 0.075);
const SIM_IMMO = genSeries(10000, 0.05);
const SIM_BTC  = genSeries(10000, 0.09);

/* Navigation alignée sur Sidebar (App.jsx) + PLAN_ACCESS :
   - tier "premium" : verrouillé en Gratuit, débloqué en Premium
   - tier "pro"     : verrouillé même en Premium (réservé au plan Pro) */
const NAV_ITEMS = [
  { id: "dashboard",   label: "Tableau de bord", icon: LayoutDashboard },
  { id: "finances",    label: "Budget",          icon: ListTree },
  { id: "simulations", label: "Simulations",     icon: TrendingUp },
  { id: "patrimoine",  label: "Patrimoine",      icon: Wallet },
  { id: "fi",          label: "FIRE",            icon: Flag,          tier: "premium" },
  { id: "crypto",      label: "Crypto",          icon: Bitcoin,       tier: "premium" },
  { id: "immobilier",  label: "Immobilier",      icon: Building2,     tier: "premium" },
  { id: "objectifs",   label: "Objectifs",       icon: Target },
  { id: "or",          label: "Or",              icon: Coins,         tier: "premium" },
  { id: "fiscalite",   label: "Fiscalité",       icon: Calculator,    tier: "premium" },
  { id: "assistant",   label: "Assistant",       icon: MessageCircle, tier: "premium" },
  { id: "couple",      label: "Couple / Famille",icon: Users,         tier: "pro" },
  { id: "profil",      label: "Profil",          icon: User },
];

/* ── Sous-composants ───────────────────────────────────────────── */

function Card({ span = 1, title, children }) {
  return (
    <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : ""}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
      {title && <div className="text-xs mb-3" style={{ color: C.muted }}>{title}</div>}
      {children}
    </div>
  );
}

function LockedCard({ span = 1, title, tier = "premium" }) {
  const color = tier === "pro" ? C.amber : C.blue;
  const label = tier === "pro" ? "PRO" : "PREMIUM";
  return (
    <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : ""}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: "relative", overflow: "hidden", minHeight: 132 }}>
      <div style={{ filter: "blur(4px)", opacity: 0.35 }}>
        <div className="text-xs mb-3" style={{ color: C.muted }}>{title}</div>
        <div className="rounded-lg mb-2" style={{ height: 14, width: "70%", background: "rgba(255,255,255,0.08)" }} />
        <div className="rounded-lg" style={{ height: 14, width: "45%", background: "rgba(255,255,255,0.08)" }} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="rounded-full p-2.5" style={{ background: `${color}1a`, border: `1px solid ${color}44` }}>
          <Lock size={16} style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-center px-4" style={{ color: C.text }}>{title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide" style={{ background: color, color: "#fff" }}>{label}</span>
      </div>
    </div>
  );
}

function MiniArea({ data, color, id, height = 60 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AllocCard() {
  return (
    <Card title="Patrimoine — répartition">
      <ResponsiveContainer width="100%" height={90}>
        <PieChart>
          <Pie data={ALLOC} dataKey="value" nameKey="name" innerRadius={26} outerRadius={42} paddingAngle={3} stroke="none">
            {ALLOC.map((e, i) => <Cell key={i} fill={e.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
        {ALLOC.map((a) => (
          <span key={a.name} className="text-[10px] flex items-center gap-1" style={{ color: C.muted }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} /> {a.name}
          </span>
        ))}
      </div>
    </Card>
  );
}

function WealthCard({ premium }) {
  const series = premium ? PREMIUM_WEALTH_SERIES : FREE_WEALTH_SERIES;
  const first = series[0].value;
  const last = series[series.length - 1].value;
  const pct = first !== 0 ? (((last - first) / first) * 100).toFixed(1) : "0.0";
  return (
    <Card span={2} title="Patrimoine net total">
      <div className="text-3xl font-black mb-1" style={{ color: C.text }}>{eur(last)}</div>
      <div className="flex items-center gap-1 text-xs font-semibold mb-3" style={{ color: C.green }}>
        <TrendingUp size={12} /> +{pct} % {premium ? "sur 3 ans" : "sur 12 mois"}
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={series} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={premium ? "premWealthGrad" : "freeWealthGrad"} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity={0.4} />
              <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={C.blue} strokeWidth={2} fill={`url(#${premium ? "premWealthGrad" : "freeWealthGrad"})`} />
        </AreaChart>
      </ResponsiveContainer>
      {premium && (
        <div className="text-[10px] mt-2" style={{ color: C.muted }}>Historique illimité — vue sur 36 mois</div>
      )}
    </Card>
  );
}

function FinancesCard() {
  const revenus = 3200, depenses = 2100, epargne = revenus - depenses;
  const pct = Math.round((epargne / revenus) * 100);
  return (
    <Card title="Suivi des finances">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-black" style={{ color: C.text }}>{pct} %</span>
        <span className="text-xs" style={{ color: C.muted }}>taux d'épargne</span>
      </div>
      <div className="rounded-full overflow-hidden flex" style={{ height: 6, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${100 - pct}%`, background: C.muted }} />
        <div style={{ width: `${pct}%`, background: C.green }} />
      </div>
      <div className="flex justify-between text-xs mt-3">
        <span style={{ color: C.muted }}>Dépenses : {eur(depenses)}</span>
        <span style={{ color: C.green, fontWeight: 700 }}>+{eur(epargne)} épargnés</span>
      </div>
    </Card>
  );
}

function SimulationsCard({ premium }) {
  if (!premium) {
    return (
      <Card span={2} title="Simulation — ETF World (1 scénario)">
        <MiniArea data={SIM_ETF} color={C.blue} id="freeSimEtf" height={90} />
        <div className="text-xs mt-2" style={{ color: C.muted }}>
          Capital projeté à 20 ans : <span style={{ color: C.text, fontWeight: 700 }}>61 400 €</span>
        </div>
      </Card>
    );
  }
  return (
    <Card span={2} title="Simulations — tous les scénarios">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <MiniArea data={SIM_ETF} color={C.blue} id="premSimEtf" />
          <div className="text-[10px] text-center mt-1" style={{ color: C.muted }}>ETF World</div>
        </div>
        <div>
          <MiniArea data={SIM_IMMO} color={C.amber} id="premSimImmo" />
          <div className="text-[10px] text-center mt-1" style={{ color: C.muted }}>Immobilier</div>
        </div>
        <div>
          <MiniArea data={SIM_BTC} color="#f7931a" id="premSimBtc" />
          <div className="text-[10px] text-center mt-1" style={{ color: C.muted }}>Bitcoin</div>
        </div>
      </div>
    </Card>
  );
}

function FICard() {
  return (
    <Card title="Indépendance financière">
      <div className="text-2xl font-black mb-1" style={{ color: C.green }}>52 ans</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>Âge IF projeté</div>
      <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
        <Flag size={13} style={{ color: C.green }} /> Dans 18 ans · scénario base 7 %/an
      </div>
    </Card>
  );
}

function FiscaliteCard() {
  return (
    <Card title="Fiscalité patrimoniale">
      <div className="text-2xl font-black mb-1" style={{ color: C.text }}>{eur(218400)}</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>Capital net d'impôts (PEA, CTO, AV)</div>
      <div className="flex items-center gap-2 text-xs" style={{ color: C.blue }}>
        <Calculator size={13} /> PFU 30 % appliqué automatiquement
      </div>
    </Card>
  );
}

function ImmobilierCard() {
  return (
    <Card title="Simulateur immobilier">
      <div className="text-2xl font-black mb-1" style={{ color: C.text }}>{eur(312000)}</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>Capacité d'emprunt estimée</div>
      <div className="flex items-center gap-2 text-xs" style={{ color: C.amber }}>
        <Building2 size={13} /> Mensualité ≈ {eur(1450)} sur 25 ans
      </div>
    </Card>
  );
}

function CryptoDefiCard() {
  return (
    <Card title="Crypto">
      <div className="flex items-center gap-2 mb-3">
        <Bitcoin size={18} style={{ color: "#f7931a" }} />
        <span className="text-2xl font-black" style={{ color: C.text }}>+4,2 %</span>
      </div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>Performance estimée (annualisée)</div>
      <div className="flex gap-2 text-[10px]">
        <span className="px-2 py-1 rounded-full font-semibold" style={{ background: "#f7931a1a", color: "#f7931a" }}>BTC 60 %</span>
        <span className="px-2 py-1 rounded-full font-semibold" style={{ background: `${C.blue}1a`, color: C.blue }}>ETH 40 %</span>
      </div>
    </Card>
  );
}

function AssistantCard() {
  return (
    <Card title="Assistant financier">
      <div className="flex flex-col gap-2">
        <div className="text-xs px-3 py-2 rounded-xl self-end" style={{ background: `${C.blue}1a`, color: C.text }}>
          Comment optimiser mon PEA ?
        </div>
        <div className="text-xs px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: C.muted }}>
          Versez 1 200 €/an de plus pour atteindre le plafond et économiser ~340 €/an d'impôts.
        </div>
      </div>
    </Card>
  );
}

/* ── Squelette commun ──────────────────────────────────────────── */

function FrameShell({ premium, children }) {
  return (
    <div style={{ background: C.bgGradient, color: C.text, fontFamily: "'Geist Sans', 'Inter', -apple-system, 'Segoe UI', sans-serif", minHeight: "100vh" }}>
      <div className="max-w-[1280px] mx-auto flex">

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 px-4 py-6 shrink-0" style={{ width: 220, borderRight: `1px solid ${C.border}`, background: C.panel }}>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="rounded-xl p-2" style={{ background: C.blue }}>
              <BarChart3 size={18} color="#fff" />
            </div>
            <span className="text-base font-bold" style={{ color: C.text, fontFamily: "'Lora', Georgia, serif" }}>WealthTrack</span>
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const locked = item.tier === "pro" ? true : item.tier === "premium" ? !premium : false;
            const active = item.id === "dashboard";
            return (
              <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
                style={{
                  background: active ? `${C.blue}18` : "transparent",
                  color: active ? C.blue : locked ? "#3a4254" : C.muted,
                  fontWeight: active ? 600 : 500,
                }}>
                <span className="flex items-center gap-2.5"><Icon size={15} /> {item.label}</span>
                {locked && <Lock size={11} />}
              </div>
            );
          })}
          <div className="mt-auto px-1 pt-6">
            {premium ? (
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs font-semibold"
                style={{ background: `linear-gradient(135deg, ${C.blue}22, #8b5cf622)`, border: `1px solid ${C.blue}44`, color: C.blue }}>
                <Crown size={13} /> Premium actif
              </div>
            ) : (
              <div className="rounded-xl px-3 py-3 text-center" style={{ background: `${C.blue}12`, border: `1px solid ${C.blue}33` }}>
                <div className="text-xs font-semibold mb-1" style={{ color: C.text }}>Passer Premium</div>
                <div className="text-[10px] leading-relaxed" style={{ color: C.muted }}>Débloquez tous les modules</div>
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-6 md:px-10 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xl font-black" style={{ color: C.text }}>Tableau de bord</div>
              <div className="text-xs" style={{ color: C.muted }}>Bonjour Marie, voici votre situation</div>
            </div>
            {premium ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: `linear-gradient(135deg, ${C.blue}, #8b5cf6)`, color: "#fff" }}>
                <Crown size={12} /> Premium
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.04)", color: C.muted, border: `1px solid ${C.border}` }}>
                Plan Gratuit
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Vue Free ──────────────────────────────────────────────────── */

export function FreeDashboardFrame() {
  return (
    <FrameShell premium={false}>
      <WealthCard premium={false} />
      <FinancesCard />

      <SimulationsCard premium={false} />
      <AllocCard />

      <LockedCard title="Indépendance Financière" tier="premium" />
      <LockedCard title="Fiscalité patrimoniale" tier="premium" />
      <LockedCard title="Simulateur Immobilier" tier="premium" />

      <LockedCard title="Crypto" tier="premium" />
      <LockedCard title="Assistant financier" tier="premium" />
      <LockedCard title="Or / Métaux précieux" tier="pro" />
    </FrameShell>
  );
}

/* ── Vue Premium ───────────────────────────────────────────────── */

export function PremiumDashboardFrame() {
  return (
    <FrameShell premium>
      <WealthCard premium />
      <FinancesCard />

      <SimulationsCard premium />
      <AllocCard />

      <FICard />
      <FiscaliteCard />
      <ImmobilierCard />

      <CryptoDefiCard />
      <AssistantCard />
      <LockedCard title="Or / Métaux précieux" tier="pro" />
    </FrameShell>
  );
}
