# Revenu lissé (revenu variable) — Design

**Date:** 2026-06-18
**Statut:** Validé, prêt pour plan d'implémentation

## Objectif

Rendre WealthTrack fiable pour les revenus irréguliers (intérim, freelance/indépendant).
Aujourd'hui tous les ratios reposent sur le revenu du mois courant (somme des transactions,
sans dimension temporelle) : un mois à 0 € fausse l'endettement, le taux d'épargne et la
capacité. On introduit un **revenu de référence lissé** = moyenne des 12 derniers mois,
utilisé automatiquement quand le revenu est détecté comme variable.

## Décisions validées

1. **Source** : moyenne du champ `rev` de `wt_histo` (historique mensuel).
2. **Activation** : automatique si variabilité détectée (pas de toggle manuel).
3. **Fenêtre** : 12 mois glissants, **zéros inclus** (reflète la vraie moyenne annuelle).
4. **Snapshot mensuel auto** : `wt_histo` doit devenir vivant (voir §1).

## 1. Pré-requis — `wt_histo` vivant (snapshot mensuel auto)

`wt_histo` n'est aujourd'hui ni alimenté ni mis à jour (seed/injection profil seulement).
Sans données réelles, la moyenne serait fictive. On ajoute un snapshot mensuel automatique,
sur le modèle de `wt_networth_snapshots` :

- Au chargement (et quand `totals` change), calculer la clé mois courant `m` (ex. "juin 2026"
  via `toLocaleDateString("fr-FR", { month: "short", year: "numeric" })`, cohérent avec le
  format existant de `HISTO`).
- Mettre à jour l'entrée du mois courant dans `histo`, ou l'ajouter si absente :
  `{ m, rev: totals.revenus, dep: totals.chargesFixes + totals.depensesVar, inv: totals.invest }`.
- Conserver l'ordre chronologique ; ne jamais réécrire les mois passés (sauf le mois courant).
- Effet : l'historique se construit réellement mois après mois.

## 2. `finance.js` (pur, testé)

- `smoothedMonthlyIncome(histo, months = 12)` : moyenne des `rev` des `months` dernières
  entrées de `histo` (zéros inclus). Si `histo` vide → 0.
- `incomeCV(histo, months = 12)` : coefficient de variation (écart-type ÷ moyenne) des `rev`
  sur la fenêtre. Moyenne 0 → 0.
- `isIncomeVariable(histo, profileType, months = 12)` :
  `true` si `incomeCV > 0.25` sur **≥ 4 mois** de données, **ou** si `profileType` ∈
  `{ "interimaire", "independant" }`. Sinon `false`.

Constantes : seuil CV `INCOME_CV_THRESHOLD = 0.25`, minimum de mois `INCOME_MIN_MONTHS = 4`.

## 3. App — `incomeRef`

Dans le composant racine (où vivent `totals`, `histo`, `profileType`) :

```
const incomeIsSmoothed = isIncomeVariable(histo, profileType);
const smoothed = smoothedMonthlyIncome(histo, 12);
const incomeRef = incomeIsSmoothed ? smoothed : totals.revenus;
```

`incomeRef` est le revenu mensuel de référence pour les ratios de **capacité / effort** :

- **Mes crédits** : `monthlyIncome = incomeRef` (taux d'effort).
- **Alertes** charges/revenus ([App.jsx:1082]) : utiliser `incomeRef` au dénominateur
  (garde `incomeRef > 0` déjà en place).
- **Recommandations** charges/revenus ([App.jsx:6258]) : idem.

Non touché :
- `tauxEpargne` (métrique « du mois », par nature) — reste sur le mois courant.
- FIRE, Patrimoine, simulateurs.

## 4. UX / affichage

- Quand `incomeIsSmoothed` est vrai, afficher un libellé discret « basé sur votre revenu
  moyen (12 mois) » :
  - sous le taux d'effort dans Mes crédits (remplace/complète « mensualités ÷ revenus · seuil 35 % ») ;
  - en note sur les alertes charges/revenus concernées.
- CDI stable (CV faible, profil salarié) : aucun changement visible (mois courant).

## 5. Tests (`finance.test.js`)

- `smoothedMonthlyIncome` : moyenne correcte sur 12 mois ; zéros inclus tirent la moyenne
  vers le bas ; fenêtre < 12 (prend ce qui existe) ; histo vide → 0.
- `incomeCV` : élevé pour revenus en dents de scie, ~0 pour revenu constant.
- `isIncomeVariable` : vrai si CV > seuil sur ≥ 4 mois ; vrai par fallback profil
  (interim/indépendant) même CV faible ; faux pour salarié stable régulier ;
  faux si < 4 mois de données et profil stable.

## Hors scope (YAGNI)

- Lissage des dépenses et du `tauxEpargne`.
- Import daté / Plaid (le snapshot mensuel suffit à bâtir l'historique).
- Réécriture rétroactive de `histo` (construction à partir de maintenant).
- Toggle manuel d'activation.
