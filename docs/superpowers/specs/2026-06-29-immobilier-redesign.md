# Immobilier — Redesign spec
Date: 2026-06-29

## Problèmes à corriger

1. **Navigation** — 3 boutons texte plats sans hiérarchie visuelle
2. **Présentation** — cartes empilées, KPIs noyés, pas de résumé en tête
3. **Fonctionnalités** — mode locatif sans graphique de projection
4. **Code** — ~1 000 lignes + ~50 useState dans App.jsx, 3 modes mélangés

## Design validé

Pattern : **mode cards + hero KPIs + sections accordéon**

### Mode selector
3 cartes cliquables en grille 3 colonnes :
- Icône Lucide (Home / Building2 / Key) dans carré 36px radius 9px
- Label uppercase 12px IBM Plex Sans
- Description muted 11px
- Mode actif : `border-color: rgba(59,130,246,0.4)` + barre bleue bas + fond `rgba(59,130,246,0.08)`
- Aucun emoji — icônes SVG uniquement

### Hero KPIs (par mode)
Strip horizontal `#111827` border glass, padding 24px 28px :
- 3–4 KPIs séparés par border-left glass
- label : 11px uppercase muted
- valeur : 28px font-weight 800 (amber / cyan / green selon type)
- sous-label : 11px muted
- Badge affordabilité (vert/rouge) à droite

### Sections accordéon
Chaque section = row fermée montrant : titre + valeur résumé + chevron.
Au clic → expand avec le contenu actuel (form fields + chart).
Barre couleur à gauche (3px) par thème de section :
- Capacité d'emprunt → cyan
- Paramètres → blue  
- Financement → amber
- Projection → green
- Rendement locatif → amber
- Cash-flow → cyan
- Imposition → violet

### Ajouts fonctionnels
- Mode locatif : ajouter graphique de projection (valeur bien + capital net) sur horizon locDuration — même pattern que résidence
- Hero locatif : rendement brut / cash-flow / patrimoine à terme
- Hero location : cash-flow avant impôt / après impôt / rendement net

## Refactoring code

Extraire `Immobilier` de App.jsx → `src/Immobilier.jsx`.  
3 sous-composants : `ResidenceMode`, `LocatifMode`, `LocationMode`.  
States groupés par mode (pas tous dans le parent).  
Props entrants : `totals, simParams, patrimoine, transactions, setView`.

## Design tokens (inchangés)
```
bg:     #0f111a   panel: #111827   card: #161b2e
border: rgba(255,255,255,0.06)
text:   #f8fafc   muted: #94a3b8
amber:  #f59e0b   blue: #3b82f6   cyan: #0891b2
green:  #10b981   red: #ef4444   violet: #8b5cf6
H1: Lora 700     body: IBM Plex Sans
```
