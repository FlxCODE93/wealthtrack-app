# Mes crédits — Design

**Date:** 2026-06-18
**Statut:** Validé, prêt pour plan d'implémentation

## Objectif

Nouvelle fonctionnalité "Mes crédits" : une page sidebar (sous Finances) où l'utilisateur
saisit et suit tous ses crédits en cours (immobilier, auto, conso, étudiant, perso, revolving).
Elle devient la source unique des dettes de type crédit, alimente automatiquement les passifs
du Patrimoine, et héberge l'outil d'arbitrage "rembourser ou investir ?" aujourd'hui logé dans
le Simulateur Immobilier.

## Décisions validées

1. **Source de vérité (hybride cadré)** — "Mes crédits" est la source unique des dettes-crédit.
   Elle *dérive* une catégorie passif `"Crédits"` injectée en lecture dans `patrimoine.passifs`,
   sans modifier les ~15 consommateurs existants du net worth / endettement / health.
   Patrimoine conserve sa saisie manuelle pour les dettes hors crédit (découvert, dette familiale).
2. **Calcul auto-amortissement** — l'utilisateur saisit capital, taux, durée, date de début ;
   on calcule mensualité, capital restant à date, intérêts restants, date de fin, coût total.
   Le revolving est un cas spécial (pas d'échéance fixe) : capital restant + mensualité saisis
   manuellement, intérêts calculés au taux.
3. **Arbitrage déplacé** — le mode `"credit"` est retiré du Simulateur Immobilier ;
   `CreditArbitrage` déménage dans "Mes crédits" comme action sur chaque crédit de type immo.
4. **Tier** — `free` (finance de base, au même niveau que Patrimoine).
5. **Revenu pour le taux d'endettement** — dérivé de `totals.revenus` (transactions `type:"revenu"`
   de Finances ; à terme alimentées par Plaid / import de relevé). Si `0`, le taux est masqué.

## Modèle de données

État: `const [credits, setCredits] = useLocalStorage("wt_credits", DEFAULT_CREDITS)`
(pattern existant, sync cloud automatique).

Un crédit:
```
{
  id,                    // unique
  type,                  // "immo" | "auto" | "conso" | "etudiant" | "perso" | "revolving"
  label,                 // libellé libre
  mode,                  // "amortissable" | "revolving"
  capitalInitial,        // € (mode amortissable)
  taux,                  // % annuel
  dureeMois,             // durée totale (mode amortissable)
  dateDebut,             // ISO date (mode amortissable)
  assuranceMensuelle,    // € / mois (optionnel)
  capitalRestant,        // € saisi directement (mode revolving uniquement)
  paiementMensuel,       // € saisi directement (mode revolving uniquement)
}
```

`DEFAULT_CREDITS = []` (liste vide au départ).

## Calculs (dans `finance.js`, testés)

- `mensualite(capital, tauxAnnuel, dureeMois)` — formule d'annuité standard.
  Cas taux = 0 → `capital / dureeMois`.
- `capitalRestant(credit, aujourdhui)` — capital restant dû à une date (amortissement).
- `interetsRestants(credit, aujourdhui)` — somme des intérêts restant à payer.
- `dateFin(credit)` — `dateDebut + dureeMois`.
- `coutTotal(credit)` — `mensualite * dureeMois - capitalInitial` (intérêts totaux).
- Revolving: `capitalRestant` et `paiementMensuel` lus tels quels ; intérêts mensuels = `capitalRestant * taux/12/100`.

## Intégration passifs

`creditsToPassifCategory(credits)` →
```
{ label: "Crédits", color: <couleur dette>, items: credits.map(c => ({ label: c.label, value: capitalRestantActuel(c) })) }
```
Injectée en lecture dérivée dans `patrimoine.passifs` au point de calcul du net worth.
Les consommateurs (`totalPassifs`, `debtRatio`, health, PDF) restent inchangés.

## UI — page `Credits`

Props: `credits`, `setCredits`, `monthlyIncome` (= `totals.revenus`).

- **Barre résumé**: total capital restant · mensualités totales / mois · intérêts restants cumulés ·
  taux d'endettement (`mensualités / monthlyIncome`, masqué si `monthlyIncome === 0` avec message
  "Connectez vos revenus dans Finances pour voir votre taux d'endettement").
- **Liste de cartes** par crédit: badge type coloré, barre de progression de remboursement
  (capital remboursé / initial), mensualité, échéance de fin.
- **Form ajout / édition** (réutilise `Field` + `makeInputStyle`). Le champ `mode` bascule
  l'affichage amortissable ↔ revolving.
- **Alerte revolving** si taux élevé (seuil indicatif, ex. > 15 %).
- Sur chaque crédit **immo**: bouton "Rembourser ou investir ?" ouvrant `CreditArbitrage`.

## Modifications du Simulateur Immobilier

- Retirer l'entrée `["credit", "Mon crédit immobilier", ...]` du toggle de mode.
- Retirer le rendu `{mode === "credit" && <CreditArbitrage />}`.
- `CreditArbitrage` reste exporté/réutilisable, appelé depuis Credits.

## Navigation & routing

- Sidebar: nouvel item `{ id: "credits", label: "Mes crédits", icon: CreditCard }` juste sous Finances.
- `PLAN_FEATURES`: ajouter `"credits"` aux trois tiers (free, pro, couple).
- Routing: `{view === "credits" && <Credits credits={credits} setCredits={setCredits} monthlyIncome={totals.revenus} />}`.
- Label mobile: `credits: "Crédits"`.

## Tests

`finance.test.js`:
- `mensualite` — cas standard, cas taux 0.
- `capitalRestant` — au début (= capital initial), à mi-parcours, à la fin (≈ 0).
- `interetsRestants` — décroît avec le temps.
- Revolving — intérêts mensuels au taux.

## Hors scope (YAGNI)

- Pas d'échéancier détaillé ligne par ligne (juste les agrégats).
- Pas de simulation de renégociation de taux.
- Pas d'intégration Plaid dans ce lot (le calcul consomme `totals.revenus` tel quel).
