import React, { useState, useMemo, useRef } from "react";
import { useT } from "./ThemeProvider.jsx";
import { glow } from "./theme.js";
import { useLocalStorage } from "./storage.js";
import { Card, Field, makeInputStyle, makeChartTip } from "./ui.jsx";
import { fv, RATE_ETF_WORLD } from "./finance.js";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Percent, AlertTriangle, TrendingDown, Info, ChevronDown, ChevronUp, BookOpen, Wallet, ArrowRight } from "lucide-react";

const eur = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(Number.isFinite(n) ? n : 0)) + " €";

const HORIZONS = [5, 10, 15, 20, 30];

const DEVICES = [
  {
    id: "etf_pea",
    name: "ETF PEA",
    label: "ETF World (PEA)",
    color: "#22c55e",
    fraisEntree: 0,
    fraisAnnuels: 0.25,
    rendementBrut: RATE_ETF_WORLD * 100,
    type: "passif",
    avantages: ["Pas de frais d'entrée en courtage en ligne", "Enveloppe fiscale PEA avantageuse", "Liquidité immédiate"],
    inconvenients: ["Performance non garantie", "Risque de marché (~−35% en crise)"],
    note: "Frais annuels tout inclus très bas (souvent 0,07 à 0,25 %). Disponible chez la plupart des courtiers en ligne.",
  },
  {
    id: "av_uc",
    name: "AV Unités de Compte",
    label: "Assurance-Vie UC",
    color: "#3b82f6",
    fraisEntree: 0,
    fraisAnnuels: 1.4,
    rendementBrut: RATE_ETF_WORLD * 100,
    type: "mixte",
    avantages: ["Fiscalité successorale avantageuse", "Gestion libre ou pilotée", "Arbitrages possibles"],
    inconvenients: ["Frais du contrat (0,5–1%) + frais des placements (0,5–1%)", "Rapporte moins qu'un ETF acheté en direct"],
    note: "Frais du contrat ~0,7 % + frais des supports ~0,7 %. Comparez les contrats : visez moins de 0,6 % de frais de contrat.",
  },
  {
    id: "av_fonds_euro",
    name: "AV fonds €",
    label: "Assurance-Vie fonds euros",
    color: "#f59e0b",
    fraisEntree: 0,
    fraisAnnuels: 0.8,
    rendementBrut: 2.5,
    type: "garanti",
    avantages: ["Capital garanti", "Liquidité sous 72h", "Rendement net récent ~2%"],
    inconvenients: ["Rendement faible sur longue durée", "Frais du contrat déduits avant revalorisation"],
    note: "Rendement brut récent ~2,5%, net après frais ~1,7%. Bon pour l'épargne de précaution à moyen terme.",
  },
  {
    id: "per",
    name: "PER",
    label: "Plan d'Épargne Retraite",
    color: "#8b5cf6",
    fraisEntree: 0,
    fraisAnnuels: 1.5,
    rendementBrut: 8.0,
    type: "retraite",
    avantages: ["Déduction fiscale à l'entrée (jusqu'à 30%)", "Épargne retraite structurée", "UC + fonds €"],
    inconvenients: ["Bloqué jusqu'à retraite (sauf cas exceptionnels)", "Frais élevés chez banques traditionnelles"],
    note: "L'avantage fiscal à l'entrée compense souvent les frais. En ligne, on trouve des PER à ~0,5 % de frais de contrat.",
  },
  {
    id: "opcvm",
    name: "OPCVM actif",
    label: "Fonds actifs (SICAV, FCP)",
    color: "#ef4444",
    fraisEntree: 2.0,
    fraisAnnuels: 2.0,
    rendementBrut: RATE_ETF_WORLD * 100,
    type: "actif",
    avantages: ["Gestion professionnelle active", "Diversification automatique"],
    inconvenients: ["Frais d'entrée 0–5% + gestion 1,5–2,5%", "80% des fonds actifs sous-performent leur indice sur 10 ans (SPIVA)"],
    note: "Les frais élevés sont rarement compensés par la surperformance. Préférer les ETF à frais identiques.",
  },
  {
    id: "scpi",
    name: "SCPI",
    label: "SCPI (immobilier sans gestion)",
    color: "#f97316",
    fraisEntree: 10.0,
    fraisAnnuels: 1.0,
    rendementBrut: 4.5,
    type: "immo",
    avantages: ["Exposition immobilière sans gestion", "Rendement distribué ~4–5%", "Diversification géographique"],
    inconvenients: ["Frais d'entrée 8–12% (one-shot)", "Liquidité faible (délai de revente)", "Risque immobilier"],
    note: "Frais d'entrée très élevés : il faut ~5 ans pour les amortir. Horizon recommandé : 10+ ans.",
  },
];

const GLOSSAIRE = [
  { term: "Frais d'entrée", def: "Prélevés une fois à la souscription (ex: 3% sur un versement de 10 000€ = 300€ perdus immédiatement). Négociables ou nuls en ligne." },
  { term: "Frais de gestion annuels", def: "Prélevés chaque année sur tout l'argent placé (ex : 1,5 % sur 50 000 € = 750 €/an). Année après année, 1,5 %/an efface environ 25 % du capital sur 20 ans." },
  { term: "TER (Total Expense Ratio)", def: "Le total des frais annuels d'un ETF ou d'un fonds, tout compris. Un TER de 0,25 %, c'est 2,50 € par an pour 1 000 € placés." },
  { term: "Frais d'enveloppe", def: "Les frais du contrat lui-même (assurance-vie, PER), en plus des frais des placements qu'il contient. Ils s'additionnent : 0,7 % de contrat + 0,7 % de placement = 1,4 % au total." },
  { term: "Commission sur les gains", def: "Des frais en plus quand le fonds dépasse son objectif (ex : 20 % des gains supplémentaires). Ils réduisent votre rendement justement les bonnes années." },
  { term: "Gestion libre", def: "Vous choisissez vous-même où va votre argent (ETF, fonds €…). Le moins cher, mais demande un peu d'implication." },
  { term: "Gestion pilotée", def: "Un robot ou un gérant décide à votre place selon votre profil. Plus simple, mais 0,3 à 0,9 % de frais en plus chaque année." },
  { term: "Unités de Compte (UC)", def: "Les placements d'une assurance-vie ou d'un PER dont la valeur peut monter ou baisser (actions, ETF…). Plus de potentiel, mais risque de perte." },
  { term: "Fonds euros", def: "Support garanti en capital dans une AV. Rendement faible (~2–3%). Idéal pour la partie sécurisée d'un contrat multi-support." },
  { term: "Effet de capitalisation des frais", def: "1€ de frais prélevé aujourd'hui coûte bien plus que 1€ futur — car ces 1€ n'a pas pu croître pendant des années." },
];

function FeeImpactBar({ horizon, capital, feeRate }) {
  const T = useT();
  const data = useMemo(() => {
    const ref = fv(capital, 0, RATE_ETF_WORLD, horizon);
    return DEVICES.map((d) => {
      const entryDeduction = capital * (d.fraisEntree / 100);
      const capitalNet = capital - entryDeduction;
      const netRate = (d.rendementBrut - d.fraisAnnuels) / 100;
      const final = fv(capitalNet, 0, netRate, horizon);
      return { name: d.name, final: Math.round(final), color: d.color };
    }).concat([
      { name: "Banque trad.", final: Math.round(fv(capital, 0, (RATE_ETF_WORLD - feeRate / 100), horizon)), color: "#64748b" }
    ]);
  }, [capital, horizon, feeRate]);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
    <div style={{ minWidth: 480 }}>
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.round(v / 1e3) + "k"} tick={{ fontSize: 10, fill: T.muted }} width={44} />
        <Tooltip
          {...makeChartTip(T)}
          formatter={(v) => [eur(v), "Capital final"]}
        />
        <Bar dataKey="final" radius={[6, 6, 0, 0]}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
    </div>
  );
}

function GlossaireItem({ term, def }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", gap: 12 }}
      >
        <span style={{ color: T.text, fontWeight: 600, fontSize: 14 }}>{term}</span>
        {open ? <ChevronUp size={16} style={{ color: T.muted, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: T.muted, flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, paddingBottom: 14 }}>
          {def}
        </div>
      )}
    </div>
  );
}

export default function Frais({ invested = 0, setView }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  // Le capital part du montant réellement investi par l'utilisateur (poche
  // "Investissements" du patrimoine) si disponible, sinon 10 000 € par défaut.
  // Inputs persistés : on ne repart plus de zéro à chaque visite.
  const [capital, setCapital] = useLocalStorage("wt_frais_capital", invested > 0 ? Math.round(invested) : 10000);
  const [horizon, setHorizon] = useLocalStorage("wt_frais_horizon", 20);
  const [feeRate, setFeeRate] = useLocalStorage("wt_frais_feerate", 1.8);
  const [expanded, setExpanded] = useState(null);
  const glossaireRef = useRef(null);
  const scrollToGlossaire = () => glossaireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const hasRealData = invested > 0;
  // Coût annuel estimé des frais sur le capital réellement investi (1re année).
  const realAnnualCost = Math.round(invested * (feeRate / 100));
  const useRealCapital = () => setCapital(Math.round(invested));

  const impactData = useMemo(() => {
    const sans = fv(capital, 0, RATE_ETF_WORLD, horizon);
    const avec = fv(capital, 0, RATE_ETF_WORLD - feeRate / 100, horizon);
    const perte = sans - avec;
    const pct = ((perte / sans) * 100).toFixed(0);
    return { sans, avec, perte, pct };
  }, [capital, horizon, feeRate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Percent size={22} style={{ color: "#ef4444" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: T.text, fontSize: 26, fontWeight: 800, margin: 0 }}>Mes frais</h1>
            <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Combien les frais de vos placements vous coûtent vraiment — et comment payer moins.</p>
          </div>
          {/* Raccourci glossaire — pour les novices */}
          <button onClick={scrollToGlossaire}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)", color: T.text, cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <BookOpen size={15} style={{ color: T.muted }} /> Glossaire
          </button>
        </div>
      </div>

      {/* Carte personnalisée — basée sur le capital réellement investi */}
      {hasRealData ? (
        <Card style={{ background: "rgba(59,130,246,0.06)", borderColor: "rgba(59,130,246,0.28)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59,130,246,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Wallet size={20} style={{ color: T.blue }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Vos placements : {eur(invested)}
              </div>
              <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
                À <strong style={{ color: T.text }}>{feeRate.toFixed(1).replace(".", ",")} %</strong> de frais par an, ils vous coûtent environ{" "}
                <strong style={{ color: "#ef4444" }}>{eur(realAnnualCost)} cette année</strong> — et bien plus sur la durée à cause de l'effet cumulé.
                Le simulateur ci-dessous part de ce montant réel.
              </div>
            </div>
            {setView && (
              <button onClick={() => setView("patrimoine")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", color: T.text, cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                Voir mes placements <ArrowRight size={15} style={{ color: T.blue }} />
              </button>
            )}
          </div>
        </Card>
      ) : (
        <Card style={{ background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Wallet size={20} style={{ color: T.muted }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                Personnalisez avec vos vrais placements
              </div>
              <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
                Renseignez vos investissements dans le Patrimoine et cette page calculera vos frais réels, pas un exemple générique.
              </div>
            </div>
            {setView && (
              <button onClick={() => setView("patrimoine")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", color: T.text, cursor: "pointer", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                Saisir mes placements <ArrowRight size={15} style={{ color: T.blue }} />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Guide pédagogique frais & dispositifs */}
      <Card>
        <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Comprendre les frais</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { title: "Frais d'entrée", color: "#ef4444", icon: "✗", desc: "Prélevés une seule fois, au moment où vous placez votre argent. Exemple : 3 % sur 10 000 €, c'est 300 € perdus dès le premier jour.", tip: "Visez 0 % : ils ont disparu chez les courtiers en ligne." },
            { title: "Frais de gestion annuels", color: "#f59e0b", icon: "%", desc: "Prélevés chaque année sur tout l'argent que vous avez placé. Le piège : 1,5 %/an pendant 20 ans, c'est environ 25 % de votre capital final qui part en frais.", tip: "ETF en PEA : ~0,25 %/an. Fonds gérés activement : 1,5 à 2,5 %/an." },
            { title: "Commission sur les gains", color: "#8b5cf6", icon: "⚠", desc: "Certains fonds prennent 10 à 20 % de vos gains au-delà d'un objectif — parfois même les années où votre épargne a baissé.", tip: "Préférez les fonds qui n'en prélèvent pas." },
          ].map((f) => (
            <div key={f.title} style={{ borderRadius: 14, padding: 16, background: T.veil1, border: `1px solid ${f.color}33` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: f.color + "18", color: f.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{f.icon}</span>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>{f.title}</span>
              </div>
              <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{f.desc}</p>
              <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, fontWeight: 600, background: f.color + "10", color: f.color }}>{f.tip}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
          <div style={{ borderRadius: 14, padding: 16, background: T.veil1, border: `1px solid ${T.border}` }}>
            <h3 style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Gestion libre ou gestion pilotée ?</h3>
            <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}><strong style={{ color: "#22c55e" }}>Gestion libre :</strong> vous choisissez vous-même où va votre argent. Le moins cher, et vous gardez le contrôle.</p>
            <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}><strong style={{ color: "#3b82f6" }}>Gestion pilotée :</strong> quelqu'un (ou un robot) décide à votre place selon votre profil. Plus simple, mais 0,3 à 0,9 %/an de frais en plus.</p>
            <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(34,197,94,0.08)", color: "#22c55e", fontWeight: 600 }}>Si vous savez expliquer où va votre argent, gérez-le vous-même.</div>
          </div>
          <div style={{ borderRadius: 14, padding: 16, background: T.veil1, border: `1px solid ${T.border}` }}>
            <h3 style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Sécurisé ou plus rémunérateur ?</h3>
            <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}><strong style={{ color: "#f59e0b" }}>Le sûr (fonds euros) :</strong> votre argent ne peut pas baisser, mais rapporte peu (~2–3 %/an). Pour l'épargne que vous voulez protéger.</p>
            <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}><strong style={{ color: "#3b82f6" }}>Le dynamique (actions, ETF, immobilier) :</strong> peut rapporter plus, mais peut aussi baisser. Pour faire croître votre argent sur le long terme.</p>
            <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", color: "#f59e0b", fontWeight: 600 }}>Jeune : surtout du dynamique. Proche de la retraite : sécurisez peu à peu.</div>
          </div>
        </div>
      </Card>

      {/* Simulateur d'impact */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <TrendingDown size={18} style={{ color: "#ef4444" }} />
          <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>Combien les frais vous coûtent</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          <Field label="Capital initial (€)">
            <input type="number" value={capital || ""} placeholder="0" style={inputStyle}
              onChange={(e) => setCapital(+e.target.value || 0)} />
            {hasRealData && Math.round(invested) !== capital && (
              <button onClick={useRealCapital}
                style={{ marginTop: 6, background: "none", border: "none", color: T.blue, cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600 }}>
                Utiliser mes placements ({eur(invested)})
              </button>
            )}
          </Field>
          <Field label="Horizon">
            <select value={horizon} onChange={(e) => setHorizon(+e.target.value)}
              style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none" }}>
              {HORIZONS.map((h) => <option key={h} value={h}>{h} ans</option>)}
            </select>
          </Field>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: T.muted, fontSize: 13 }}>Frais de votre banque / fonds</span>
              <span style={{ color: "#ef4444", fontWeight: 700 }}>{feeRate.toFixed(1).replace(".", ",")} %</span>
            </div>
            <input type="range" min={0} max={3} step={0.1} value={feeRate}
              onChange={(e) => setFeeRate(+e.target.value)}
              style={{ width: "100%", accentColor: "#ef4444" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
              <span>0 %</span><span>1,5 %</span><span>3 %</span>
            </div>
          </div>
        </div>

        {/* Impact card */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ borderRadius: 12, padding: 16, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>ETF sans frais (0,25%)</div>
            <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 22 }}>{eur(impactData.sans)}</div>
          </div>
          <div style={{ borderRadius: 12, padding: 16, background: "rgba(100,116,139,0.07)", border: `1px solid ${T.border}` }}>
            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4 }}>Avec {feeRate.toFixed(1).replace(".", ",")} % de frais/an</div>
            <div style={{ color: T.text, fontWeight: 800, fontSize: 22 }}>{eur(impactData.avec)}</div>
          </div>
          <div style={{ borderRadius: 12, padding: 16, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ce que vous perdez sur {horizon} ans</div>
            <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 22 }}>− {eur(impactData.perte)}</div>
            <div style={{ color: "#ef4444", fontSize: 12, opacity: 0.8 }}>soit {impactData.pct}% de votre capital en moins</div>
          </div>
        </div>

        <p style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>
          Comparaison sur {horizon} ans avec un taux brut de {(RATE_ETF_WORLD * 100).toFixed(1).replace(".", ",")}% (ETF World historique).
        </p>

        <FeeImpactBar horizon={horizon} capital={capital} feeRate={feeRate} />
      </Card>

      {/* Tableau comparatif */}
      <Card>
        <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Comparer les placements</h2>
        <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>PEA, assurance-vie, PER, fonds actifs et SCPI. Cliquez sur un placement pour voir le détail.</p>

        {/* Mobile-friendly: cards stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEVICES.map((d) => {
            const isOpen = expanded === d.id;
            const netRate = d.rendementBrut - d.fraisAnnuels;
            const final20 = Math.round(fv(10000 * (1 - d.fraisEntree / 100), 0, netRate / 100, 20));
            return (
              <div key={d.id}
                style={{ borderRadius: 12, border: `1.5px solid ${isOpen ? d.color + "88" : T.border}`, overflow: "hidden", transition: "border-color 0.2s" }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : d.id)}
                  style={{ width: "100%", background: isOpen ? `${d.color}08` : "transparent", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}
                >
                  {/* Ligne 1 : pastille + libellé + chevron (jamais de chevauchement) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: d.color, flexShrink: 0 }} />
                    <div style={{ color: T.text, fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0 }}>{d.label}</div>
                    {isOpen ? <ChevronUp size={16} style={{ color: T.muted, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: T.muted, flexShrink: 0 }} />}
                  </div>
                  {/* Ligne 2 : badges de frais — passent à la ligne proprement sur mobile */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 20 }}>
                    {d.fraisEntree > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                        Entrée {d.fraisEntree}%
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${d.color}18`, color: d.color }}>
                      {d.fraisAnnuels.toFixed(2).replace(".", ",")}%/an
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: T.muted }}>
                      {eur(final20)} à 20 ans*
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
                      <div style={{ borderRadius: 8, padding: "10px 12px", background: "rgba(255,255,255,0.03)" }}>
                        <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>Frais d'entrée</div>
                        <div style={{ color: d.fraisEntree > 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                          {d.fraisEntree > 0 ? `${d.fraisEntree}%` : "0% ✓"}
                        </div>
                      </div>
                      <div style={{ borderRadius: 8, padding: "10px 12px", background: "rgba(255,255,255,0.03)" }}>
                        <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>Frais annuels</div>
                        <div style={{ color: d.fraisAnnuels > 1.5 ? "#ef4444" : d.fraisAnnuels > 0.8 ? "#f59e0b" : "#22c55e", fontWeight: 700 }}>
                          {d.fraisAnnuels.toFixed(2).replace(".", ",")}%
                        </div>
                      </div>
                      <div style={{ borderRadius: 8, padding: "10px 12px", background: "rgba(255,255,255,0.03)" }}>
                        <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>Rendement avant frais (indicatif)</div>
                        <div style={{ color: T.text, fontWeight: 700 }}>{d.rendementBrut.toFixed(1).replace(".", ",")}%/an</div>
                      </div>
                      <div style={{ borderRadius: 8, padding: "10px 12px", background: `${d.color}10` }}>
                        <div style={{ color: T.muted, fontSize: 11, marginBottom: 2 }}>Capital estimé dans 20 ans*</div>
                        <div style={{ color: d.color, fontWeight: 700 }}>{eur(final20)}</div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>✓ Avantages</div>
                          {d.avantages.map((a) => <div key={a} style={{ color: T.muted, fontSize: 12, marginBottom: 3 }}>• {a}</div>)}
                        </div>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>✗ Inconvénients</div>
                          {d.inconvenients.map((i) => <div key={i} style={{ color: T.muted, fontSize: 12, marginBottom: 3 }}>• {i}</div>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Info size={13} style={{ color: T.muted, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: T.muted, fontSize: 12 }}>{d.note}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ color: T.muted, fontSize: 11, marginTop: 14 }}>
          * Simulation sur 10 000 € initial, 0 versement mensuel, 20 ans. Frais d'entrée déduits du capital de départ. Rendement brut indicatif variable selon les dispositifs. Non garanti.
        </p>
      </Card>

      {/* Alerte OPCVM */}
      <div style={{ borderRadius: 14, padding: 16, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <AlertTriangle size={20} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Attention aux fonds gérés activement</div>
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
            D'après une grande étude de S&P, <strong style={{ color: T.text }}>plus de 8 fonds gérés activement sur 10 font moins bien qu'un simple ETF sur 10 ans</strong>, une fois les frais déduits.
            1 % de frais en plus pendant 30 ans, c'est <strong style={{ color: "#ef4444" }}>environ 26 % de capital en moins</strong> au final.
          </div>
        </div>
      </div>

      {/* Glossaire */}
      <div ref={glossaireRef} style={{ scrollMarginTop: 16 }}>
        <Card>
          <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Le vocabulaire des frais, expliqué simplement</h2>
          {GLOSSAIRE.map((g) => <GlossaireItem key={g.term} term={g.term} def={g.def} />)}
        </Card>
      </div>
    </div>
  );
}
