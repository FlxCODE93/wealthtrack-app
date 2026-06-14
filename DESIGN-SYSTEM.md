---
name: WealthTrack Design System
version: 1.0.0
type: fintech-personal-finance
generated-by: UI/UX Pro Max + Magic MCP
description: Glassmorphism + Dark Mode (OLED) design system for personal finance app with portfolio tracking and simulations
---

# WealthTrack Design System

## Overview

WealthTrack is a **Personal Finance Tracker** built with:
- **Primary Style:** Glassmorphism + Dark Mode (OLED)
- **Secondary Styles:** Minimalism, Flat Design
- **Pattern:** Interactive Product Demo + Financial Dashboard
- **Tone:** Methodical, data-driven, professional, accessible

---

## Color Palette

### Primary Colors
- **Primary:** `#F59E0B` (Gold/Amber) — Trust, financial stability
- **On Primary:** `#0F172A` (Near-black) — High contrast text
- **Secondary:** `#8B5CF6` (Purple) — Tech innovation, intelligence
- **On Secondary:** `#FFFFFF` (White) — High contrast on accent

### Semantic Colors
- **Success:** `#10B981` (Emerald) — Positive gains, growth
- **Warning:** `#F59E0B` (Amber) — Caution, attention needed
- **Destructive:** `#EF4444` (Red) — Losses, critical alerts
- **On Destructive:** `#FFFFFF` (White) — High contrast

### Background & Surfaces
- **Background:** `#0F172A` (OLED near-black) — Page floor
- **Surface (Card):** `#222735` (Subtle elevation) — Raised containers
- **Surface Elevated:** `#2D3748` (Lighter) — Nested containers
- **Foreground (Text):** `#F8FAFC` (Pale white) — Primary text
- **Muted Foreground:** `#94A3B8` (Slate) — Secondary/muted text
- **Border:** `#334155` (Subtle dividers) — Lines, borders

### Alt Accent (Optional)
- **Alt Accent:** `#0891B2` (Cyan) — Alternative accent for real-time data
- **On Alt Accent:** `#FFFFFF` (White) — High contrast on cyan

---

## Typography

### Font Stack
```
Display:  "Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
Body:     "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
Mono:     "JetBrains Mono", "Fira Code", monospace
```

### Scale (px)
- **Display XL:** 56px / 700 / 1.1
- **Display L:** 40px / 700 / 1.15
- **Display M:** 32px / 700 / 1.2
- **Display S:** 24px / 600 / 1.3
- **Headline:** 20px / 600 / 1.4
- **Body:** 16px / 400 / 1.6
- **Body Small:** 14px / 400 / 1.6
- **Label:** 12px / 500 / 1.4 (uppercase, 0.5px tracking)

### Usage
- **Headlines:** Display M/L — confident, information-heavy
- **Body:** Regular 400 — readable, accessible
- **Labels:** Small, uppercase — CTAs, data labels
- **Numbers/Data:** Mono — precise, financial context

---

## Spacing System

**Base unit:** 4px

| Token | Size | Use |
|-------|------|-----|
| `xs` | 4px | Tight spacing |
| `sm` | 8px | Component gaps |
| `md` | 16px | Section padding |
| `lg` | 24px | Card padding |
| `xl` | 32px | Section margin |
| `2xl` | 48px | Large section gap |
| `3xl` | 64px | Major section separation |

---

## Components

### Buttons

**Primary CTA**
- Background: `#F59E0B` (Gold)
- Text: `#0F172A` (Near-black)
- Padding: 12px 24px
- Border Radius: 8px
- Font Weight: 600
- Height: 44px min

**Secondary CTA**
- Background: `#222735` (Card surface)
- Border: 1px solid `#334155`
- Text: `#F8FAFC` (Pale white)
- Padding: 12px 24px
- Border Radius: 8px
- Height: 44px min

**Ghost CTA**
- Background: transparent
- Border: 1px solid `#334155`
- Text: `#94A3B8` (Muted)
- Hover: Text → `#F8FAFC`, Border → `#8B5CF6`

### Cards

**Financial Card**
- Background: `#222735` (with glassmorphism overlay)
- Border: 1px solid `#334155`
- Backdrop Filter: blur(10px)
- Padding: 24px
- Border Radius: 12px
- Box Shadow: `0 8px 32px rgba(0,0,0,0.4)`

**Metric Card**
- Background: Linear gradient `#222735 → #2D3748`
- Border: 1px solid `#334155`
- Padding: 20px
- Border Radius: 12px
- Display: Large number + small label

**Chart Card**
- Background: `#222735`
- Padding: 24px
- Border Radius: 12px
- Chart area: Full width minus padding

### Inputs

**Text Input**
- Background: `#1A1F2E`
- Border: 1px solid `#334155`
- Text: `#F8FAFC`
- Padding: 12px 16px
- Border Radius: 8px
- Height: 44px
- Focus: Border → `#F59E0B`

**Focus State**
- Border: 2px solid `#F59E0B`
- Outline: none
- Background: `#222735`

### Glassmorphism Treatment

Used on:
- Hero overlay text
- Floating nav/filters
- Modal backdrops
- Layered surfaces

**Recipe:**
```css
background: rgba(34, 39, 53, 0.7); /* 70% opaque surface */
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
border: 1px solid rgba(51, 65, 85, 0.5);
```

---

## Layout Patterns

### Hero Section
- Full viewport height (min 600px)
- Background: Mesh gradient (blue + purple accents)
- Content: Centered, max-width 800px
- CTA: Primary button, high contrast

### Financial Dashboard
- Grid: 12-column, responsive
- Card grid: 3-col desktop, 2-col tablet, 1-col mobile
- Metric cards: Mixed sizes (2/3 width for main, 1/3 for KPIs)
- Chart cards: Full-width or 2-col

### Feature Section
- Alternating: Image + Text (left/right)
- Or: 3-column feature cards with icons
- Spacing between sections: 96px (3xl)

### Testimonial/Social Proof
- Max 3 cards per row
- Avatar: 40px, border-radius 50%
- Quote: `#94A3B8`, 18px line-height
- Author: `#F8FAFC`, 600 weight

---

## Motion & Interaction

### Transitions
- Default: `0.2s ease-in-out`
- Hover: Scale 1.02, shadow increase
- Active: Scale 0.98
- Disabled: Opacity 0.5, cursor not-allowed

### Entrance Animations
- Cards: Fade-in + slide-up (200ms stagger)
- Charts: Draw lines on load (400ms)
- Numbers: Count-up animation (1s)

### Scroll Behavior
- Sticky header: On scroll down
- Lazy-load: Charts, images below fold
- No infinite scroll — paginated

---

## Dark Mode / OLED Considerations

- **Pure blacks for OLED:** Use `#000000` or `#0F172A` (near-black) strategically
- **Avoid full white:** Use `#F8FAFC` instead of `#FFFFFF`
- **Reduced motion:** Respect `prefers-reduced-motion`
- **High contrast fallback:** For accessibility

---

## Accessibility

### WCAG AA Compliance
- Color contrast: 4.5:1 minimum (body text on bg)
- Focus indicators: 2px solid `#F59E0B`
- Touch targets: 44px × 44px minimum
- Font size: 16px minimum for body

### Keyboard Navigation
- Tab order: Logical, left-to-right
- Escape: Close modals, dropdowns
- Enter: Submit forms, activate buttons
- Arrow keys: Navigate data tables

### Semantic HTML
- Use `<button>` for buttons, not `<div>`
- Use `<nav>` for navigation
- Use `<main>` for content
- Use `<section>` for major divisions

---

## Responsive Breakpoints

| Device | Width | Changes |
|--------|-------|---------|
| Mobile | 320–640px | 1-col, hamburger nav |
| Tablet | 641–1024px | 2-col cards, sticky header |
| Desktop | 1025–1440px | 3-col cards, full layout |
| Wide | 1441px+ | Same as desktop, more breathing room |

---

## File Organization

```
src/
├── components/
│   ├── Button.jsx          # Primary, secondary, ghost variants
│   ├── Card.jsx            # Financial, metric, chart card types
│   ├── Input.jsx           # Text input with focus states
│   ├── Modal.jsx           # Glassmorphism modal
│   └── ...
├── styles/
│   ├── colors.css          # CSS variables for palette
│   ├── typography.css      # Font sizes, weights, line heights
│   ├── spacing.css         # Spacing tokens
│   └── animations.css      # Keyframes, transitions
├── theme.js                # Centralized theme constants
└── tailwind.config.js      # Tailwind configuration (if used)
```

---

## Implementation Notes

### Using CSS Variables
```css
:root {
  --color-primary: #F59E0B;
  --color-bg: #0F172A;
  --color-card: #222735;
  --color-text: #F8FAFC;
  --color-muted: #94A3B8;
  --radius-sm: 8px;
  --radius-md: 12px;
}
```

### Tailwind Configuration (if applicable)
```js
theme: {
  colors: {
    primary: '#F59E0B',
    secondary: '#8B5CF6',
    bg: '#0F172A',
    card: '#222735',
    text: '#F8FAFC',
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
  },
}
```

---

## Anti-Patterns (Avoid)

❌ **Do NOT:**
- Mix accent colors (gold + purple + cyan all as CTAs)
- Use pure `#FFFFFF` for text on dark — use `#F8FAFC`
- Make rounded corners too large (> 12px on cards)
- Add too many glassmorphism effects (max 2–3 per page)
- Break the spacing grid — always multiples of 4px
- Use decorative gradients on small elements
- Add shadows over 32px blur (readability loss)

✅ **DO:**
- Keep hierarchy clear: Gold (primary), Purple (accent), Cyan (secondary)
- Use consistent border radius: 8px (buttons), 12px (cards)
- Respect whitespace: `3xl` (96px) between major sections
- Ensure WCAG AA contrast on all text
- Test on OLED screens (burns in if used wrong)
- Keep animations snappy: < 300ms

---

## Future Iterations

- [ ] Add light mode variant (optional)
- [ ] Expand typography with variable fonts
- [ ] Create Figma component library
- [ ] Build Storybook for component showcase
- [ ] Document motion guidelines in detail
- [ ] Create testing checklist (a11y, responsive, performance)

---

**Last Updated:** 2026-06-15  
**Design Tool:** UI/UX Pro Max + Magic MCP  
**Framework:** React 18, Vite, Tailwind CSS
