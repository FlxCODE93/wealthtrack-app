import React, { useState, useEffect, useRef } from "react";
import { C, glow } from "./theme.js";
import "./animations.css";
import { useScrollReveal } from "./hooks/useScrollReveal.js";
import AnoAI from "./AnoAI.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import {
  BarChart3, TrendingUp, Shield, Zap, Wallet, Home, Users, Target,
  Building2, ChevronDown, ArrowRight,
  Star, Database, EyeOff,
  ShieldCheck, Award, Briefcase, UserCheck, PiggyBank, Activity,
  X, Calculator, Flag,
  UserPlus, Link2, Sparkles, Search,
  LayoutDashboard, Bitcoin, MessageCircle,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { ScrollProgressBar } from "./lib/motion.jsx";

/* ── Constantes de contenu ─────────────────────────────────────── */

const HERO_SERIES = [
  { m: "J", value: 238000 },
  { m: "F", value: 241000 },
  { m: "M", value: 245000 },
  { m: "A", value: 249000 },
  { m: "M", value: 253000 },
  { m: "J", value: 258000 },
  { m: "J", value: 261000 },
  { m: "A", value: 266000 },
  { m: "S", value: 271000 },
  { m: "O", value: 275000 },
  { m: "N", value: 279000 },
  { m: "D", value: 284500 },
];

const HERO_ALLOC = [
  { name: "ETF / Actions", value: 45, color: C.blue },
  { name: "Immobilier", value: 30, color: C.amber },
  { name: "Épargne", value: 18, color: C.green },
  { name: "Crypto", value: 7, color: "#8b5cf6" },
];

const SIDEBAR_PREVIEW_ITEMS = [
  { label: "Tableau de bord", icon: LayoutDashboard, active: true },
  { label: "Patrimoine", icon: Wallet },
  { label: "Simulations", icon: TrendingUp },
  { label: "FIRE", icon: Flag },
  { label: "Crypto", icon: Bitcoin },
  { label: "Immobilier", icon: Building2 },
  { label: "Fiscalité", icon: Calculator },
  { label: "Assistant", icon: MessageCircle },
];

const PERSONAS = [
  {
    icon: PiggyBank,
    title: "Étudiant & jeune actif",
    desc: "Même avec 50 € par mois, les intérêts composés font la différence. Visualisez ce que votre épargne aujourd'hui vaut dans 20 ans.",
  },
  {
    icon: Briefcase,
    title: "Salarié CDI",
    desc: "Optimisez votre PEA, comparez vos scénarios d'épargne et visualisez l'impact réel sur votre trajectoire long terme.",
  },
  {
    icon: UserCheck,
    title: "Indépendant & freelance",
    desc: "Maîtrisez votre fiscalité, arbitrez entre PEA et assurance-vie, planifiez votre retraite sans attendre.",
  },
  {
    icon: Activity,
    title: "Revenus irréguliers",
    desc: "Calculez votre épargne réelle mois par mois, anticipez les creux et construisez un filet de sécurité.",
  },
];

const FEATURES = [
  {
    icon: Wallet, color: C.blue,
    title: "Agrégation bancaire",
    desc: "Connectez vos comptes via Plaid (5 000+ établissements français et européens) ou importez un relevé CSV — synchronisation automatique.",
    stat: "Temps réel",
  },
  {
    icon: BarChart3, color: C.green,
    title: "Vue d'ensemble du patrimoine",
    desc: "Actifs, passifs, historique complet sur un tableau de bord unique. Votre situation nette, son évolution et sa répartition.",
    stat: "Mise à jour auto",
  },
  {
    icon: TrendingUp, color: C.blue,
    title: "Fiscalité nette en France",
    desc: "Visualisez votre capital net après impôts — PFU 30%, PEA 0% après 5 ans, assurance-vie. Pas les gains bruts.",
    stat: "+60 k€ en moyenne",
  },
  {
    icon: Home, color: C.amber,
    title: "Immobilier complet",
    desc: "Crédit, loyers, frais de notaire, equity — simulez un bien et comparez achat vs location sur 20 ans.",
    stat: "Simulation 30s",
  },
  {
    icon: Users, color: C.green,
    title: "Mode couple natif",
    desc: "Deux patrimoines fusionnés, un objectif commun. Mesurez l'impact de chaque décision sur votre trajectoire commune.",
    stat: "+3 ans cible",
  },
  {
    icon: Zap, color: C.blue,
    title: "Simulations sur 30 ans",
    desc: "ETF MSCI World, immobilier locatif, épargne défensive — avec intérêts composés, inflation et timeline année par année.",
    stat: "3 scénarios temps réel",
  },
  {
    icon: Building2, color: C.cyan,
    title: "Patrimoine : répartition et projection",
    desc: "Liquidités, ETF, immobilier, crypto : visualisez la composition et projetez l'évolution à 10 et 20 ans.",
    stat: "Projection 10-20 ans",
  },
  {
    icon: Calculator, color: C.blue,
    title: "Simulez chaque décision",
    desc: "Modifiez un paramètre (épargne, allocation, achat...) et observez l'impact immédiat sur votre trajectoire.",
    stat: "Recalcul temps réel",
  },
  {
    icon: Flag, color: C.green,
    title: "Indépendance financière (FIRE)",
    desc: "Calculez votre date d'IF à partir de votre taux d'épargne réel et la règle des 4% avec 3 scénarios: pessimiste, base, optimiste.",
    stat: "Date + 3 scénarios",
  },
];

const TESTIMONIALS = [
  {
    initials: "MD",
    name: "Marie D.",
    role: "38 ans · Cadre, CDI",
    text: "Je suivais mon patrimoine sans comprendre ma stratégie. WealthTrack m'a montré que le PEA m'économiserait 60 k€ sur 20 ans. Une clarté que je n'avais pas trouvée ailleurs.",
  },
  {
    initials: "LS",
    name: "Lucas & Sarah",
    role: "26 et 29 ans · En couple",
    text: "Des finances séparées créaient des frictions constantes. Le mode couple a tout simplifié : un seul tableau de bord, un objectif commun. Nous atteindrons notre cible en 10 ans au lieu de 13.",
  },
  {
    initials: "SL",
    name: "Sophie L.",
    role: "35 ans · Consultante indépendante",
    text: "La fiscalité était mon angle mort en tant qu'indépendante. Je sais maintenant exactement combien provisionner chaque mois. Les décisions sont devenues méthodiques.",
  },
];

const STEPS = [
  {
    icon: UserPlus, color: C.blue,
    title: "Créez votre compte",
    desc: "Inscription gratuite en quelques secondes, sans carte bancaire.\nVos données restent locales sur votre appareil par défaut.",
  },
  {
    icon: Link2, color: C.green,
    title: "Synchronisez vos comptes — ou non",
    desc: (
      <>
        Connectez vos banques et établissements de manière sécurisée via Plaid<InlineLogo domain="plaid.com" alt="Plaid" />, ou renseignez votre patrimoine manuellement.
      </>
    ),
  },
  {
    icon: Sparkles, color: "#8b5cf6",
    title: "Analysez et optimisez",
    desc: "Suivez votre profil et vos investissements, puis lancez les simulations (fiscalité, immobilier, FIRE) pour obtenir un plan d'action chiffré.",
  },
];

const FAQS = [
  {
    q: "WealthTrack constitue-t-il un conseil en investissement ?",
    a: "Non. WealthTrack est un outil d'aide à la décision à caractère pédagogique. Les simulations sont fournies à titre illustratif. Pour un conseil personnalisé, nous recommandons de consulter un conseiller en gestion de patrimoine (CGP) ou un conseiller en investissements financiers (CIF) agréé par l'ORIAS.",
  },
  {
    q: "Mes données financières sont-elles sécurisées ?",
    a: "Oui. Par défaut, l'intégralité de vos données est stockée en local sur votre appareil (localStorage du navigateur) et aucune donnée patrimoniale n'est transmise à nos serveurs. Une éventuelle synchronisation cloud resterait optionnelle et chiffrée. Si vous connectez une banque via Plaid, seul un token sécurisé est utilisé — jamais vos identifiants. L'accès est strictement en lecture seule : nous ne stockons pas vos identifiants bancaires et n'effectuons aucune transaction sur vos comptes.",
  },
  {
    q: "Puis-je exporter ou supprimer mes données ?",
    a: "À tout moment. Export en Excel, CSV, PDF ou JSON en un clic. Tant que vos données restent locales, il suffit de vider le localStorage de votre navigateur pour une suppression complète, sans résidu côté serveur.",
  },
  {
    q: "Quelles banques sont prises en charge ?",
    a: "Plaid supporte plus de 5 000 établissements français et européens : BNP Paribas, Société Générale, Crédit Agricole, Boursorama, Revolut, Fortuneo et bien d'autres. L'import CSV manuel est toujours disponible gratuitement.",
  },
  {
    q: "Comment fonctionne le mode couple ?",
    a: "Chaque partenaire dispose de son profil. En mode couple, les deux patrimoines sont fusionnés dans un tableau de bord commun. Vous définissez un objectif partagé et visualisez l'impact de chaque décision sur votre trajectoire commune. Aucune application tierce requise.",
  },
];

const LEGAL_CONTENT = {
  mentions: {
    title: "Mentions légales",
    sections: [
      {
        heading: "Éditeur du site",
        body: [
          "WealthTrack est édité par [Raison sociale à compléter], [forme juridique — SASU / auto-entrepreneur à compléter].",
          "Siège social : [adresse à compléter]",
          "SIRET : [à compléter]",
          "Directeur de la publication : [nom à compléter]",
          "Contact : felix.messer38@gmail.com",
        ],
      },
      {
        heading: "Hébergement",
        body: ["Le site est hébergé par [hébergeur à compléter], [adresse de l'hébergeur à compléter]."],
      },
      {
        heading: "Propriété intellectuelle",
        body: ["L'ensemble des éléments du site (textes, graphismes, logo, code source) est la propriété de WealthTrack ou de ses partenaires et protégé par le droit de la propriété intellectuelle. Toute reproduction est interdite sans autorisation préalable."],
      },
      {
        heading: "Statut réglementaire",
        body: ["WealthTrack n'est pas un prestataire de services d'investissement (PSI) et n'est pas immatriculé à l'ORIAS. Le site propose un outil de simulation à caractère pédagogique, qui ne constitue ni un conseil en investissement, ni une recommandation personnalisée au sens des articles L. 321-1 et suivants du Code monétaire et financier."],
      },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    sections: [
      {
        heading: "Quelles données collectons-nous ?",
        body: [
          "Par défaut, WealthTrack fonctionne intégralement dans votre navigateur : vos données patrimoniales (revenus, transactions, objectifs, simulations) sont stockées localement (localStorage) et ne sont pas transmises à nos serveurs. Si une fonctionnalité de compte avec synchronisation cloud est proposée à l'avenir, elle sera optionnelle, clairement annoncée, et cette politique sera mise à jour en conséquence.",
          "Si vous activez la connexion bancaire (Plaid, fonctionnalité Premium), seul un jeton d'accès sécurisé est échangé — vos identifiants bancaires ne transitent jamais par WealthTrack.",
        ],
      },
      {
        heading: "Pourquoi et comment ?",
        body: ["Les données stockées localement servent uniquement au fonctionnement du service (calculs, simulations, affichage de votre tableau de bord). Elles restent sur votre appareil jusqu'à suppression par vos soins, sauf si vous activez explicitement une synchronisation cloud."],
      },
      {
        heading: "Vos droits (RGPD)",
        body: ["Pour toute donnée éventuellement détenue par nos services (ex. e-mail de contact), vous disposez des droits suivants, exerçables à tout moment par e-mail à felix.messer38@gmail.com :"],
        list: [
          "Droit d'accès et de rectification",
          "Droit à l'effacement",
          "Droit à la portabilité",
          "Droit d'opposition",
          "Droit d'introduire une réclamation auprès de la CNIL (cnil.fr)",
        ],
      },
      {
        heading: "Sécurité",
        body: ["Par défaut, aucune donnée financière n'est envoyée à un serveur tiers. Les éventuels appels à des services externes (cours de marché, rendements DeFi) sont anonymes et ne contiennent aucune information personnelle."],
      },
    ],
  },
  cookies: {
    title: "Politique de cookies",
    sections: [
      {
        heading: "Notre position",
        body: ["WealthTrack n'utilise aucun cookie publicitaire, aucun cookie de tracking et aucun outil d'analyse comportementale (type Google Analytics)."],
      },
      {
        heading: "Le localStorage, ce n'est pas un cookie",
        body: ["Vos données (profil, transactions, objectifs) sont stockées via le localStorage de votre navigateur — une technologie distincte des cookies, qui reste sur votre appareil par défaut et n'est transmise à un serveur que si vous activez explicitement une synchronisation."],
      },
      {
        heading: "Cookies strictement nécessaires",
        body: ["Si vous activez la connexion bancaire (Plaid), un cookie de session technique peut être utilisé pour sécuriser l'échange. Ce type de cookie ne nécessite pas de consentement préalable au regard de la réglementation (art. 82 de la loi Informatique et Libertés)."],
      },
      {
        heading: "Gérer ou supprimer vos données locales",
        body: ["Vous pouvez à tout moment vider le localStorage de votre navigateur (Paramètres → Confidentialité → Effacer les données de navigation) pour supprimer toutes les données WealthTrack stockées sur votre appareil."],
      },
    ],
  },
  cgu: {
    title: "Conditions Générales d'Utilisation",
    sections: [
      {
        heading: "Objet",
        body: ["Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation de WealthTrack, un outil de simulation et de suivi patrimonial."],
      },
      {
        heading: "Description du service",
        body: [
          "WealthTrack met à disposition des outils de simulation financière (projections, fiscalité, immobilier, retraite) à titre informatif et pédagogique. Les résultats affichés reposent sur des hypothèses et des taux historiques qui ne préjugent pas des performances futures.",
          "WealthTrack ne fournit ni conseil en investissement, ni recommandation personnalisée, ni service de gestion de portefeuille.",
        ],
      },
      {
        heading: "Avertissement sur les risques",
        body: ["Investir comporte des risques notamment de perte en capital, et de volatilité. Les performances passées n'indiquent pas des performances futures. Simulations à des fins d'illustration seulement."],
      },
      {
        heading: "Accès au service et comptes",
        body: ["L'accès aux fonctionnalités de base ne nécessite aucune création de compte. Les fonctionnalités Premium et Pro peuvent nécessiter un abonnement payant, résiliable à tout moment."],
      },
      {
        heading: "Responsabilité",
        body: ["L'utilisateur reste seul responsable des décisions financières prises sur la base des simulations fournies. WealthTrack ne saurait être tenu responsable d'une perte financière résultant de l'utilisation du service."],
      },
      {
        heading: "Propriété intellectuelle",
        body: ["Le code, les visuels et les contenus du service restent la propriété exclusive de WealthTrack."],
      },
      {
        heading: "Droit applicable",
        body: ["Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence des tribunaux français."],
      },
      {
        heading: "Modification des CGU",
        body: ["WealthTrack se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des modifications substantielles."],
      },
    ],
  },
  support: {
    title: "Support",
    sections: [
      {
        heading: "Nous contacter",
        body: ["Une question, un bug, une suggestion ? Écrivez-nous à felix.messer38@gmail.com — nous répondons habituellement sous 48h ouvrées."],
      },
      {
        heading: "Avant de nous écrire",
        body: ["Consultez la section « Questions fréquentes » de cette page : elle répond aux questions les plus courantes sur la sécurité des données, les banques compatibles et le mode couple."],
      },
      {
        heading: "Assistance Premium & Pro",
        body: ["Les utilisateurs Pro bénéficient d'un support dédié avec un temps de réponse prioritaire (sous 24h ouvrées)."],
      },
    ],
  },
};

/* ── Sous-composants footer ────────────────────────────────────── */

function FooterLink({ href, onClick, children }) {
  if (onClick) {
    return (
      <button onClick={onClick} className="text-sm block text-left transition-colors"
        style={{ color: C.muted }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className="text-sm block transition-colors"
      style={{ color: C.muted }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}>
      {children}
    </a>
  );
}

/* ── Hero Background — Mesh Gradient Bleu ────────────────────────── */

function HeroBackground() {
  return (
    <div className="absolute inset-x-0 top-0" aria-hidden="true" style={{
      height: 600,
      overflow: "hidden",
      zIndex: 0,
      pointerEvents: "none",
      background: `
        radial-gradient(ellipse 800px 500px at 20% 10%, ${C.blue}25, transparent 50%),
        radial-gradient(ellipse 600px 400px at 80% 30%, ${C.blue}15, transparent 55%),
        linear-gradient(to bottom, ${C.bgGradient}, transparent)
      `,
      maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
    }} />
  );
}

/* ── Mockup téléphone (à côté du tableau de bord, façon Finary) ──── */

function PhoneMockup() {
  return (
    <div className="hidden lg:block absolute" style={{ bottom: -56, right: -28, width: 200, zIndex: 10 }}>
      <div className="rounded-[28px] p-1.5" style={{ background: "#0b1220", border: `1px solid ${C.border}`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.7)" }}>
        <div className="rounded-[22px] overflow-hidden" style={{ background: C.panel }}>
          {/* Encoche */}
          <div className="flex justify-center pt-2.5 pb-1.5">
            <div className="w-14 h-3.5 rounded-full" style={{ background: "#0b1220" }} />
          </div>
          <div className="px-4 pb-4">
            <div className="text-[10px] mb-1" style={{ color: C.muted }}>Patrimoine net</div>
            <div className="text-xl font-black mb-1" style={{ color: C.text }}>284 500 €</div>
            <div className="flex items-center gap-1 text-[10px] font-semibold mb-2" style={{ color: C.green }}>
              <TrendingUp size={10} /> +12,4 %
            </div>
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={HERO_SERIES} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={C.blue} strokeWidth={2} fill="url(#phoneGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 mt-3">
              {[
                { label: "Épargne mensuelle", value: "+850 €", color: C.green },
                { label: "Progression FIRE", value: "67 %", color: C.blue },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between  px-3 py-2" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <span className="text-[10px]" style={{ color: C.muted }}>{s.label}</span>
                  <span className="text-xs font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mockup téléphone (étape "Synchroniser mes comptes") ─────────── */

function BankLogo({ name, domain, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!err) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={name}
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
      background: `${C.blue}22`, border: `1px solid ${C.blue}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800, color: C.blue,
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Petit logo inline (texte courant) avec fallback discret ────── */

function InlineLogo({ domain, alt, size = 16 }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "-3px", borderRadius: 4, margin: "0 3px" }}
      onError={() => setErr(true)}
    />
  );
}

function SyncPhoneMockup() {
  const banks = [
    { name: "BNP Paribas",       domain: "bnpparibas.fr" },
    { name: "Société Générale",  domain: "particuliers.societegenerale.fr" },
    { name: "Crédit Agricole",   domain: "credit-agricole.fr" },
    { name: "Fortuneo",          domain: "fortuneo.fr" },
    { name: "Trade Republic",    domain: "traderepublic.com" },
    { name: "Boursorama",        domain: "boursorama.com" },
  ];
  return (
    <div className="rounded-[28px] p-1.5" style={{ background: "#0b1220", border: `1px solid ${C.border}`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.7)", width: 220 }}>
      <div className="rounded-[22px] overflow-hidden" style={{ background: C.panel }}>
        {/* Encoche */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-14 h-3.5 rounded-full" style={{ background: "#0b1220" }} />
        </div>
        <div className="px-4 pb-4">
          <div className="text-xs font-bold mb-3" style={{ color: C.text }}>Synchroniser mes comptes :</div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <Search size={12} style={{ color: C.muted }} />
            <span className="text-[11px]" style={{ color: C.muted }}>Trouvez un établissement</span>
          </div>
          <div className="flex flex-col gap-2">
            {banks.map((b) => (
              <div key={b.name} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <BankLogo name={b.name} domain={b.domain} />
                <span className="text-[11px] font-medium flex-1" style={{ color: C.text }}>{b.name}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: C.green }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Révélation au scroll ───────────────────────────────────────── */
/* Déclenche le stagger d'entrée d'une grille une seule fois, quand elle entre dans le viewport. */
function Reveal({ children }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return children(ref, inView);
}

function LegalModal({ id, onClose }) {
  const content = LEGAL_CONTENT[id];

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 wt-fade-in"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8 wt-scale-in wt-glass"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={content.title}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black" style={{ color: C.text }}>{content.title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 transition-colors"
            style={{ color: C.muted, background: "rgba(255,255,255,0.03)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-5">
          {content.sections.map((s, i) => (
            <div key={i}>
              <h3 className="text-sm font-bold mb-2" style={{ color: C.text }}>{s.heading}</h3>
              {s.body.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed mb-1.5" style={{ color: C.muted }}>{p}</p>
              ))}
              {s.list && (
                <ul className="space-y-1 mt-1">
                  {s.list.map((l, j) => (
                    <li key={j} className="text-sm leading-relaxed flex items-start gap-2" style={{ color: C.muted }}>
                      <span style={{ color: C.blue }}>•</span> {l}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PourquoiModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 wt-fade-in"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8 wt-scale-in wt-glass"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Pourquoi WealthTrack ?">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black" style={{ color: C.text }}>Pourquoi WealthTrack ?</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 transition-colors"
            style={{ color: C.muted, background: "rgba(255,255,255,0.03)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}>
            <X size={16} />
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: C.muted }}>L'histoire derrière l'outil — racontée par celui qui l'utilise tous les jours.</p>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-3 md:w-48 shrink-0">
            <div className="rounded-2xl w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-xl md:text-2xl font-black shrink-0"
              style={{ background: `linear-gradient(135deg, ${C.blue}, #8b5cf6)`, color: "#fff" }}>
              FM
            </div>
            <div>
              <div className="font-bold" style={{ color: C.text }}>Félix</div>
              <div className="text-xs mb-2" style={{ color: C.muted }}>Étudiant · Fondateur de WealthTrack</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: `${C.green}18`, color: C.green }}>
                <Flag size={12} /> Objectif personnel : FIRE
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 text-sm leading-relaxed" style={{ color: C.muted }}>
            <p>
              <span style={{ color: C.text, fontWeight: 600 }}>Je m'appelle Félix, je suis étudiant</span> — et comme beaucoup, j'ai découvert le mouvement FIRE (<em>Financial Independence, Retire Early</em>) un peu par hasard. Depuis, une obsession : savoir exactement où en est mon patrimoine, et combien de temps il me reste avant de pouvoir en vivre.
            </p>
            <p>
              Le problème, c'est qu'aucun outil ne correspondait vraiment à ma situation. Les tableurs Excel deviennent vite ingérables, les applications bancaires n'affichent que des soldes bruts, et les simulateurs « pro » sont pensés pour des patrimoines bien plus confortables que celui d'un étudiant qui démarre avec 50 € par mois.
            </p>
            <p>
              J'ai donc construit WealthTrack pour moi-même : un outil qui calcule ma fiscalité réelle (PEA, CTO, assurance-vie), qui projette mes 30 prochaines années sans enjoliver les rendements, et qui me dit concrètement quoi faire ensuite — pas juste « épargnez plus ».
            </p>
            <p style={{ color: C.text, fontWeight: 600 }}>
              Mon objectif est simple : atteindre l'indépendance financière le plus vite possible, avec méthode plutôt qu'avec espoir. Si vous visez la même chose, j'espère que WealthTrack vous fera gagner autant de temps qu'il m'en fait gagner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Composant principal ───────────────────────────────────────── */

export default function Landing({ onStart }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [legalModal, setLegalModal] = useState(null);
  const [showPourquoi, setShowPourquoi] = useState(false);

  const btn = {
    primary: {
      background: C.gradientPrimary,
      color: "#fff",
      boxShadow: glow(C.violet, 40, "33"),
    },
    ghost: {
      border: `1px solid ${C.border}`,
      color: C.muted,
      background: "transparent",
    },
  };

  /* Feedback au survol des CTA — réagissent immédiatement au pointeur */
  const primaryHover = {
    onMouseEnter: (e) => {
      e.currentTarget.style.transform = "translateY(-1px) scale(1.015)";
      e.currentTarget.style.boxShadow = glow(C.violet, 56, "55");
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.transform = "";
      e.currentTarget.style.boxShadow = glow(C.violet, 40, "33");
    },
  };
  const ghostHover = {
    onMouseEnter: (e) => {
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
      e.currentTarget.style.color = C.text;
      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.borderColor = C.border;
      e.currentTarget.style.color = C.muted;
      e.currentTarget.style.background = "transparent";
    },
  };

  return (
    <div style={{ color: C.text, fontFamily: "'Geist Sans', 'Inter', -apple-system, 'Segoe UI', sans-serif", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <AnoAI />

      <div className="relative z-10">
        <ScrollProgressBar />

        <HeroBackground />

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-16 py-4"
        style={{ background: "transparent", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2" style={{ background: C.blue }}>
            <BarChart3 size={18} color="#fff" />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: C.text, fontFamily: "'Lora', Georgia, serif" }}>WealthTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onStart} className="hidden sm:block text-sm px-4 py-2 rounded-xl transition-colors"
            style={{ color: C.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}>
            Se connecter
          </button>
          <ThemeToggle />
          <button onClick={onStart} className="text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={btn.primary} {...primaryHover}>
            Accès gratuit
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative text-center px-6 md:px-16 pt-24 pb-16 max-w-4xl mx-auto wt-stagger">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 wt-slide-up wt-hero-enter"
          style={{ background: `${C.blue}18`, border: `1px solid ${C.blue}44`, color: C.blue }}>
          <Shield size={12} /> Outil de simulation patrimoniale · Non conseil en investissement (AMF)
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-none tracking-tight wt-slide-up wt-hero-enter" style={{ color: C.text }}>
          Simulez.{" "}
          <span style={{ background: `linear-gradient(135deg, ${C.blue}, #60a5fa)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Comprenez.
          </span>
          <br /><span style={{ color: C.blue }}>Décidez.</span>
        </h1>
        <p className="text-lg md:text-xl mb-4 max-w-2xl mx-auto leading-relaxed wt-slide-up wt-hero-enter" style={{ color: C.muted }}>
          WealthTrack vous permet de{" "}
          <span style={{ color: C.text, fontWeight: 600 }}>comprendre vos finances en profondeur</span>{" "}
          et d'agir avec méthode. Un outil de simulation, pas un agrégateur passif.
        </p>
        <p className="text-sm mb-10 wt-slide-up" style={{ color: "#475569" }}>
          Fiscalité nette · Immobilier · Mode couple · Simulations 30 ans · Plans d'action chiffrés
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 wt-slide-up">
          <button onClick={onStart}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold wt-button-press"
            style={btn.primary} {...primaryHover}>
            Démarrer gratuitement <ArrowRight size={18} />
          </button>
          <button onClick={onStart} className="px-8 py-4 rounded-2xl text-base font-medium transition-colors"
            style={btn.ghost} {...ghostHover}>
            Voir la démonstration
          </button>
        </div>
        <p className="text-xs wt-slide-up" style={{ color: "#475569" }}>
          Accès immédiat · Données locales par défaut · RGPD compliant
        </p>
      </section>

      {/* ── DASHBOARD PREVIEW ── */}
      <div className="relative px-6 md:px-16 mb-24 lg:mb-32 max-w-5xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden"
          style={{ border: `1px solid ${C.border}`, background: C.panel, boxShadow: "0 30px 80px -30px rgba(0,0,0,0.6)" }}>

          {/* Halos lumineux animés */}
          <div className="absolute pointer-events-none rounded-full"
            style={{ width: 320, height: 320, top: -120, left: -100, background: C.blue, opacity: 0.18, filter: "blur(90px)", animation: "wt-blob 14s ease-in-out infinite" }} />
          <div className="absolute pointer-events-none rounded-full"
            style={{ width: 280, height: 280, bottom: -120, right: -80, background: C.green, opacity: 0.16, filter: "blur(90px)", animation: "wt-blob 16s ease-in-out infinite", animationDelay: "-6s" }} />

          {/* Barre de fenêtre */}
          <div className="relative flex items-center gap-2 px-5 py-3"
            style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f5a623" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#27a37a" }} />
            <span className="ml-3 text-xs" style={{ color: C.muted }}>wealthtrack.app · Tableau de bord</span>
          </div>

          {/* Contenu */}
          <div className="relative flex">
            {/* Sidebar miniature — fonctionnalités réelles de l'app */}
            <div className="hidden md:flex flex-col gap-1 p-3 shrink-0" style={{ width: 176, borderRight: `1px solid ${C.border}` }}>
              {SIDEBAR_PREVIEW_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <div key={it.label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{
                      background: it.active ? C.gradientPrimary : "transparent",
                      color: it.active ? "#fff" : C.muted,
                      boxShadow: it.active ? glow(C.violet, 18, "33") : "none",
                    }}>
                    <Icon size={14} />
                    {it.label}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 p-5 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Patrimoine + courbe */}
            <div className="md:col-span-2 rounded-2xl p-5 text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-xs mb-1" style={{ color: C.muted }}>Patrimoine net total</div>
              <div className="text-3xl font-black mb-1" style={{ color: C.text }}>284 500 €</div>
              <div className="flex items-center gap-1 text-xs font-semibold mb-2" style={{ color: C.green }}>
                <TrendingUp size={12} /> +12,4 % sur 12 mois
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={HERO_SERIES} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.blue} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke={C.blue} strokeWidth={2} fill="url(#heroGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Répartition */}
            <div className="rounded-2xl p-5 text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-xs mb-2" style={{ color: C.muted }}>Répartition</div>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={HERO_ALLOC} dataKey="value" nameKey="name" innerRadius={30} outerRadius={48} paddingAngle={3} stroke="none">
                    {HERO_ALLOC.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                {HERO_ALLOC.map((a) => (
                  <span key={a.name} className="text-[10px] flex items-center gap-1" style={{ color: C.muted }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} /> {a.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Mini stats — diversified sizing */}
            <div className="md:col-span-1 rounded-2xl p-5 text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-xs mb-2" style={{ color: C.muted }}>Épargne mensuelle</div>
              <div className="text-2xl font-black" style={{ color: C.green }}>+850 €</div>
            </div>
            <div className="rounded-2xl p-4 flex items-center gap-3 text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="rounded-xl p-2 shrink-0" style={{ background: C.blue + "1a" }}>
                <Target size={16} style={{ color: C.blue }} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>67 %</div>
                <div className="text-[10px]" style={{ color: C.muted }}>Progression FIRE</div>
              </div>
            </div>
            <div className="rounded-2xl p-4 flex items-center gap-3 text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="rounded-xl p-2 shrink-0" style={{ background: C.amber + "1a" }}>
                <Home size={16} style={{ color: C.amber }} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.text }}>312 k€</div>
                <div className="text-[10px]" style={{ color: C.muted }}>Capacité d'emprunt</div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Rendu mobile, posé à côté/sur le tableau de bord façon Finary */}
        <PhoneMockup />
      </div>

      {/* ── STATS ── */}
      <div className="px-6 md:px-16 mb-20 max-w-4xl mx-auto">
        <div className="rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-8"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          {[
            ["0",       "utilisateurs actifs"],
            ["0 €",     "patrimoine simulé"],
            ["0",       "satisfaction"],
            ["0 €",     "pour commencer"],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-2xl md:text-3xl font-black mb-2" style={{ color: C.blue }}>{v}</div>
              <div className="text-xs leading-tight" style={{ color: C.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── POUR QUI ── */}
      <section className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: C.text }}>Conçu pour votre situation</h2>
          <p style={{ color: C.muted }}>Chaque profil patrimonial trouve une réponse dans WealthTrack.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${inView ? "wt-stagger" : ""}`}>
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                return (
                  <button key={p.title} onClick={onStart}
                    className={`text-left rounded-2xl p-6 transition-all wt-button-press wt-card-hover wt-card-enter ${inView ? "wt-slide-up" : "opacity-0"}`}
                    style={{ background: C.panel, border: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.blue + "66"; e.currentTarget.style.background = `${C.blue}08`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel; }}>
                    <div className="rounded-xl p-3 w-fit mb-4" style={{ background: `${C.blue}18` }}>
                      <Icon size={20} style={{ color: C.blue }} />
                    </div>
                    <h3 className="text-base font-bold mb-2" style={{ color: C.text }}>{p.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{p.desc}</p>
                  </button>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>

      {/* ── FEATURES ── */}
      <section className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: C.text }}>Des outils qui répondent à de vraies questions</h2>
          <p style={{ color: C.muted }}>Une plateforme complète de simulation patrimoniale — pas de fonctionnalités gadgets, des modules qui traitent des problématiques concrètes.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${inView ? "wt-stagger" : ""}`}>
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className={`p-6 transition-all wt-card-hover wt-card-enter ${inView ? "wt-slide-up" : "opacity-0"}`}
                    style={{ background: C.panel, border: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color + "66"; e.currentTarget.style.background = `${f.color}08`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.panel; }}>
                    <div className="rounded-xl p-3 w-fit mb-4" style={{ background: f.color + "1a" }}>
                      <Icon size={20} style={{ color: f.color }} />
                    </div>
                    <h3 className="font-bold text-base mb-2" style={{ color: C.text }}>{f.title}</h3>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: C.muted }}>{f.desc}</p>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ background: f.color + "1a", color: f.color }}>
                      {f.stat}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>

      {/* ── PASSONS À L'ACTION ── */}
      <section id="comment-ca-marche" className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: C.text }}>Passez à l'action en 3 étapes</h2>
          <p style={{ color: C.muted }}>De l'inscription au plan d'action chiffré, sans complexité inutile.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${inView ? "wt-stagger" : ""}`}>
              <div className="relative flex flex-col gap-8">
                {/* Ligne reliant les 3 étapes */}
                <div className="absolute left-5 top-5 bottom-5 w-px" aria-hidden="true"
                  style={{ background: `linear-gradient(to bottom, ${C.violet}80, ${C.blue}80, ${C.green}80)` }} />
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.title} className={`relative flex items-start gap-5 ${inView ? "wt-slide-up" : "opacity-0"}`}>
                      <div className="relative z-10 shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: `${s.color}1a`, border: `1px solid ${s.color}40` }}>
                        <Icon size={18} style={{ color: s.color }} />
                      </div>
                      <div className="pt-1">
                        <div className="text-xs font-black tracking-wide mb-1"
                          style={{ background: C.gradientPrimary, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          ÉTAPE 0{i + 1}
                        </div>
                        <h3 className="text-base font-bold mb-1.5" style={{ color: C.text }}>{s.title}</h3>
                        <p className="text-sm leading-relaxed" style={{ color: C.muted, whiteSpace: "pre-line" }}>{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`flex justify-center ${inView ? "wt-scale-in" : "opacity-0"}`}>
                <SyncPhoneMockup />
              </div>
            </div>
          )}
        </Reveal>
        <div className="text-center mt-10">
          <button onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold"
            style={btn.primary} {...primaryHover}>
            Créer mon compte gratuitement <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: C.text }}>Ce qu'en disent nos utilisateurs</h2>
          <p style={{ color: C.muted }}>Retours d'expérience sur la prise en main et les résultats obtenus.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${inView ? "wt-stagger" : ""}`}>
              {TESTIMONIALS.map((t, idx) => (
                <div
                  key={t.name}
                  className={`rounded-2xl p-8 flex flex-col wt-card-hover wt-card-enter transition-all duration-300 ${inView ? "wt-slide-up" : "opacity-0"}`}
                  style={{
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    animation: inView ? `wt-slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both` : "none",
                    animationDelay: `${idx * 100}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.amber + "44";
                    e.currentTarget.style.background = `${C.amber}05`;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.panel;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}>
                  <div className="flex gap-1 mb-5">
                    {Array(5).fill(0).map((_, i) => (
                      <Star key={i} size={16} fill={C.amber} style={{ color: C.amber }} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: C.text }}>
                    «&nbsp;<span style={{ color: C.muted }}>{t.text}</span>&nbsp;»
                  </p>
                  <div className="flex items-center gap-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${C.blue} 0%, ${C.violet} 100%)`,
                        color: "#fff",
                      }}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: C.text }}>
                        {t.name}
                      </div>
                      <div className="text-xs leading-tight" style={{ color: C.muted }}>
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 md:px-16 mb-20 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: C.text }}>Questions fréquentes</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <button className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors"
                style={{ background: openFaq === i ? `${C.blue}08` : "rgba(255,255,255,0.01)" }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="font-semibold text-sm pr-4" style={{ color: C.text }}>{faq.q}</span>
                <ChevronDown size={15} style={{
                  color: C.muted, flexShrink: 0,
                  transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
              </button>
              <div style={{ display: "grid", gridTemplateRows: openFaq === i ? "1fr" : "0fr", transition: "grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                <div className="overflow-hidden">
                  <div className="px-6 pb-5 pt-1 text-sm leading-relaxed" style={{ color: C.muted }}>
                    {faq.a}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 md:px-16 py-14" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-5xl mx-auto">

          {/* Colonnes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            {/* Logo + accroche */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg p-1.5" style={{ background: C.blue }}>
                  <BarChart3 size={14} color="#fff" />
                </div>
                <span className="font-bold text-sm" style={{ color: C.text, fontFamily: "'Lora', Georgia, serif" }}>WealthTrack</span>
              </div>
              <p className="text-xs leading-relaxed max-w-[220px]" style={{ color: C.muted }}>
                L'outil de simulation patrimoniale pour comprendre et piloter vos finances.
              </p>
            </div>

            {/* Produit */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.text }}>Produit</h4>
              <ul className="space-y-2.5">
                <li><FooterLink onClick={onStart}>Tableau de bord</FooterLink></li>
                <li><FooterLink onClick={onStart}>Simulations patrimoniales</FooterLink></li>
                <li><FooterLink onClick={onStart}>Indépendance financière (FIRE)</FooterLink></li>
                <li><FooterLink onClick={onStart}>Immobilier</FooterLink></li>
                <li><FooterLink onClick={onStart}>Crypto & DeFi</FooterLink></li>
                <li><FooterLink onClick={onStart}>Mode Couple</FooterLink></li>
                <li><FooterLink href="#comment-ca-marche">Comment ça marche</FooterLink></li>
              </ul>
            </div>

            {/* À propos */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: C.text }}>À propos</h4>
              <ul className="space-y-2.5">
                <li><FooterLink onClick={() => setShowPourquoi(true)}>Pourquoi WealthTrack</FooterLink></li>
                <li><FooterLink href="mailto:felix.messer38@gmail.com">Contact</FooterLink></li>
                <li><FooterLink onClick={() => setLegalModal("mentions")}>Mentions légales</FooterLink></li>
                <li><FooterLink onClick={() => setLegalModal("confidentialite")}>Politique de confidentialité</FooterLink></li>
                <li><FooterLink onClick={() => setLegalModal("cookies")}>Politique de cookies</FooterLink></li>
                <li><FooterLink onClick={() => setLegalModal("cgu")}>CGU</FooterLink></li>
                <li><FooterLink onClick={() => setLegalModal("support")}>Support</FooterLink></li>
              </ul>
            </div>
          </div>

          {/* Badges de confiance */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6 pt-8" style={{ borderTop: `1px solid ${C.border}` }}>
            {[
              { icon: ShieldCheck, label: "RGPD Compliant",          color: C.green },
              { icon: Database,    label: "Données locales par défaut", color: C.blue },
              { icon: EyeOff,      label: "Aucun tracking",          color: C.blue },
              { icon: Award,       label: "Outil pédagogique",       color: "#64748b" },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <span key={b.label} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: b.color + "10", color: b.color, border: `1px solid ${b.color}22` }}>
                  <Icon size={10} /> {b.label}
                </span>
              );
            })}
          </div>

          <p className="text-xs max-w-2xl mx-auto text-center leading-relaxed mb-4" style={{ color: "#334155" }}>
            WealthTrack est un outil d'aide à la décision financière à caractère pédagogique. Il ne constitue pas un conseil en investissement au sens des articles L. 321-1 et suivants du Code monétaire et financier, ni au sens de la réglementation AMF. Les simulations sont fournies à titre indicatif et ne garantissent pas les performances futures. Pour tout conseil personnalisé, consultez un professionnel agréé (CIF, CGP, expert-comptable).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-3" style={{ color: "#334155" }}>
            <span>© 2026 WealthTrack</span>
          </div>
          <p className="text-center" style={{ color: "#1e293b", fontSize: 10 }}>
            Les performances passées ne préjugent pas des performances futures · Tout investissement comporte un risque de perte en capital
          </p>
        </div>
      </footer>
      </div>

      {legalModal && <LegalModal id={legalModal} onClose={() => setLegalModal(null)} />}
      {showPourquoi && <PourquoiModal onClose={() => setShowPourquoi(false)} />}

    </div>
  );
}
