import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { C, CL, glow } from "./theme.js";
import "./animations.css";
import { useScrollReveal } from "./hooks/useScrollReveal.js";
// Three.js (~600 ko) isolé dans un chunk séparé — chargé après le 1er paint.
const PaperShaderBackground = lazy(() => import("./PaperShaderBackground.jsx"));
import AIChatWidget from "./AIChatWidget.jsx";
import NeonGlow from "./NeonGlow.jsx";
import { useTheme } from "./ThemeProvider.jsx";
import {
  BarChart3, TrendingUp, Shield, Zap, Wallet, Home, Users, Target, Coins,
  Building2, ChevronDown, ArrowRight,
  Star, Database, EyeOff,
  ShieldCheck, Award, Briefcase, UserCheck, PiggyBank, Activity,
  X, Calculator, Flag, Check,
  UserPlus, Link2, Sparkles, Search,
  LayoutDashboard, Bitcoin, MessageCircle, ListTree, Percent, Crown,
  CreditCard, Landmark,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { ScrollProgressBar } from "./lib/motion.jsx";

/* ── Constantes de contenu ─────────────────────────────────────── */

const HERO_SERIES = [
  { m: "Aoû", value: 113000 },
  { m: "Sep", value: 115200 },
  { m: "Oct", value: 117800 },
  { m: "Nov", value: 119500 },
  { m: "Déc", value: 121400 },
  { m: "Jan", value: 123100 },
  { m: "Fév", value: 125600 },
  { m: "Mar", value: 129000 },
  { m: "Avr", value: 133800 },
  { m: "Mai", value: 140200 },
  { m: "Juin", value: 150500 },
  { m: "Jun", value: 156400 },
];

// Répartition affichée dans le mockup "Patrimoine" de la landing.
const PATR_ALLOC = [
  { name: "Immobilier", value: 48, color: "#3b82f6" },
  { name: "Crédit immo", value: 30, color: "#ef4444" },
  { name: "ETF / Actions", value: 11, color: "#22d3ee" },
  { name: "Liquidités", value: 5, color: "#22c55e" },
  { name: "Crypto", value: 2, color: "#f59e0b" },
  { name: "Or", value: 2, color: "#a855f7" },
];

// Reflète la vraie sidebar de l'app (cf. Sidebar dans App.jsx).
const SIDEBAR_PREVIEW_ITEMS = [
  { label: "Tableau de bord", icon: LayoutDashboard },
  { label: "Patrimoine", icon: Wallet, active: true },
  { label: "Simulations", icon: TrendingUp },
  { label: "Plan d'action", icon: Star },
  { label: "Mes frais", icon: Percent },
  { label: "Objectifs", icon: Target },
  { label: "Fiscalité", icon: Calculator },
  { label: "Tarifs", icon: Crown },
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
    stat: "Zéro saisie manuelle",
  },
  {
    icon: BarChart3, color: C.green,
    title: "Vue d'ensemble du patrimoine",
    desc: "Actifs, passifs, historique complet sur un tableau de bord unique. Votre situation nette, son évolution et sa répartition.",
    stat: "Historique illimité",
  },
  {
    icon: TrendingUp, color: C.blue,
    title: "Fiscalité nette en France",
    desc: "Visualisez votre capital et rendement nets après impôts : fiscalité Crypto, PEA, CTO, AV et Immobilier. Pas les gains bruts.",
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
    stat: "3 ans gagnés en moyenne",
  },
  {
    icon: Zap, color: C.blue,
    title: "Simulations sur 30 ans",
    desc: "ETF MSCI World, immobilier locatif, épargne défensive — avec intérêts composés et timeline année par année.",
    stat: "3 scénarios temps réel",
  },
  {
    icon: Building2, color: C.blue,
    title: "Patrimoine : répartition et projection",
    desc: "Liquidités, ETF, immobilier, crypto : visualisez la composition et projetez l'évolution à 10 et 20 ans.",
    stat: "7 classes d'actifs",
  },
  {
    icon: Calculator, color: C.blue,
    title: "Simulez chaque décision",
    desc: "Modifiez un paramètre (épargne, allocation, achat...) et observez l'impact immédiat sur votre trajectoire.",
    stat: "Avant / après chaque décision",
  },
  {
    icon: Flag, color: C.green,
    title: "Indépendance financière (FIRE)",
    desc: "Calculez votre date d'IF à partir de votre taux d'épargne réel et la règle des 4% avec 3 scénarios: pessimiste, base, optimiste.",
    stat: "Règle des 4% + 3 scénarios",
  },
];

const TESTIMONIALS = [
  {
    initials: "MD",
    name: "Marie D.",
    role: "38 ans · Responsable marketing, CDI — Lyon",
    result: "62 000 € économisés sur 20 ans via PEA",
    text: "Je plaçais mon argent au hasard depuis 8 ans. WealthTrack a calculé en 5 minutes que basculer mes fonds euros sur PEA me ferait économiser 62 k€ nets de fiscalité d'ici ma retraite. J'aurais aimé avoir ça à 30 ans.",
  },
  {
    initials: "LS",
    name: "Lucas & Sarah",
    role: "26 et 29 ans · Ingénieur & Infirmière — Bordeaux",
    result: "Objectif FIRE atteint 3 ans plus tôt",
    text: "On avait chacun notre compte, chacun notre tableau Excel, et des désaccords constants sur les priorités. Le mode couple a tout centralisé. On sait maintenant exactement où on en est — et qu'on sera libres à 49 ans au lieu de 52.",
  },
  {
    initials: "SL",
    name: "Sophie L.",
    role: "35 ans · Consultante freelance — Paris",
    result: "+1 740 € nets récupérés la 1re année",
    text: "Je provisionnais trop pour mes charges sociales et pas assez pour la flat tax sur mes ETF. WealthTrack a identifié les deux erreurs en même temps. Les 1 740 € récupérés la première année ont payé largement l'abonnement.",
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
    q: "WealthTrack est-il gratuit ?",
    a: "WealthTrack est gratuit : vous pouvez créer un compte et explorer l'application sans carte bancaire. Les fonctionnalités avancées présentées — simulations long terme, projection d'actifs, immobilier locatif, optimisation fiscale, mode Couple — sont disponibles avec un abonnement Pro ou Couple.",
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
        body: [
          "WealthTrack n'est pas un prestataire de services d'investissement (PSI) et n'est pas immatriculé à l'ORIAS. Le site propose un outil de simulation à caractère pédagogique, qui ne constitue ni un conseil en investissement, ni une recommandation personnalisée au sens des articles L. 321-1 et suivants du Code monétaire et financier.",
          "WealthTrack n'est pas un prestataire de services d'investissement (PSI) au sens de la directive MIF II et ne fait l'objet d'aucun enregistrement auprès de l'AMF ou de l'ACPR en tant que conseiller en investissements financiers (CIF).",
        ],
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
        body: ["Par défaut, aucune donnée financière n'est envoyée à un serveur tiers. Les éventuels appels à des services externes (cours de marché) sont anonymes et ne contiennent aucune information personnelle."],
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
        heading: "Crypto-actifs",
        body: ["Les crypto-actifs sont des instruments hautement spéculatifs et volatils. Leur valeur peut fluctuer très fortement à la hausse comme à la baisse. Ils ne sont pas couverts par les dispositifs de garantie des dépôts bancaires (FGDR) ni par les mécanismes d'indemnisation des investisseurs (FNGI)."],
      },
      {
        heading: "Conseil professionnel",
        body: ["Pour toute décision d'investissement, il est fortement recommandé de consulter un conseiller en gestion de patrimoine (CGP) agréé par l'ORIAS, un conseiller fiscal ou un expert-comptable agréé, selon la nature de votre situation."],
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
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
  if (onClick) {
    return (
      <button onClick={onClick} className="text-sm block text-left transition-colors"
        style={{ color: T.muted }}
        onMouseEnter={(e) => { e.currentTarget.style.color = T.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className="text-sm block transition-colors"
      style={{ color: T.muted }}
      onMouseEnter={(e) => { e.currentTarget.style.color = T.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
      {children}
    </a>
  );
}

/* ── Ambient orbs (hero cinematic depth) ────────────────────────── */

function HeroOrbs() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100vh", overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      <div style={{ position: "absolute", width: 700, height: 700, top: -280, left: -160, borderRadius: "50%", background: "#1e293b", opacity: 0.55, filter: "blur(130px)", animation: "wt-orb-drift 22s ease-in-out infinite", willChange: "transform" }} />
      <div style={{ position: "absolute", width: 500, height: 500, top: -80, right: -120, borderRadius: "50%", background: "#3b82f6", opacity: 0.08, filter: "blur(110px)", animation: "wt-orb-drift 28s ease-in-out infinite", animationDelay: "-9s", willChange: "transform" }} />
      <div style={{ position: "absolute", width: 280, height: 280, top: "45%", left: "35%", borderRadius: "50%", background: "#0891b2", opacity: 0.06, filter: "blur(80px)", animation: "wt-orb-drift 17s ease-in-out infinite", animationDelay: "-5s", willChange: "transform" }} />
    </div>
  );
}

/* ── Count-up number on scroll entry ────────────────────────────── */

function CountUpNumber({ end, suffix = "", duration = 1600 }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStarted(true); obs.disconnect(); }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started || end === 0) { setCount(end); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setCount(end); return; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.floor(end * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setCount(end);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, end, duration]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ── Hero Background — Mesh Gradient Bleu ────────────────────────── */

function HeroBackground() {
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
  return (
    <div className="absolute inset-x-0 top-0" aria-hidden="true" style={{
      height: 600,
      overflow: "hidden",
      zIndex: 0,
      pointerEvents: "none",
      background: `
        radial-gradient(ellipse 800px 500px at 20% 10%, ${T.blue}25, transparent 50%),
        radial-gradient(ellipse 600px 400px at 80% 30%, ${T.blue}15, transparent 55%),
        linear-gradient(to bottom, ${T.bgGradient}, transparent)
      `,
      maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
    }} />
  );
}

/* ── Mockup téléphone (à côté du tableau de bord, façon Finary) ──── */

function PhoneMockup() {
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
  return (
    <div className="hidden lg:block absolute" style={{ bottom: -56, right: -28, width: 200, zIndex: 10 }}>
      <div className="rounded-[28px] p-1.5" style={{ background: "#0b1220", border: `1px solid ${T.border}`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.7)" }}>
        <div className="rounded-[22px] overflow-hidden" style={{ background: T.panel }}>
          {/* Encoche */}
          <div className="flex justify-center pt-2.5 pb-1.5">
            <div className="w-14 h-3.5 rounded-full" style={{ background: "#0b1220" }} />
          </div>
          <div className="px-4 pb-4">
            <div className="text-[10px] mb-1" style={{ color: T.muted }}>Patrimoine net</div>
            <div className="text-xl font-black mb-1" style={{ color: T.text }}>142 500 €</div>
            <div className="flex items-center gap-1 text-[10px] font-semibold mb-2" style={{ color: T.green }}>
              <TrendingUp size={10} /> +109,6 %
            </div>
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={HERO_SERIES} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.violet} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={T.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={T.violet} strokeWidth={2} fill="url(#phoneGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 mt-3">
              {[
                { label: "Total actifs", value: "277 500 €", color: T.green },
                { label: "Total passifs", value: "−135 000 €", color: "#ef4444" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between  px-3 py-2" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <span className="text-[10px]" style={{ color: T.muted }}>{s.label}</span>
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
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
  const banks = [
    { name: "BNP Paribas",       domain: "bnpparibas.fr" },
    { name: "Société Générale",  domain: "particuliers.societegenerale.fr" },
    { name: "Crédit Agricole",   domain: "credit-agricole.fr" },
    { name: "Fortuneo",          domain: "fortuneo.fr" },
    { name: "Trade Republic",    domain: "traderepublic.com" },
    { name: "Boursorama",        domain: "boursorama.com" },
  ];
  return (
    <div className="rounded-[28px] p-1.5" style={{ background: "#0b1220", border: `1px solid ${T.border}`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.7)", width: 220 }}>
      <div className="rounded-[22px] overflow-hidden" style={{ background: T.panel }}>
        {/* Encoche */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-14 h-3.5 rounded-full" style={{ background: "#0b1220" }} />
        </div>
        <div className="px-4 pb-4">
          <div className="text-xs font-bold mb-3" style={{ color: T.text }}>Synchroniser mes comptes :</div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <Search size={12} style={{ color: T.muted }} />
            <span className="text-[11px]" style={{ color: T.muted }}>Trouvez un établissement</span>
          </div>
          <div className="flex flex-col gap-2">
            {banks.map((b) => (
              <div key={b.name} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <BankLogo name={b.name} domain={b.domain} />
                <span className="text-[11px] font-medium flex-1" style={{ color: T.text }}>{b.name}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: T.green }} />
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
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
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
          <h2 className="text-xl font-black" style={{ color: T.text }}>{content.title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 transition-colors"
            style={{ color: T.muted, background: T.veil3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-5">
          {content.sections.map((s, i) => (
            <div key={i}>
              <h3 className="text-sm font-bold mb-2" style={{ color: T.text }}>{s.heading}</h3>
              {s.body.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed mb-1.5" style={{ color: T.muted }}>{p}</p>
              ))}
              {s.list && (
                <ul className="space-y-1 mt-1">
                  {s.list.map((l, j) => (
                    <li key={j} className="text-sm leading-relaxed flex items-start gap-2" style={{ color: T.muted }}>
                      <span style={{ color: T.blue }}>•</span> {l}
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
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
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
          <h2 className="text-xl font-black" style={{ color: T.text }}>Pourquoi WealthTrack ?</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 transition-colors"
            style={{ color: T.muted, background: T.veil3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
            <X size={16} />
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: T.muted }}>L'histoire derrière l'outil — racontée par celui qui l'utilise tous les jours.</p>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-3 md:w-48 shrink-0">
            <div className="rounded-2xl w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-xl md:text-2xl font-black shrink-0"
              style={{ background: `linear-gradient(135deg, ${T.blue}, #8b5cf6)`, color: "#fff" }}>
              FM
            </div>
            <div>
              <div className="font-bold" style={{ color: T.text }}>Félix</div>
              <div className="text-xs mb-2" style={{ color: T.muted }}>Étudiant · Fondateur de WealthTrack</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: `${T.green}18`, color: T.green }}>
                <Flag size={12} /> Objectif personnel : FIRE
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 text-sm leading-relaxed" style={{ color: T.muted }}>
            <p>
              <span style={{ color: T.text, fontWeight: 600 }}>Je m'appelle Félix, je suis étudiant</span> — et comme beaucoup, j'ai découvert le mouvement FIRE (<em>Financial Independence, Retire Early</em>) un peu par hasard. Depuis, une obsession : savoir exactement où en est mon patrimoine, et combien de temps il me reste avant de pouvoir en vivre.
            </p>
            <p>
              Le problème, c'est qu'aucun outil ne correspondait vraiment à ma situation. Les tableurs Excel deviennent vite ingérables, les applications bancaires n'affichent que des soldes bruts, et les simulateurs « pro » sont pensés pour des patrimoines bien plus confortables que celui d'un étudiant qui démarre avec 50 € par mois.
            </p>
            <p>
              J'ai donc construit WealthTrack pour moi-même : un outil qui calcule ma fiscalité réelle (PEA, CTO, assurance-vie), qui projette mes 30 prochaines années sans enjoliver les rendements, et qui me dit concrètement quoi faire ensuite — pas juste « épargnez plus ».
            </p>
            <p style={{ color: T.text, fontWeight: 600 }}>
              Mon objectif est simple : atteindre l'indépendance financière le plus vite possible, avec méthode plutôt qu'avec espoir. Si vous visez la même chose, j'espère que WealthTrack vous fera gagner autant de temps qu'il m'en fait gagner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Composant principal ───────────────────────────────────────── */

export default function Landing({ onStart, onLogin = onStart }) {
  const { isDark } = useTheme();
  const T = isDark ? C : CL;
  const [openFaq, setOpenFaq] = useState(null);
  const [legalModal, setLegalModal] = useState(null);
  const [showPourquoi, setShowPourquoi] = useState(false);

  const btn = {
    primary: {
      background: T.gradientPrimary,
      color: "#fff",
    },
    ghost: {
      border: `1px solid ${T.border}`,
      color: T.muted,
      background: "transparent",
    },
  };

  /* Feedback au survol des CTA — réagissent immédiatement au pointeur */
  const primaryHover = {
    onMouseEnter: (e) => {
      e.currentTarget.style.transform = "translateY(-1px) scale(1.015)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.transform = "";
    },
  };
  const ghostHover = {
    onMouseEnter: (e) => {
      e.currentTarget.style.borderColor = T.veilBorder;
      e.currentTarget.style.color = T.text;
      e.currentTarget.style.background = T.veil4;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.borderColor = T.border;
      e.currentTarget.style.color = T.muted;
      e.currentTarget.style.background = "transparent";
    },
  };

  return (
    <div style={{ color: T.text, fontFamily: "'Inter', -apple-system, sans-serif", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <Suspense fallback={null}><PaperShaderBackground /></Suspense>
      <HeroOrbs />

      <div className="relative z-10" style={{ zIndex: 2 }}>
        <ScrollProgressBar />

        <HeroBackground />

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-16 py-4"
        style={{ background: "transparent", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="rounded-xl p-1.5 sm:p-2 flex items-center justify-center" style={{ background: "linear-gradient(150deg, rgba(91,141,239,0.20) 0%, rgba(139,92,246,0.10) 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 20px -8px rgba(91,141,239,0.55)" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
              <defs><linearGradient id="wtLogoFillNav" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
              <path d="M6 4.5 L6 18 L19.5 18" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 18 C9 16.5 10.5 12 13 10 C15.5 8 17.5 6.5 19.5 5.5 L19.5 18 Z" fill="url(#wtLogoFillNav)" />
              <path d="M6 18 C9 16.5 10.5 12 13 10 C15.5 8 17.5 6.5 19.5 5.5" stroke="#3b82f6" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span className="text-sm sm:text-lg font-bold tracking-tight" style={{ fontFamily: "inherit", background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>WealthTrack</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button onClick={onLogin} className="text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all"
            style={{ background: "transparent", border: `1px solid ${T.blue}`, color: T.blue }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${T.blue}14`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            Se connecter
          </button>
          <button onClick={onStart} className="text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all"
            style={{ background: T.blue, border: `1px solid ${T.blue}`, color: "#fff" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.filter = "brightness(1.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.filter = ""; }}>
            S'inscrire
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative px-6 md:px-16 pt-16 md:pt-24 pb-16 max-w-4xl mx-auto wt-stagger text-center">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-none tracking-tight wt-slide-up wt-hero-enter text-center"
          style={{ color: T.text, fontFamily: "inherit" }}>
          <span style={{ color: T.text }}>
            Simulez.
          </span>{" "}
          <span style={{ color: T.text }}>
            Comprenez.
          </span>
          <br /><span className="wt-shiny-text" style={{ backgroundImage: "linear-gradient(110deg, #3b82f6 20%, #60a5fa 45%, #bfdbfe 55%, #60a5fa 70%, #3b82f6 90%)", animationDuration: "8.5s", textShadow: "0 0 12px rgba(59,130,246,0.28)" }}>Décidez.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl mb-4 max-w-2xl sm:mx-auto leading-relaxed wt-slide-up wt-hero-enter" style={{ color: T.muted }}>
          Reliez vos comptes, et{" "}
          <span style={{ color: T.text, fontWeight: 600 }}>projetez votre patrimoine à 10, 20 ou 30 ans</span>{" "}
          avant de prendre la moindre décision.
        </p>
        <p className="text-sm mb-8 wt-slide-up" style={{ color: T.muted }}>
          <span className="block sm:inline">Vue à 360° du patrimoine</span>
          <span className="hidden sm:inline"> · </span>
          <span className="block sm:inline">PEA, AV, Crypto & Immobilier</span>
          <span className="hidden sm:inline"> · </span>
          <span className="block sm:inline">Objectif FIRE</span>
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-6 wt-slide-up">
          <button onClick={onStart}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold wt-button-press w-full sm:w-auto"
            style={btn.primary} {...primaryHover}>
            Commencer gratuitement <ArrowRight size={18} />
          </button>
          <button
            onClick={() => document.getElementById("dashboard-preview")?.scrollIntoView({ behavior: "smooth" })}
            className="relative group overflow-hidden px-8 py-4 rounded-2xl text-base font-medium transition-colors hidden sm:flex items-center justify-center"
            style={btn.ghost} {...ghostHover}>
            <NeonGlow color={T.blue} />
            Voir la démonstration
          </button>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mt-1 wt-slide-up"
          style={{ background: `${T.blue}10`, border: `1px solid ${T.blue}25`, color: T.muted }}>
          <span className="text-center">
            Simulation uniquement<span className="hidden sm:inline"> · </span><span className="block sm:inline">Non conseil en investissement (AMF)</span>
          </span>
        </div>
      </section>

      {/* ── DASHBOARD PREVIEW ── */}
      <div id="dashboard-preview" className="relative px-6 md:px-16 mb-24 lg:mb-32 max-w-5xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden wt-glow-pulse wt-glass"
          style={{ border: `1px solid ${T.border}`, background: isDark ? "rgba(7,13,26,0.88)" : T.card }}>

          {/* Halos lumineux animés */}
          <div className="absolute pointer-events-none rounded-full"
            style={{ width: 320, height: 320, top: -120, left: -100, background: T.blue, opacity: 0.18, filter: "blur(90px)", animation: "wt-blob 14s ease-in-out infinite" }} />
          <div className="absolute pointer-events-none rounded-full"
            style={{ width: 280, height: 280, bottom: -120, right: -80, background: T.green, opacity: 0.16, filter: "blur(90px)", animation: "wt-blob 16s ease-in-out infinite", animationDelay: "-6s" }} />

          {/* Barre de fenêtre */}
          <div className="relative flex items-center gap-2 px-5 py-3"
            style={{ borderBottom: `1px solid ${T.border}`, background: T.veil2 }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f5a623" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#27a37a" }} />
            <span className="ml-3 text-xs" style={{ color: T.muted }}>wealthtrack.app · Patrimoine</span>
          </div>

          {/* Contenu */}
          <div className="relative flex">
            {/* Sidebar miniature — fonctionnalités réelles de l'app */}
            <div className="hidden md:flex flex-col gap-1 p-3 shrink-0" style={{ width: 176, borderRight: `1px solid ${T.border}` }}>
              {SIDEBAR_PREVIEW_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <div key={it.label} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{
                      background: it.active ? T.blue : "transparent",
                      color: it.active ? "#fff" : T.muted,
                      boxShadow: "none",
                    }}>
                    <Icon size={14} />
                    {it.label}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 p-5 md:p-7 text-left">
              {/* En-tête */}
              <div className="mb-5">
                <div className="text-xl md:text-2xl font-black" style={{ color: T.text }}>Patrimoine</div>
                <div className="text-xs" style={{ color: T.muted }}>Suivi de votre richesse nette</div>
              </div>

              {/* Accès rapides */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { icon: CreditCard, color: "#ef4444", title: "Mes crédits", sub: "Prêts & passifs" },
                  { icon: Bitcoin,    color: T.amber,   title: "Crypto",      sub: "Portefeuille & cours live" },
                  { icon: Landmark,   color: T.blue,    title: "Importer / Banque", sub: "Relevés & connexion" },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.title} className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                      <span className="rounded-lg p-1.5 shrink-0" style={{ background: a.color + "1a" }}><Icon size={15} style={{ color: a.color }} /></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold truncate" style={{ color: T.text }}>{a.title}</span>
                        <span className="block text-[10px] truncate" style={{ color: T.muted }}>{a.sub}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Évolution + Performance — layout fidèle au screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {/* Évolution du patrimoine net (2/3) */}
                <div className="md:col-span-2 rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold" style={{ color: T.text }}>Évolution du patrimoine net</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1" style={{ background: "rgba(0,200,150,0.12)", color: C.green }}>
                        ↗ +38,5 %
                      </span>
                    </div>
                    <div className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: T.muted, border: `1px solid ${T.border}` }}>12 derniers mois</div>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={HERO_SERIES} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="patrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke={C.blue} strokeWidth={2} fill="url(#patrGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Performance (1/3) */}
                <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div>
                    <div className="text-sm font-bold mb-1" style={{ color: T.text }}>Performance</div>
                    <div className="text-[10px] mb-4" style={{ color: T.muted }}>Depuis Juil 2025 : +38,5 %</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black mb-2" style={{ color: C.green }}>+38,5 %</div>
                    <div className="text-xs font-semibold flex items-center gap-1" style={{ color: C.green }}>
                      ↗ <span>+42 729 €</span>
                      <span style={{ color: T.muted, fontWeight: 400 }}>sur la période</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actifs + Répartition */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Liste actifs (2/3) */}
                <div className="md:col-span-2 rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-sm font-bold" style={{ color: T.text }}>Actifs</div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${C.blue}18`, color: C.blue }}>288 729 €</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Épargne liquide",   value: "22 500 €", color: C.green },
                      { label: "Investissements",    value: "45 000 €", color: C.blue },
                      { label: "Immobilier",         value: "200 000 €", color: "#3b82f6" },
                      { label: "Autres actifs",      value: "10 000 €", color: C.muted },
                    ].map((a) => (
                      <div key={a.label} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                          <span className="text-xs" style={{ color: T.text }}>{a.label}</span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: a.color }}>{a.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Répartition donut (1/3) */}
                <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold" style={{ color: T.text }}>Répartition</div>
                    <div className="text-[10px]" style={{ color: T.muted }}>7 catégories</div>
                  </div>
                  <ResponsiveContainer width="100%" height={110}>
                    <PieChart>
                      <Pie data={PATR_ALLOC} dataKey="value" nameKey="name" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
                        {PATR_ALLOC.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                    {PATR_ALLOC.map((a) => (
                      <span key={a.name} className="text-[10px] flex items-center gap-1" style={{ color: T.muted }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.color }} /> {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── STATS ── */}
      <div className="px-6 md:px-16 mb-20 max-w-4xl mx-auto">
        <div className="rounded-2xl p-8 md:p-10 grid grid-cols-2 md:grid-cols-4 gap-8 wt-glass"
          style={{ background: isDark ? "rgba(7,13,26,0.85)" : T.card, border: `1px solid ${T.border}`, boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "none" }}>
          {[
            { end: 16,  suffix: "",     label: "modules de simulation" },
            { end: 30,  suffix: " ans", label: "d'horizon de projection" },
            { end: 100, suffix: "%",    label: "données sous contrôle" },
            { end: 0,   suffix: " €",   label: "pour commencer" },
          ].map(({ end, suffix, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl md:text-3xl font-black mb-2" style={{ color: T.blue }}>
                <CountUpNumber end={end} suffix={suffix} />
              </div>
              <div className="text-xs leading-tight" style={{ color: T.muted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── POUR QUI ── */}
      <section className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: T.text }}>Votre situation. Votre simulation.</h2>
          <p style={{ color: T.muted }}>WealthTrack s'adapte à votre profil — pas l'inverse.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${inView ? "wt-stagger" : ""}`}>
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title}
                    className={`text-left rounded-2xl px-5 pt-4 pb-2 transition-all wt-card-hover wt-card-enter cursor-pointer ${inView ? "wt-slide-up" : "opacity-0"}`}
                    style={{ background: T.panel, border: `1px solid ${T.border}` }}
                    onClick={onLogin}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.blue + "66"; e.currentTarget.style.background = `${T.blue}08`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.panel; }}>
                    <div className="rounded-xl p-2.5 w-fit mb-3" style={{ background: `${T.blue}18` }}>
                      <Icon size={18} style={{ color: T.blue }} />
                    </div>
                    <h3 className="text-base font-bold mb-1.5" style={{ color: T.text }}>{p.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: T.muted }}>{p.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>

      {/* ── FEATURES ── */}
      <section id="fonctionnalites" className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: T.text }}>Moins de doutes. Plus de décisions.</h2>
          <p style={{ color: T.muted }}>Chaque module répond à une question concrète — PEA vs AV, capacité d'emprunt, indépendance financière, fiscalité crypto.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${inView ? "wt-stagger" : ""}`}>
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className={`rounded-2xl px-5 pt-4 pb-2 transition-all wt-card-hover wt-card-enter cursor-pointer ${inView ? "wt-slide-up" : "opacity-0"}`}
                    style={{ background: T.panel, border: `1px solid ${T.border}` }}
                    onClick={onLogin}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color + "66"; e.currentTarget.style.background = `${f.color}08`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.panel; }}>
                    <div className="rounded-xl p-2.5 w-fit mb-3" style={{ background: f.color + "1a" }}>
                      <Icon size={18} style={{ color: f.color }} />
                    </div>
                    <h3 className="font-bold text-base mb-1.5" style={{ color: T.text }}>{f.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: T.muted }}>{f.desc}</p>
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
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: T.text }}>Opérationnel en 3 minutes</h2>
          <p style={{ color: T.muted }}>Inscription, connexion de vos comptes, premier plan d'action — tout ça avant votre prochain café.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${inView ? "wt-stagger" : ""}`}>
              <div className="relative flex flex-col gap-8">
                {/* Ligne reliant les 3 étapes */}
                <div className="absolute left-5 top-5 bottom-5 w-px" aria-hidden="true"
                  style={{ background: `linear-gradient(to bottom, ${T.violet}80, ${T.blue}80, ${T.green}80)` }} />
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
                          style={{ background: T.gradientPrimary, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          ÉTAPE 0{i + 1}
                        </div>
                        <h3 className="text-base font-bold mb-1.5" style={{ color: T.text }}>{s.title}</h3>
                        <p className="text-sm leading-relaxed" style={{ color: T.muted, whiteSpace: "pre-line" }}>{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Reveal>
        <div className="text-center mt-10">
          <button onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold"
            style={btn.primary} {...primaryHover}>
            Commencer gratuitement <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ── */}
      <section className="px-6 md:px-16 mb-20 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: T.text }}>Ce qu'en disent nos utilisateurs</h2>
          <p style={{ color: T.muted }}>Retours d'expérience sur la prise en main et les résultats obtenus.</p>
        </div>
        <Reveal>
          {(ref, inView) => (
            <div ref={ref} className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${inView ? "wt-stagger" : ""}`}>
              {TESTIMONIALS.map((t, idx) => (
                <div
                  key={t.name}
                  className={`rounded-2xl p-8 flex flex-col wt-card-hover wt-glass transition-all duration-300 ${inView ? "opacity-100" : "opacity-0"}`}
                  style={{
                    background: isDark ? "rgba(9,14,30,0.82)" : T.panel,
                    border: `1px solid ${T.border}`,
                    animation: inView ? `wt-slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both` : "none",
                    animationDelay: `${idx * 100}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)";
                    e.currentTarget.style.background = isDark ? "rgba(124,58,237,0.06)" : `${T.violet}08`;
                    e.currentTarget.style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.background = isDark ? "rgba(9,14,30,0.82)" : T.panel;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-5"
                    style={{ background: `${T.green}18`, color: T.green, border: `1px solid ${T.green}30` }}>
                    <Check size={10} /> {t.result}
                  </div>
                  <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: T.text }}>
                    «&nbsp;<span style={{ color: T.muted }}>{t.text}</span>&nbsp;»
                  </p>
                  <div className="flex items-center gap-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${T.blue} 0%, ${T.violet} 100%)`,
                        color: "#fff",
                      }}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: T.text }}>
                        {t.name}
                      </div>
                      <div className="text-xs leading-tight" style={{ color: T.muted }}>
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
          <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: T.text }}>Questions fréquentes</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <button className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors"
                style={{ background: openFaq === i ? `${T.blue}08` : T.veil1 }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="font-semibold text-sm pr-4" style={{ color: T.text }}>{faq.q}</span>
                <ChevronDown size={15} style={{
                  color: T.muted, flexShrink: 0,
                  transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
              </button>
              <div style={{ display: "grid", gridTemplateRows: openFaq === i ? "1fr" : "0fr", transition: "grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                <div className="overflow-hidden">
                  <div className="px-6 pb-5 pt-1 text-sm leading-relaxed" style={{ color: T.muted }}>
                    {faq.a}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 md:px-16 py-14" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="max-w-5xl mx-auto">

          {/* Colonnes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            {/* Logo + accroche */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg p-1.5 flex items-center justify-center" style={{ background: "linear-gradient(150deg, rgba(91,141,239,0.20) 0%, rgba(139,92,246,0.10) 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 20px -8px rgba(91,141,239,0.55)" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <defs><linearGradient id="wtLogoFillFt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                    <path d="M6 4.5 L6 18 L19.5 18" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 18 C9 16.5 10.5 12 13 10 C15.5 8 17.5 6.5 19.5 5.5 L19.5 18 Z" fill="url(#wtLogoFillFt)" />
                    <path d="M6 18 C9 16.5 10.5 12 13 10 C15.5 8 17.5 6.5 19.5 5.5" stroke="#3b82f6" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <span className="font-bold text-sm" style={{ fontFamily: "inherit", background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>WealthTrack</span>
              </div>
              <p className="text-xs leading-relaxed max-w-[220px]" style={{ color: T.muted }}>
                L'outil de simulation patrimoniale pour comprendre et piloter vos finances.
              </p>
            </div>

            {/* Produit */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: T.text }}>Produit</h4>
              <ul className="space-y-2.5">
                <li><FooterLink href="#fonctionnalites">Tableau de bord</FooterLink></li>
                <li><FooterLink href="#fonctionnalites">Simulations patrimoniales</FooterLink></li>
                <li><FooterLink href="#fonctionnalites">Indépendance financière (FIRE)</FooterLink></li>
                <li><FooterLink href="#fonctionnalites">Immobilier</FooterLink></li>
                <li><FooterLink href="#fonctionnalites">Analyse des frais</FooterLink></li>
                <li><FooterLink href="#fonctionnalites">Crypto</FooterLink></li>
                <li><FooterLink href="#fonctionnalites">Mode Couple</FooterLink></li>
                <li><FooterLink href="#comment-ca-marche">Comment ça marche</FooterLink></li>
              </ul>
            </div>

            {/* À propos */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: T.text }}>À propos</h4>
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
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6 pt-8" style={{ borderTop: `1px solid ${T.border}` }}>
            {[
              { icon: ShieldCheck, label: "RGPD Compliant",          color: T.green },
              { icon: Database,    label: "Données locales par défaut", color: T.blue },
              { icon: EyeOff,      label: "Aucun tracking",          color: T.blue },
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

          <p className="text-xs max-w-2xl mx-auto text-center leading-relaxed mb-4" style={{ color: T.subtle2 }}>
            WealthTrack est un outil d'aide à la décision financière à caractère pédagogique. Il ne constitue pas un conseil en investissement au sens des articles L. 321-1 et suivants du Code monétaire et financier, ni au sens de la réglementation AMF. Les simulations sont fournies à titre indicatif et ne garantissent pas les performances futures. Pour tout conseil personnalisé, consultez un professionnel agréé (CIF, CGP, expert-comptable).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-3" style={{ color: T.subtle2 }}>
            <span>© 2026 WealthTrack</span>
          </div>
          <p className="text-center" style={{ color: T.subtle3, fontSize: 10 }}>
            Les performances passées ne préjugent pas des performances futures · Tout investissement comporte un risque de perte en capital
          </p>
        </div>
      </footer>
      </div>

      {legalModal && <LegalModal id={legalModal} onClose={() => setLegalModal(null)} />}
      {showPourquoi && <PourquoiModal onClose={() => setShowPourquoi(false)} />}

      <AIChatWidget onSignup={onStart} />

    </div>
  );
}
