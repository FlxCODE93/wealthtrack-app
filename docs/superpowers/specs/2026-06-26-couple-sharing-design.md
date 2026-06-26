# Partage de compte Couple / Famille — Design

Date : 2026-06-26
Statut : validé (brainstorming)

## Problème

Le mode « Couple / Famille » (plan payant) ne fait que **simuler** le partage.
Le composant `Couple` (`src/App.jsx`, ~ligne 3525) sélectionne un « partenaire »
parmi `TEST_PROFILES` (données mockées de `src/seedData.js`). Aucun partage réel
de données entre deux comptes utilisateurs n'existe.

Objectif : permettre à deux comptes Supabase liés de partager leur patrimoine
(net worth + épargne mensuelle) en lecture seule, avec consentement explicite du
partenaire et isolation stricte par RLS.

## Décisions produit (verrouillées)

| Décision | Choix |
|----------|-------|
| Initiation du lien | L'acheteur du plan Couple saisit l'**email** du partenaire (jamais son mot de passe). |
| Consentement | Le partenaire doit **accepter dans l'app** avant tout partage. |
| Données partagées | Minimal : `firstName`, `netWorth`, `monthly` (épargne mensuelle). |
| Fraîcheur | Fetch à l'ouverture de l'onglet + bouton rafraîchir (pas de realtime). |
| Couverture plan | Le plan Couple de l'acheteur couvre les 2 : le partenaire accède à la vue Couple même en plan gratuit. Seul un plan Couple peut **initier** un lien. |
| Cardinalité | Un seul couple actif par utilisateur (MVP). |

## Architecture

### Table `couple_links`

```sql
create table public.couple_links (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  partner_email text not null,
  partner_id    uuid references auth.users(id) on delete cascade,
  status        text not null default 'pending',  -- pending | accepted | declined
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

**Résolution email → user sans edge function ni énumération.** L'acheteur insère
une ligne `pending` avec uniquement `partner_email`. Le partenaire se découvre
lui-même via son email JWT (`auth.jwt()->>'email'`). Si l'email saisi n'est
jamais celui d'un utilisateur connecté, la ligne reste `pending` sans effet — on
ne révèle jamais si un email est inscrit.

**Unicité (un couple actif par user).** Index uniques partiels :

```sql
create unique index couple_links_requester_active
  on public.couple_links (requester_id) where status in ('pending','accepted');
create unique index couple_links_partner_active
  on public.couple_links (partner_id)   where status = 'accepted';
```

### Données partagées : blob curaté `wt_couple_share`

Plutôt que d'exposer le `wt_patrimoine` brut (toutes les lignes d'actifs/passifs),
chaque membre publie **un seul blob minimal** dans `user_data` sous la clé
`wt_couple_share` :

```json
{ "firstName": "Alex", "netWorth": 142000, "monthly": 800 }
```

C'est exactement ce que le composant `Couple` consomme (totaux, pas le détail).
Le partenaire ne voit jamais les lignes individuelles. `isSyncableKey` doit déjà
couvrir `wt_*` ; vérifier que `wt_couple_share` est bien synchronisable.

### RLS

`couple_links` (RLS activée) :

```sql
-- SELECT : requester, partenaire résolu, OU destinataire en attente (par email)
create policy couple_links_select on public.couple_links for select
  using (auth.uid() = requester_id
      or auth.uid() = partner_id
      or (auth.jwt()->>'email') = partner_email);

-- INSERT : on ne crée un lien que pour soi-même comme requester
create policy couple_links_insert on public.couple_links for insert
  with check (auth.uid() = requester_id);

-- UPDATE : le destinataire accepte/refuse (pose partner_id = lui-même) ;
-- le requester peut aussi mettre à jour (annuler). On borne via WITH CHECK.
create policy couple_links_update on public.couple_links for update
  using (auth.uid() = requester_id
      or auth.uid() = partner_id
      or (auth.jwt()->>'email') = partner_email)
  with check (auth.uid() = requester_id
      or auth.uid() = partner_id);

-- DELETE (délier) : l'un ou l'autre
create policy couple_links_delete on public.couple_links for delete
  using (auth.uid() = requester_id or auth.uid() = partner_id);
```

`user_data` — nouvelle policy SELECT, **uniquement** la clé `wt_couple_share`,
**uniquement** si un lien accepté existe entre les deux `user_id` :

```sql
create policy user_data_select_partner on public.user_data for select
  using (
    key = 'wt_couple_share'
    and exists (
      select 1 from public.couple_links cl
      where cl.status = 'accepted'
        and ((cl.requester_id = auth.uid() and cl.partner_id = user_data.user_id)
          or (cl.partner_id   = auth.uid() and cl.requester_id = user_data.user_id))
    )
  );
```

Les policies `user_data_*_own` existantes restent inchangées. La nouvelle policy
n'ajoute QUE de la lecture, QUE d'une clé, QUE pour un partenaire accepté.
Délier (DELETE de `couple_links`) coupe l'accès instantanément (l'`exists`
ne matche plus).

## Flux UI

| État | Acheteur (plan Couple) | Partenaire |
|------|------------------------|-----------|
| Aucun lien | Champ email + bouton « Inviter » | — |
| `pending` (sortant) | « En attente de l'acceptation de <email> » + Annuler | — |
| `pending` (entrant) | — | **Bannière niveau App** : « <prénom/email> souhaite lier vos comptes » → Accepter / Refuser (fonctionne en plan gratuit) |
| `accepted` | Patrimoines combinés (blob partenaire) + Délier | Idem + Délier |
| `declined` | « Invitation refusée » + supprimer/réessayer | — |

**Gating onglet Couple** : visible si `coupleMode && (plan === 'couple' || lienAccepté)`.
La bannière d'acceptation est au niveau App (pas dans l'onglet gated) pour qu'un
partenaire en plan gratuit puisse accepter.

## Surfaces de code

### `src/storage.js`
- `createCoupleLink(partnerEmail)` — insert `pending`.
- `getCoupleLink()` — récupère le lien de l'utilisateur (requester, partner, ou pending par email).
- `acceptCoupleLink(id)` / `declineCoupleLink(id)` — update status (+ partner_id à l'accept).
- `unlinkCouple(id)` — delete.
- `fetchPartnerShare(partnerId)` — lit `wt_couple_share` du partenaire dans `user_data`.
- `upsertMyShare({ firstName, netWorth, monthly })` — écrit/maj son propre blob.

### Helper pur (testable, hors React/Supabase)
`coupleLinkState(link, userId, email)` →
`'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'declined'`.
Centralise la logique d'état pour l'UI et les tests.

### `src/App.jsx`
- `Couple` : suppression de `TEST_PROFILES`, branchement sur l'état réel + états
  vides / chargement / erreur.
- Bannière d'acceptation au niveau App (lue depuis `getCoupleLink()`).
- `useEffect` : upsert automatique de `wt_couple_share` quand le net worth /
  épargne mensuelle changent ET qu'un lien existe.
- Gating onglet Couple mis à jour (`|| lienAccepté`).
- Retrait de l'import `TEST_PROFILES` s'il n'est plus utilisé ailleurs.

### `supabase/schema.sql`
- Ajout table `couple_links` + index + policies + nouvelle policy `user_data`.

## Tests

- **Unitaires (vitest)** :
  - `coupleLinkState` : toutes les transitions (none / sortant / entrant / accepté / refusé), des deux points de vue.
  - Calcul du blob : net worth = Σ actifs − Σ passifs depuis un `patrimoine` donné.
- **RLS — checklist manuelle** (pas de Supabase live en CI), documentée :
  1. User A crée un lien vers l'email de B → B voit la demande, un tiers C ne la voit pas.
  2. Tant que `pending`, A ne lit PAS le `wt_couple_share` de B.
  3. Après accept, A lit `wt_couple_share` de B (et inversement) — mais AUCUNE autre clé de B.
  4. Un tiers C ne lit jamais `wt_couple_share` de A ni de B.
  5. Après `unlinkCouple`, A ne lit plus rien de B (accès coupé immédiatement).

## Sécurité / vie privée

- Jamais de mot de passe d'autrui saisi.
- Partage conditionné au consentement explicite (status `accepted`).
- Surface minimale : une seule clé, des totaux, pas le détail patrimonial.
- Isolation appareil partagé déjà gérée (purge localStorage au changement de compte).
- Le plan reste la source de vérité côté `subscriptions` (Stripe) ; le lien ne
  modifie jamais le plan, il débloque seulement l'accès en lecture à la vue Couple.

## Hors périmètre (YAGNI)

- Realtime (souscription live).
- Plus de 2 membres (« Famille » à >2 — réservé à une itération ultérieure).
- Partage des transactions détaillées / budget (décidé : non).
- Édition croisée (lecture seule uniquement).
