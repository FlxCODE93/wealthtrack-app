export const C = {
  // OLED Dark Mode + Glassmorphism
  bg:        "#0f172a",        // OLED near-black
  panel:     "#222735",        // Card surface (glassmorphism base)
  card:      "#2d3748",        // Elevated surface
  border:    "#334155",        // Subtle dividers
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
};

// Mesh gradient hero — blue + purple + subtle gold
C.bgGradient = `
  radial-gradient(ellipse 900px 500px at 20% 10%, rgba(139, 92, 246, 0.15), transparent 50%),
  radial-gradient(ellipse 700px 400px at 80% 30%, rgba(8, 145, 178, 0.10), transparent 55%),
  radial-gradient(ellipse 600px 300px at 50% 100%, rgba(245, 158, 11, 0.08), transparent 60%),
  ${C.bg}
`;

// Glassmorphism gradient — gold + purple
C.gradientPrimary = "linear-gradient(135deg, #f59e0b 0%, #8b5cf6 100%)";

// Halo lumineux diffus autour d'un élément (focus / accent)
export const glow = (color, size = 40, alpha = "55") => `0 0 ${size}px ${color}${alpha}`;

export const eur = (n) =>
  n == null ? "—" :
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " €";
