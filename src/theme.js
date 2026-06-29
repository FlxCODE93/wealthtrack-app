export const C = {
  // Bleu nuit institutionnel — plus sobre, moins violet, plus rassurant
  bg:        "#0f111a",        // Blue-navy profond (institutionnel)
  panel:     "#111622",        // Surface section
  card:      "#151a28",        // Carte élevée
  border:    "rgba(255,255,255,0.06)",  // Subtle glass divider
  text:      "#f8fafc",        // Pale white (not pure white)
  muted:     "#94a3b8",        // Secondary/muted text

  // Primary Palette
  amber:     "#f59e0b",        // Gold trust (primary)
  violet:    "#8b5cf6",        // Purple tech (accent)
  cyan:      "#0891b2",        // Calm cyan (alt accent)

  // Semantic Colors
  green:     "#10b981",        // Emerald success
  greenSoft: "#34d399",        // Lighter emerald
  blue:      "#3b82f6",        // Professional blue
  red:       "#ef4444",        // Destructive/alert

  // Texte décroissant en discrétion (le plus visible → le plus discret)
  subtle1:   "#334155",
  subtle2:   "#1e293b",
  subtle3:   "#0f172a",

  // Voiles translucides (overlays clairs sur fond sombre)
  veil1:       "rgba(255,255,255,0.02)",
  veil2:       "rgba(255,255,255,0.03)",
  veil3:       "rgba(255,255,255,0.04)",
  veil4:       "rgba(255,255,255,0.06)",
  veilBorder:  "rgba(255,255,255,0.16)",

  // Couleur du "flash" qui balaie le texte animé (wt-shiny-text)
  shineAccent: "#ffffff",
};

// Mesh gradient hero — plus sobre, moins violet, plus institutionnel
C.bgGradient = `
  radial-gradient(ellipse 1000px 560px at 15% 0%, rgba(79, 70, 229, 0.14), transparent 55%),
  radial-gradient(ellipse 780px 440px at 85% 18%, rgba(59, 130, 246, 0.09), transparent 58%),
  radial-gradient(ellipse 700px 360px at 50% 100%, rgba(139, 92, 246, 0.07), transparent 62%),
  radial-gradient(ellipse 620px 340px at 95% 80%, rgba(8, 145, 178, 0.06), transparent 60%),
  ${C.bg}
`;

// Brand gradient — bleu navy institutionnel
C.gradientPrimary = "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)";

// ─────────────────────────────────────────────────────────────────
// Light Mode — même structure que C, surfaces et textes inversés
// ─────────────────────────────────────────────────────────────────
export const CL = {
  bg:        "#ffffff",
  panel:     "#ffffff",        // Cartes blanches, distinguées par bordure + ombre
  card:      "#f8fafc",        // Surface imbriquée, légèrement en retrait
  border:    "#e2e8f0",        // Séparateurs discrets
  text:      "#0f172a",        // Quasi-noir
  muted:     "#64748b",        // Texte secondaire

  amber:     "#f59e0b",
  violet:    "#8b5cf6",
  cyan:      "#0891b2",

  green:     "#10b981",
  greenSoft: "#34d399",
  blue:      "#3b82f6",
  red:       "#ef4444",

  subtle1:   "#94a3b8",
  subtle2:   "#cbd5e1",
  subtle3:   "#e2e8f0",

  veil1:       "rgba(15,23,42,0.02)",
  veil2:       "rgba(15,23,42,0.03)",
  veil3:       "rgba(15,23,42,0.04)",
  veil4:       "rgba(15,23,42,0.05)",
  veilBorder:  "rgba(15,23,42,0.15)",

  shineAccent: "#0f172a",
};

CL.bgGradient = `
  radial-gradient(ellipse 900px 500px at 20% 10%, rgba(124, 58, 237, 0.07), transparent 50%),
  radial-gradient(ellipse 700px 400px at 80% 30%, rgba(8, 145, 178, 0.05), transparent 55%),
  radial-gradient(ellipse 600px 300px at 50% 100%, rgba(79, 70, 229, 0.05), transparent 60%),
  ${CL.bg}
`;

CL.gradientPrimary = "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)";

// ─────────────────────────────────────────────────────────────────
// Couleurs canoniques par classe d'actif — UNE couleur par actif,
// utilisée partout (graphiques, légendes, allocations, tableaux).
// Choix distincts : vert / cyan / gris / or-BTC / bleu-ETH.
// ─────────────────────────────────────────────────────────────────
export const ASSET = {
  etf:    "#a78bfa",   // ETF World — violet clair (couleur phare de marque)
  immo:   "#4f46e5",   // Immobilier — indigo profond
  livret: "#94a3b8",   // Livret A — gris-bleu neutre (défensif)
  btc:    "#38bdf8",   // Bitcoin — cyan vif
  eth:    "#f1f5f9",   // Ethereum — blanc cassé
};

// Halo lumineux diffus autour d'un élément (focus / accent) — réduit pour sobriété
export const glow = (color, size = 32, alpha = "28") => `0 0 ${size}px ${color}${alpha}`;

export const eur = (n) =>
  n == null ? "—" :
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
