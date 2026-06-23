import React, { useState, useMemo, lazy, Suspense } from "react";
import { useT } from "./ThemeProvider.jsx";
import { RATE_A, RATE_DISCLAIMER, fvMonthly } from "./finance.js";
import {
  ArrowRight, ArrowLeft, Search, Check, AlertTriangle,
  Sprout, BookOpen, LineChart, Crown,
  Wallet, Repeat, TrendingUp, Flag,
} from "lucide-react";

// Fond animé partagé avec la landing (WebGL, position: fixed).
const PaperShaderBackground = lazy(() => import("./PaperShaderBackground.jsx"));

/* ------------------------------------------------------------------ */
/*  Données du questionnaire                                          */
/* ------------------------------------------------------------------ */

const COUNTRIES = [
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "US", name: "États-Unis", flag: "🇺🇸" },
  { code: "CH", name: "Suisse", flag: "🇨🇭" },
  { code: "BE", name: "Belgique", flag: "🇧🇪" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "ES", name: "Espagne", flag: "🇪🇸" },
  { code: "IT", name: "Italie", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱" },
  { code: "IE", name: "Irlande", flag: "🇮🇪" },
  { code: "MA", name: "Maroc", flag: "🇲🇦" },
  { code: "OTHER", name: "Autre pays", flag: "🌍" },
];

const KNOWLEDGE = [
  { id: "debutant", icon: Sprout,    label: "Je débute tout juste", sub: "J'ai besoin d'être guidé." },
  { id: "bases",    icon: BookOpen,  label: "J'ai quelques bases", sub: "Je veux structurer mes investissements." },
  { id: "actif",    icon: LineChart, label: "Investisseur actif", sub: "Je gère déjà plusieurs actifs." },
  { id: "expert",   icon: Crown,     label: "Expert", sub: "Je cherche un outil de pilotage avancé." },
];

const GOALS = [
  { id: "depenses",    icon: Wallet,     label: "Maîtriser mes dépenses", sub: "Garder le contrôle de mon quotidien." },
  { id: "automatiser", icon: Repeat,     label: "Automatiser mon suivi", sub: "Tout centraliser sans effort." },
  { id: "capital",     icon: TrendingUp, label: "Maximiser mes gains", sub: "Construire et faire croître mon capital." },
  { id: "fire",        icon: Flag,       label: "Atteindre l'indépendance financière", sub: "Simuler mon chemin vers la liberté." },
];

const BRACKETS = [
  { id: "<10k",      label: "Moins de 10 000 €" },
  { id: "10-50k",    label: "10 000 € à 50 000 €" },
  { id: "50-100k",   label: "50 000 € à 100 000 €" },
  { id: "100-500k",  label: "100 000 € à 500 000 €" },
  { id: ">500k",     label: "Plus de 500 000 €" },
];

const ENVELOPES = [
  { id: "livrets", label: "Livrets (A, LDDS, LEP)" },
  { id: "av",      label: "Assurance vie" },
  { id: "pea",     label: "PEA / Compte-titres" },
  { id: "per",     label: "PER" },
];

const eur = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export default function Onboarding({ onComplete, onLogin }) {
  const T = useT();
  const [step, setStep] = useState(0);

  // Réponses
  const [prenom, setPrenom]   = useState("");
  const [age, setAge]         = useState("");
  const [country, setCountry] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [goal, setGoal]       = useState("");
  const [bracket, setBracket] = useState("");
  const [revenus, setRevenus] = useState("");
  const [loyer, setLoyer]     = useState("");
  const [epargne, setEpargne] = useState("");
  const [epargneTotale, setEpargneTotale] = useState("");
  const [immo, setImmo]       = useState("");
  const [repart, setRepart]   = useState(() =>
    Object.fromEntries(ENVELOPES.map((e) => [e.id, { on: false, val: "" }])));

  const [countryQuery, setCountryQuery] = useState("");

  const TOTAL = 9;
  const num = (v) => Math.max(0, +v || 0);

  /* ---- styles ---- */
  // Fond transparent : laisse apparaître le shader animé (fixed, derrière).
  const wrap   = { position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", padding: 20 };
  // Carte légèrement translucide + flou : le fond animé respire derrière.
  const card   = { width: "100%", maxWidth: 540, background: "rgba(22,27,46,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${T.border}`, borderRadius: 24, padding: "32px 36px", maxHeight: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)" };
  const input  = { width: "100%", padding: "13px 15px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 16, outline: "none", boxSizing: "border-box" };
  const lbl    = { fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 8, display: "block" };
  const h2     = { color: T.text, fontWeight: 700, fontSize: 26, lineHeight: 1.2, margin: "0 0 8px", fontFamily: "'Lora', Georgia, serif" };
  const sub    = { color: T.muted, fontSize: 14, margin: "0 0 28px", lineHeight: 1.5 };

  /* ---- navigation ---- */
  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  // Sélection : on enregistre le choix, l'utilisateur valide avec "Continuer".
  const pick = (setter, val) => setter(val);

  const canContinue = () => {
    switch (step) {
      case 0: return prenom.trim().length > 0;
      case 1: return +age >= 16 && +age <= 100;
      case 2: return !!country;
      case 3: return !!knowledge;
      case 4: return !!goal;
      case 5: return !!bracket;
      default: return true; // étapes financières : optionnelles
    }
  };

  const finish = () => {
    const pending = {
      firstName: prenom.trim(),
      age: Math.min(100, Math.max(16, +age || 30)),
      country,
      knowledge,
      goal,
      wealthBracket: bracket,
      revenus: num(revenus),
      loyer: num(loyer),
      epargne: num(epargne),
      epargneTotale: num(epargneTotale),
      immo: num(immo),
      repart: Object.fromEntries(ENVELOPES.map((e) => [e.id, repart[e.id].on ? num(repart[e.id].val) : 0])),
    };
    try { localStorage.setItem("wt_onboarding_pending", JSON.stringify(pending)); } catch { /* quota */ }
    onComplete?.();
  };

  const proj20 = useMemo(() => Math.round(fvMonthly(num(epargne), RATE_A, 20)), [epargne]);

  /* ---- pays filtrés ---- */
  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [countryQuery]);

  /* ---- carte sélectionnable ---- */
  const SelectCard = ({ active, icon: Icon, label, sublabel, flag, onClick, compact }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: compact ? "14px 16px" : "16px 18px", borderRadius: 14,
        border: `1px solid ${active ? T.blue : T.border}`,
        background: active ? `${T.blue}14` : T.bg,
        color: T.text, cursor: "pointer", textAlign: "left",
        transition: "border-color .18s, background .18s",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = `${T.muted}66`; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = T.border; }}
    >
      {flag && (
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{flag}</span>
      )}
      {Icon && (
        <span style={{ width: 40, height: 40, borderRadius: 12, background: active ? `${T.blue}22` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} style={{ color: active ? T.blue : T.muted }} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: active ? T.blue : T.text }}>{label}</span>
        {sublabel && <span style={{ display: "block", fontSize: 12.5, color: T.muted, marginTop: 2 }}>{sublabel}</span>}
      </span>
      {active && !flag && <Check size={18} style={{ color: T.blue, flexShrink: 0 }} />}
    </button>
  );

  /* ---- contenu par étape (fonction inline : pas de remount → focus conservé) ---- */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <h2 style={h2}>Quel est votre prénom ?</h2>
            <p style={sub}>On commence par faire connaissance.</p>
            <label style={lbl}>Votre prénom</label>
            <input autoFocus value={prenom} placeholder=""
              onChange={(e) => setPrenom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next(); }}
              style={input} />
          </>
        );
      case 1:
        return (
          <>
            <h2 style={h2}>Enchanté {prenom || "👋"}, quel est votre âge ?</h2>
            <p style={sub}>Pour situer votre horizon d'investissement.</p>
            <label style={lbl}>Votre âge</label>
            <input autoFocus type="number" inputMode="numeric" min={16} max={100} value={age} placeholder=""
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next(); }}
              style={input} />
          </>
        );
      case 2:
        return (
          <>
            <h2 style={h2}>Où habitez-vous ?</h2>
            <p style={sub}>Cela nous permet de personnaliser votre fiscalité.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bg, marginBottom: 14 }}>
              <Search size={16} style={{ color: T.muted, flexShrink: 0 }} />
              <input autoFocus value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Rechercher un pays…"
                style={{ flex: 1, border: "none", background: "transparent", color: T.text, outline: "none", fontSize: 15 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 4 }}>
              {filteredCountries.map((c) => (
                <SelectCard key={c.code} compact flag={c.flag} label={c.name}
                  active={country === c.code}
                  onClick={() => pick(setCountry, c.code)} />
              ))}
              {filteredCountries.length === 0 && (
                <p style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Aucun pays trouvé.</p>
              )}
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h2 style={h2}>Vos connaissances en investissement ?</h2>
            <p style={sub}>On adapte l'accompagnement à votre niveau.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {KNOWLEDGE.map((k) => (
                <SelectCard key={k.id} icon={k.icon} label={k.label} sublabel={k.sub}
                  active={knowledge === k.id} onClick={() => pick(setKnowledge, k.id)} />
              ))}
            </div>
          </>
        );
      case 4:
        return (
          <>
            <h2 style={h2}>Que recherchez-vous chez WealthTrack ?</h2>
            <p style={sub}>Votre priorité oriente votre tableau de bord.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {GOALS.map((g) => (
                <SelectCard key={g.id} icon={g.icon} label={g.label} sublabel={g.sub}
                  active={goal === g.id} onClick={() => pick(setGoal, g.id)} />
              ))}
            </div>
          </>
        );
      case 5:
        return (
          <>
            <h2 style={h2}>Où en êtes-vous au niveau de votre patrimoine ?</h2>
            <p style={sub}>Une estimation suffit, vous ajusterez ensuite.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {BRACKETS.map((b) => (
                <SelectCard key={b.id} label={b.label}
                  active={bracket === b.id} onClick={() => pick(setBracket, b.id)} />
              ))}
            </div>
          </>
        );
      case 6:
        return (
          <>
            <h2 style={h2}>Vos revenus & charges</h2>
            <p style={sub}>Ces données restent sur votre appareil.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={lbl}>Revenus mensuels nets (€)</label>
                <input autoFocus type="number" inputMode="numeric" min={0} value={revenus} placeholder="3 000"
                  onChange={(e) => setRevenus(e.target.value)} style={input} />
              </div>
              <div>
                <label style={lbl}>Loyer / Mensualité de crédit (€/mois)</label>
                <input type="number" inputMode="numeric" min={0} value={loyer} placeholder="800"
                  onChange={(e) => setLoyer(e.target.value)} style={input} />
              </div>
            </div>
          </>
        );
      case 7:
        return (
          <>
            <h2 style={h2}>Votre épargne & patrimoine</h2>
            <p style={sub}>Pour estimer votre potentiel à long terme.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={lbl}>Épargne / investissement mensuel (€)</label>
                <input autoFocus type="number" inputMode="numeric" min={0} value={epargne} placeholder="300"
                  onChange={(e) => setEpargne(e.target.value)} style={input} />
              </div>
              <div>
                <label style={lbl}>Épargne totale déjà constituée (€)</label>
                <input type="number" inputMode="numeric" min={0} value={epargneTotale} placeholder="0"
                  onChange={(e) => setEpargneTotale(e.target.value)} style={input} />
              </div>
              <div>
                <label style={lbl}>Patrimoine immobilier (€)</label>
                <input type="number" inputMode="numeric" min={0} value={immo} placeholder="0"
                  onChange={(e) => setImmo(e.target.value)} style={input} />
              </div>
              {num(epargne) > 0 && (
                <div style={{ padding: "16px 18px", borderRadius: 14, background: `${T.blue}0d`, border: `1px solid ${T.blue}22` }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Votre potentiel à 20 ans (ETF {(RATE_A * 100).toFixed(1)} %/an)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: T.blue }}>{eur(proj20)}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <AlertTriangle size={11} style={{ color: T.amber, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                    <span>{RATE_DISCLAIMER}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      case 8:
        return (
          <>
            <h2 style={h2}>Répartition de votre épargne</h2>
            <p style={sub}>Cochez vos enveloppes et indiquez les montants détenus.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ENVELOPES.map((env) => {
                const r = repart[env.id];
                return (
                  <div key={env.id}>
                    <button onClick={() => setRepart((p) => ({ ...p, [env.id]: { ...p[env.id], on: !p[env.id].on } }))}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 12, border: `1px solid ${r.on ? T.blue : T.border}`, background: r.on ? `${T.blue}14` : T.bg, color: T.text, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${r.on ? T.blue : T.muted}`, background: r.on ? T.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {r.on && <Check size={13} color="#fff" />}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{env.label}</span>
                    </button>
                    {r.on && (
                      <input type="number" inputMode="numeric" min={0} value={r.val} placeholder="Montant (€)"
                        onChange={(e) => setRepart((p) => ({ ...p, [env.id]: { ...p[env.id], val: e.target.value } }))}
                        style={{ ...input, marginTop: 8 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const isLast = step === TOTAL - 1;

  return (
    <div style={wrap}>
      <Suspense fallback={null}><PaperShaderBackground /></Suspense>
      <div style={card}>
        {/* En-tête : titre + progression */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted }}>
              {step + 1} sur {TOTAL} · Profil investisseur
            </span>
            {onLogin && (
              <button onClick={onLogin} style={{ fontSize: 12, color: T.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Se connecter
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} style={{ height: 4, flex: 1, borderRadius: 4, background: i <= step ? T.blue : "rgba(255,255,255,0.08)", transition: "background .3s" }} />
            ))}
          </div>
        </div>

        {/* Question (fade-in à chaque changement d'étape) */}
        <div key={step} className="wt-fade-in" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {renderStep()}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, gap: 12 }}>
          {step > 0 ? (
            <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 18px", borderRadius: 12, border: `1px solid ${T.border}`, background: "none", color: T.muted, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              <ArrowLeft size={16} /> Retour
            </button>
          ) : <div />}

          {isLast ? (
            <button onClick={finish}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", borderRadius: 12, border: "none", background: T.blue, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              Créer mon compte <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={next} disabled={!canContinue()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", borderRadius: 12, border: "none", background: canContinue() ? T.blue : `${T.blue}55`, color: "#fff", cursor: canContinue() ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 14, transition: "background .18s" }}>
              Continuer <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
