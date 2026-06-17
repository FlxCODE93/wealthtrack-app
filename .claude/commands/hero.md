# WealthTrack — Animated Hero Prompt

Update or redesign the hero section in `src/Landing.jsx`.

## Brand Direction
Dark-luxury fintech. Ultra-dark palette (`#020617` bg). Violet/indigo brand gradient (`#7c3aed → #4f46e5`). No amber. No cyan. Restrained: violet, indigo, blue, green, red only.

## Typography
- H1: Lora serif, `font-bold`, `text-4xl sm:text-5xl md:text-7xl`
- Body: IBM Plex Sans
- H1 uses per-word gradient fill: `#a78bfa → #7c3aed → #4f46e5`
- "Décidez." uses `wt-shiny-text` with animated gradient sweep

## Animated Layers (stacked bottom → top)
1. **AnoAI** (`src/AnoAI.jsx`) — WebGL shader, diagonal violet light rays, `position: fixed, z-index: -1`
2. **HeroOrbs** — 3 ambient blobs (700/500/280px, `blur(80-130px)`, opacity 0.06–0.11), animate with `wt-orb-drift` keyframe (22–28s cycles). Colors: `#7c3aed`, `#4f46e5`, `#6366f1`
3. **HeroBackground** — mesh gradient overlay, top of page only, fades to transparent
4. **Content** (`z-index: 2`) — stagger animation via `.wt-stagger` parent + `.wt-slide-up` children

## Animation Classes (defined in `src/animations.css`)
- `wt-orb-drift` — slow 5-point drift, 17–28s, `willChange: transform`
- `wt-shiny-text` — gradient sweep on "Décidez.", 3.6s loop
- `wt-slide-up` — fade+translateY(16px→0), 0.6s ease-out
- `wt-stagger > *:nth-child(n)` — 60ms delay cascade
- `wt-hero-enter` — 0.8s entrance, nth-child stagger 100ms
- `wt-glow-pulse` — violet border breathe, 5s loop (on dashboard preview)
- All respect `prefers-reduced-motion: reduce`

## Mobile (designed, not shrunk)
- `text-left sm:text-center`
- One CTA only on mobile (`hidden sm:flex` on ghost button)
- CTA: `w-full sm:w-auto`
- Trust line on mobile: "Données locales · Gratuit · Pas de CB"
- Tagline subtext: `hidden sm:block`

## CTAs
- Primary: `background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)`, glow `rgba(124,58,237,0.33)`
- Ghost: transparent, `border: 1px solid T.border`, hover fills `T.veil4`
- Both use `<NeonGlow />` shimmer overlay component

## Content
```
H1: Simulez. Comprenez. Décidez.
Subtitle: Reliez vos comptes, et projetez votre patrimoine à 10, 20 ou 30 ans avant de prendre la moindre décision.
Tagline: Vision patrimoniale · PEA, AV, Crypto & Immo · Objectif FIRE
CTA primary: Commencer gratuitement →
CTA ghost: Voir la démonstration
Trust badge (desktop): Simulation uniquement · Non conseil en investissement (AMF)
Trust line (mobile): Données locales · Gratuit pour commencer · Pas de CB
```

## Key Files
- Hero section: `src/Landing.jsx` lines ~755–820
- `HeroOrbs` component: `src/Landing.jsx` (before `HeroBackground`)
- Animation keyframes: `src/animations.css`
- Theme tokens: `src/theme.js` (`C` = dark, `CL` = light)
- AnoAI shader: `src/AnoAI.jsx` (do not modify — it's the foundational background)
