# Revenu lissé (revenu variable) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utiliser un revenu mensuel de référence lissé (moyenne 12 mois de l'historique) pour les ratios de capacité/effort quand le revenu est variable, afin de fiabiliser l'app pour intérim/freelance.

**Architecture:** Trois helpers purs dans `finance.js` (moyenne, coefficient de variation, détection de variabilité), testés. Un snapshot mensuel automatique alimente `wt_histo` (sur le modèle de `wt_networth_snapshots`). Le composant racine calcule `incomeRef` et l'injecte dans Mes crédits + les alertes/recommandations charges/revenus, avec un libellé de transparence.

**Tech Stack:** React 18, Vite, Vitest, localStorage (`useLocalStorage`).

Spec : `docs/superpowers/specs/2026-06-18-revenu-lisse-design.md`.

---

## Task 1 : Helpers `finance.js` (purs, testés)

**Files:**
- Modify: `src/finance.js` (ajout en fin de fichier)
- Test: `src/finance.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `src/finance.test.js`. Mettre à jour l'import en tête pour inclure les 3 fonctions + constantes :

```js
// dans le bloc import { … } from "./finance.js";
  smoothedMonthlyIncome, incomeCV, isIncomeVariable,
  INCOME_CV_THRESHOLD, INCOME_MIN_MONTHS,
```

Tests :

```js
describe("revenu lissé", () => {
  // 12 mois, dont 3 à 0 € (freelance creux)
  const histoVar = [4000,0,3000,5000,0,4500,3500,0,4200,3800,5000,4000]
    .map((rev, i) => ({ m: `M${i}`, rev, dep: 1500, inv: 0 }));
  const histoStable = Array.from({ length: 12 }, (_, i) => ({ m: `M${i}`, rev: 3000, dep: 1500, inv: 0 }));

  it("smoothedMonthlyIncome = moyenne des rev sur la fenêtre (zéros inclus)", () => {
    const total = 4000+0+3000+5000+0+4500+3500+0+4200+3800+5000+4000;
    expect(smoothedMonthlyIncome(histoVar, 12)).toBeCloseTo(total / 12, 6);
  });
  it("smoothedMonthlyIncome ne prend que les N derniers mois", () => {
    expect(smoothedMonthlyIncome(histoStable, 3)).toBeCloseTo(3000, 6);
  });
  it("smoothedMonthlyIncome histo vide → 0", () => {
    expect(smoothedMonthlyIncome([], 12)).toBe(0);
  });
  it("incomeCV élevé pour revenus en dents de scie, ~0 pour constant", () => {
    expect(incomeCV(histoVar, 12)).toBeGreaterThan(INCOME_CV_THRESHOLD);
    expect(incomeCV(histoStable, 12)).toBeCloseTo(0, 6);
  });
  it("isIncomeVariable : vrai si CV > seuil sur ≥ 4 mois", () => {
    expect(isIncomeVariable(histoVar, "salarie_stable")).toBe(true);
  });
  it("isIncomeVariable : faux pour salarié stable régulier", () => {
    expect(isIncomeVariable(histoStable, "salarie_stable")).toBe(false);
  });
  it("isIncomeVariable : vrai par fallback profil même si CV faible", () => {
    expect(isIncomeVariable(histoStable, "independant")).toBe(true);
    expect(isIncomeVariable(histoStable, "interimaire")).toBe(true);
  });
  it("isIncomeVariable : faux si < 4 mois de données et profil stable", () => {
    const court = histoVar.slice(0, 3);
    expect(isIncomeVariable(court, "salarie_stable")).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/finance.test.js`
Expected: FAIL (`smoothedMonthlyIncome is not defined`, etc.)

- [ ] **Step 3 : Implémenter les helpers**

Ajouter à la fin de `src/finance.js` :

```js
/* ────────────────────────────────────────────────────────────────────
   Revenu lissé — base de référence pour les ratios quand le revenu varie
   (intérim, freelance). S'appuie sur l'historique mensuel `histo` (champ rev).
   ──────────────────────────────────────────────────────────────────── */
export const INCOME_CV_THRESHOLD = 0.25; // coefficient de variation au-delà duquel le revenu est dit variable
export const INCOME_MIN_MONTHS   = 4;    // minimum de mois de données pour juger de la variabilité

/** Moyenne des revenus mensuels sur les `months` dernières entrées (zéros inclus). */
export function smoothedMonthlyIncome(histo = [], months = 12) {
  const revs = histo.slice(-months).map((h) => +h.rev || 0);
  if (!revs.length) return 0;
  return revs.reduce((s, r) => s + r, 0) / revs.length;
}

/** Coefficient de variation (écart-type ÷ moyenne) des revenus sur la fenêtre. */
export function incomeCV(histo = [], months = 12) {
  const revs = histo.slice(-months).map((h) => +h.rev || 0);
  if (!revs.length) return 0;
  const mean = revs.reduce((s, r) => s + r, 0) / revs.length;
  if (mean === 0) return 0;
  const variance = revs.reduce((s, r) => s + (r - mean) ** 2, 0) / revs.length;
  return Math.sqrt(variance) / mean;
}

/** Revenu variable si CV > seuil sur ≥ INCOME_MIN_MONTHS mois, OU profil interim/indépendant. */
export function isIncomeVariable(histo = [], profileType = "", months = 12) {
  if (profileType === "interimaire" || profileType === "independant") return true;
  const n = Math.min(histo.length, months);
  if (n < INCOME_MIN_MONTHS) return false;
  return incomeCV(histo, months) > INCOME_CV_THRESHOLD;
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run src/finance.test.js`
Expected: PASS (tous, dont les nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add src/finance.js src/finance.test.js
git commit -m "feat(finance): helpers revenu lissé (moyenne, CV, détection variabilité)"
```

---

## Task 2 : Snapshot mensuel automatique du revenu dans `wt_histo`

**Files:**
- Modify: `src/App.jsx` (composant racine, près du snapshot net-worth `~6707-6723`)

**Contexte :** le snapshot net-worth ([App.jsx:6713](src/App.jsx#L6713)) sert de modèle (clé `ym`, label via `MOIS_ABBR`, mise à jour du mois courant). `totals` (revenus/chargesFixes/depensesVar/invest) et `histo`/`setHisto` sont déjà dans ce composant. Les entrées `HISTO` existantes ont `{ m, rev, dep, inv }` (sans `ym`).

- [ ] **Step 1 : Ajouter l'effet de snapshot revenu**

Juste après le `useEffect` du snapshot net-worth (après la ligne `}, [netWorthNow]);`), ajouter :

```jsx
  // Snapshot mensuel automatique du revenu/dépenses dans l'historique (rend wt_histo vivant).
  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MOIS_ABBR[now.getMonth()]} ${now.getFullYear()}`;
    const entry = {
      m: label, ym,
      rev: totals.revenus,
      dep: totals.chargesFixes + totals.depensesVar,
      inv: totals.invest,
    };
    setHisto((prev) => {
      const exists = prev.some((h) => h.ym === ym);
      if (exists) return prev.map((h) => (h.ym === ym ? { ...h, ...entry } : h));
      return [...prev, entry].slice(-120); // 10 ans max
    });
  }, [totals.revenus, totals.chargesFixes, totals.depensesVar, totals.invest]);
```

- [ ] **Step 2 : Vérifier le build**

Run: `npx vite build 2>&1 | tail -2`
Expected: `✓ built`.

- [ ] **Step 3 : Vérification manuelle**

Lancer l'app (serveur dev 5173). Aller dans Finances, modifier une transaction de revenu. Recharger le Dashboard : le graphe d'historique (« Évolution ») doit refléter le mois courant mis à jour, sans créer de doublon de mois.

- [ ] **Step 4 : Commit**

```bash
git add src/App.jsx
git commit -m "feat: snapshot mensuel auto du revenu dans l'historique"
```

---

## Task 3 : `incomeRef` + injection dans Mes crédits, alertes et recommandations

**Files:**
- Modify: `src/App.jsx`
  - import finance (~ligne 33-44)
  - composant racine : calcul `incomeRef`/`incomeIsSmoothed`, passage en props
  - `computeAlerts` (vers 1082) et recommandations (vers 6258) : dénominateur = `incomeRef`
  - `Credits` : prop `monthlyIncome` → libellé de transparence

- [ ] **Step 1 : Importer les helpers**

Dans le bloc `import { … } from "./finance.js";`, ajouter :

```js
  smoothedMonthlyIncome, isIncomeVariable,
```

- [ ] **Step 2 : Calculer `incomeRef` dans le composant racine**

Dans le composant racine, après la définition de `totals` (et `detectProfileType` est déjà disponible), ajouter :

```jsx
  const incomeProfileType = useMemo(() => detectProfileType(transactions || []), [transactions]);
  const incomeIsSmoothed  = useMemo(() => isIncomeVariable(histo, incomeProfileType), [histo, incomeProfileType]);
  const incomeRef = useMemo(
    () => (incomeIsSmoothed ? Math.round(smoothedMonthlyIncome(histo, 12)) : totals.revenus),
    [incomeIsSmoothed, histo, totals.revenus]
  );
```

- [ ] **Step 3 : Passer `incomeRef`/`incomeIsSmoothed` à Mes crédits**

Modifier le rendu de la vue `credits` :

```jsx
{view === "credits" && <Credits credits={credits} setCredits={setCredits} monthlyIncome={incomeRef} incomeIsSmoothed={incomeIsSmoothed} setView={setView} />}
```

- [ ] **Step 4 : Libellé de transparence dans Credits**

Dans `function Credits({ credits, setCredits, monthlyIncome = 0, setView })`, ajouter la prop `incomeIsSmoothed = false`. Dans le KPI « Taux d'effort », remplacer le sous-titre du cas non-null :

```jsx
            : <span style={{ color: T.muted }}>{incomeIsSmoothed ? "basé sur votre revenu moyen (12 mois) · seuil 35 %" : "mensualités ÷ revenus · seuil 35 %"}</span>} />
```

- [ ] **Step 5 : Utiliser `incomeRef` dans les alertes charges/revenus**

`computeAlerts` reçoit `totals`. Lui passer aussi `incomeRef`. À l'appel de `computeAlerts(...)`, ajouter l'argument ; dans la signature, ajouter `incomeRef`. Puis remplacer la ligne charges (vers [App.jsx:1082](src/App.jsx#L1082)) :

```jsx
  if (incomeRef > 0 && totals.chargesFixes > incomeRef * 0.55) alerts.push({ level: "red", msg: `Charges fixes élevées (${Math.round((totals.chargesFixes / incomeRef) * 100)}% des revenus${incomeIsSmoothedArg ? " — moyenne 12 mois" : ""}) — marge de manœuvre réduite`, feature: "simulations" });
```

Si `computeAlerts` n'a pas accès à `incomeIsSmoothed`, passer aussi ce booléen en argument (`incomeIsSmoothedArg`). Sinon retirer la portion de message conditionnelle et garder `incomeRef` seul comme dénominateur.

- [ ] **Step 6 : Utiliser `incomeRef` dans les recommandations**

Dans le `useMemo` des recommandations (vers [App.jsx:6258](src/App.jsx#L6258)), il faut `incomeRef` dans le scope. S'il est défini dans le même composant, l'utiliser directement ; sinon le passer. Remplacer :

```jsx
    if (incomeRef > 0 && totals.chargesFixes > incomeRef * 0.6)
      out.push({ id: "heavy_charges",    level: "amber", msg: `Charges fixes très lourdes (${Math.round((totals.chargesFixes / incomeRef) * 100)}% des revenus) — peu de marge de manœuvre.` });
```

Ajouter `incomeRef` aux dépendances du `useMemo`.

- [ ] **Step 7 : Build + tests**

Run: `npx vite build 2>&1 | tail -2 && npx vitest run 2>&1 | tail -3`
Expected: `✓ built` et tous les tests PASS.

- [ ] **Step 8 : Vérification manuelle**

Injecter un profil indépendant/intérim (ou créer un historique en dents de scie via plusieurs mois), aller dans Mes crédits : le « Taux d'effort » doit afficher « basé sur votre revenu moyen (12 mois) » et utiliser la moyenne, pas le mois courant. Pour un profil salarié régulier : libellé et valeur inchangés (mois courant).

- [ ] **Step 9 : Commit**

```bash
git add src/App.jsx
git commit -m "feat: revenu de référence lissé dans taux d'effort, alertes et recommandations"
```

---

## Task 4 : Vérification finale

- [ ] **Step 1 : Suite complète**

Run: `npx vitest run 2>&1 | tail -3`
Expected: tous PASS.

- [ ] **Step 2 : Build production**

Run: `npx vite build 2>&1 | tail -2`
Expected: `✓ built`.

---

## Self-review (couverture spec)

- §1 `wt_histo` vivant → Task 2. ✓
- §2 helpers (`smoothedMonthlyIncome`, `incomeCV`, `isIncomeVariable`, constantes) → Task 1. ✓
- §3 `incomeRef` + injection Mes crédits / alertes / recommandations ; `tauxEpargne` non touché → Task 3. ✓
- §4 UX libellé de transparence → Task 3 Step 4. ✓
- §5 tests → Task 1 Step 1. ✓
- Hors scope (dépenses, Plaid, rétroactif, toggle) → non planifié. ✓
