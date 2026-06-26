# Partage de compte Couple / Famille — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la simulation `TEST_PROFILES` du mode Couple par un vrai partage patrimonial entre deux comptes Supabase liés (email + acceptation), en lecture seule et isolé par RLS.

**Architecture:** Une table `couple_links` (RLS) modélise le lien. Chaque membre publie un blob minimal `wt_couple_share` (`firstName`/`netWorth`/`monthly`) dans `user_data` ; une policy RLS dédiée autorise le partenaire accepté à lire UNIQUEMENT cette clé. La logique d'état du lien vit dans un helper pur testable (`src/couple.js`) ; `storage.js` porte les appels Supabase ; `App.jsx` câble l'UI (onglet Couple + bannière d'acceptation niveau App).

**Tech Stack:** React 18, Supabase (Postgres + RLS), Vitest, Vite.

---

## File Structure

- **Create** `src/couple.js` — helpers purs : `coupleLinkState(link, userId, email)`, `shareFromPatrimoine(patrimoine, profile, monthly)`.
- **Create** `src/couple.test.js` — tests unitaires des helpers purs.
- **Modify** `src/storage.js` — appels Supabase : create/get/accept/decline/unlink + fetch/upsert share.
- **Modify** `src/App.jsx` — refonte composant `Couple`, bannière d'acceptation niveau App, gating onglet, upsert auto du share.
- **Modify** `supabase/schema.sql` — table `couple_links`, index, policies, policy partenaire sur `user_data`.

Référence spec : `docs/superpowers/specs/2026-06-26-couple-sharing-design.md`.

---

## Task 1 : Helpers purs (état du lien + blob de partage)

**Files:**
- Create: `src/couple.js`
- Test: `src/couple.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
// src/couple.test.js
import { describe, it, expect } from "vitest";
import { coupleLinkState, shareFromPatrimoine } from "./couple.js";

const ME = "user-me";
const OTHER = "user-other";
const MY_EMAIL = "me@example.com";
const PARTNER_EMAIL = "partner@example.com";

describe("coupleLinkState", () => {
  it("retourne 'none' si aucun lien", () => {
    expect(coupleLinkState(null, ME, MY_EMAIL)).toBe("none");
    expect(coupleLinkState(undefined, ME, MY_EMAIL)).toBe("none");
  });

  it("'pending_outgoing' quand je suis le requester d'un lien pending", () => {
    const link = { status: "pending", requester_id: ME, partner_id: null, partner_email: PARTNER_EMAIL };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("pending_outgoing");
  });

  it("'pending_incoming' quand le lien pending vise mon email", () => {
    const link = { status: "pending", requester_id: OTHER, partner_id: null, partner_email: MY_EMAIL };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("pending_incoming");
  });

  it("compare les emails sans tenir compte de la casse", () => {
    const link = { status: "pending", requester_id: OTHER, partner_id: null, partner_email: "ME@Example.com" };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("pending_incoming");
  });

  it("'accepted' quand le lien est accepté et me concerne", () => {
    const asReq = { status: "accepted", requester_id: ME, partner_id: OTHER, partner_email: PARTNER_EMAIL };
    const asPart = { status: "accepted", requester_id: OTHER, partner_id: ME, partner_email: MY_EMAIL };
    expect(coupleLinkState(asReq, ME, MY_EMAIL)).toBe("accepted");
    expect(coupleLinkState(asPart, ME, MY_EMAIL)).toBe("accepted");
  });

  it("'declined' quand le requester voit son lien refusé", () => {
    const link = { status: "declined", requester_id: ME, partner_id: null, partner_email: PARTNER_EMAIL };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("declined");
  });

  it("'none' si le lien ne me concerne pas", () => {
    const link = { status: "pending", requester_id: OTHER, partner_id: null, partner_email: "tiers@example.com" };
    expect(coupleLinkState(link, ME, MY_EMAIL)).toBe("none");
  });
});

describe("shareFromPatrimoine", () => {
  const patrimoine = {
    actifs:  [{ items: [{ value: 100000 }, { value: 50000 }] }, { items: [{ value: 20000 }] }],
    passifs: [{ items: [{ value: 30000 }] }],
  };

  it("calcule netWorth = Σ actifs − Σ passifs", () => {
    const s = shareFromPatrimoine(patrimoine, { firstName: "Alex" }, 800);
    expect(s).toEqual({ firstName: "Alex", netWorth: 140000, monthly: 800 });
  });

  it("tolère un patrimoine vide / valeurs manquantes", () => {
    expect(shareFromPatrimoine({}, {}, undefined)).toEqual({ firstName: "", netWorth: 0, monthly: 0 });
    expect(shareFromPatrimoine({ actifs: [], passifs: [] }, { firstName: "Sam" }, 0))
      .toEqual({ firstName: "Sam", netWorth: 0, monthly: 0 });
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npm test -- couple`
Expected: FAIL — `coupleLinkState is not a function` / `shareFromPatrimoine is not a function`.

- [ ] **Step 3 : Implémenter `src/couple.js`**

```js
/* Logique pure du mode Couple — sans React ni Supabase, donc testable seule. */

/** Normalise un email pour comparaison (trim + minuscules). */
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/**
 * État d'un lien de couple du point de vue de l'utilisateur courant.
 * @returns 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'declined'
 */
export function coupleLinkState(link, userId, email) {
  if (!link) return "none";
  const myEmail = normEmail(email);
  const isRequester = link.requester_id === userId;
  const isPartnerById = link.partner_id === userId;
  const targetsMyEmail = normEmail(link.partner_email) === myEmail;

  if (link.status === "accepted") {
    return isRequester || isPartnerById ? "accepted" : "none";
  }
  if (link.status === "declined") {
    return isRequester ? "declined" : "none";
  }
  // pending
  if (isRequester) return "pending_outgoing";
  if (isPartnerById || targetsMyEmail) return "pending_incoming";
  return "none";
}

/** Somme des `.value` de tous les items d'une liste de catégories. */
function sumItems(categories) {
  return (categories || [])
    .flatMap((c) => c.items || [])
    .reduce((s, i) => s + (Number(i.value) || 0), 0);
}

/** Blob minimal partagé avec le partenaire (totaux uniquement, pas le détail). */
export function shareFromPatrimoine(patrimoine, profile, monthly) {
  const actifs  = sumItems(patrimoine?.actifs);
  const passifs = sumItems(patrimoine?.passifs);
  return {
    firstName: (profile && profile.firstName) || "",
    netWorth: actifs - passifs,
    monthly: Number(monthly) || 0,
  };
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- couple`
Expected: PASS (tous les cas verts).

- [ ] **Step 5 : Commit**

```bash
git add src/couple.js src/couple.test.js
git commit -m "feat(couple): helpers purs état du lien + blob de partage"
```

---

## Task 2 : Schéma Supabase (table + RLS)

**Files:**
- Modify: `supabase/schema.sql` (append en fin de fichier)

> Pas de test automatisé (pas de Supabase live en CI). Vérification = relecture
> + checklist manuelle (Task 6). La RLS reproduit fidèlement la section 3 du spec.

- [ ] **Step 1 : Ajouter le bloc SQL en fin de `supabase/schema.sql`**

```sql


-- ════════════════════════════════════════════════════════════════════
-- LIENS DE COUPLE — partage patrimonial entre 2 comptes.
--
-- Flux : l'acheteur (plan Couple) insère une ligne `pending` avec l'email
-- du partenaire. Le partenaire se découvre via son email JWT et accepte
-- (pose partner_id = lui-même, status = accepted). Aucun mot de passe
-- d'autrui, aucune énumération d'emails.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.couple_links (
  id            uuid        primary key default gen_random_uuid(),
  requester_id  uuid        not null references auth.users (id) on delete cascade,
  partner_email text        not null,
  partner_id    uuid        references auth.users (id) on delete cascade,
  status        text        not null default 'pending',  -- pending | accepted | declined
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.couple_links enable row level security;

-- Un seul couple actif par utilisateur (côté requester ET côté partenaire).
create unique index if not exists couple_links_requester_active
  on public.couple_links (requester_id) where status in ('pending', 'accepted');
create unique index if not exists couple_links_partner_active
  on public.couple_links (partner_id) where status = 'accepted';

-- SELECT : requester, partenaire résolu, OU destinataire en attente (par email JWT).
drop policy if exists "couple_links_select" on public.couple_links;
create policy "couple_links_select"
  on public.couple_links for select
  using (auth.uid() = requester_id
      or auth.uid() = partner_id
      or (auth.jwt() ->> 'email') = partner_email);

-- INSERT : on ne crée un lien que pour soi-même comme requester.
drop policy if exists "couple_links_insert" on public.couple_links;
create policy "couple_links_insert"
  on public.couple_links for insert
  with check (auth.uid() = requester_id);

-- UPDATE : accepter/refuser (partenaire) ou annuler (requester).
drop policy if exists "couple_links_update" on public.couple_links;
create policy "couple_links_update"
  on public.couple_links for update
  using (auth.uid() = requester_id
      or auth.uid() = partner_id
      or (auth.jwt() ->> 'email') = partner_email)
  with check (auth.uid() = requester_id
      or auth.uid() = partner_id);

-- DELETE (délier) : l'un ou l'autre membre.
drop policy if exists "couple_links_delete" on public.couple_links;
create policy "couple_links_delete"
  on public.couple_links for delete
  using (auth.uid() = requester_id or auth.uid() = partner_id);

-- ── Lecture croisée du blob de partage ──────────────────────────────
-- Un partenaire accepté peut lire UNIQUEMENT la clé `wt_couple_share`
-- de l'autre. Toute autre clé reste protégée par user_data_select_own.
drop policy if exists "user_data_select_partner" on public.user_data;
create policy "user_data_select_partner"
  on public.user_data for select
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

- [ ] **Step 2 : Relecture de cohérence**

Vérifier à l'œil :
- `couple_links_update.using` matche l'ancienne ligne (partner_id null → l'email JWT autorise l'accès), `with check` valide la nouvelle (partner_id = auth.uid()).
- `user_data_select_partner` ne concerne QUE `key = 'wt_couple_share'`.
- Les policies `user_data_*_own` existantes ne sont pas modifiées.

- [ ] **Step 3 : Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(couple): table couple_links + policies RLS partage"
```

---

## Task 3 : Appels Supabase dans `storage.js`

**Files:**
- Modify: `src/storage.js` (ajouter les fonctions après `wipeCloudData`)

> Ces fonctions encapsulent Supabase (effets de bord réseau) ; non testées en
> unitaire. La logique pure testable est déjà isolée dans `src/couple.js`.

- [ ] **Step 1 : Ajouter les fonctions de lien + partage**

Insérer dans `src/storage.js`, juste après la fonction `wipeCloudData` :

```js
/* ════════════════════════════════════════════════════════════════════
   MODE COUPLE — liaison de comptes + lecture du blob partagé.
   Toutes les opérations passent par la RLS (cf. supabase/schema.sql).
   ════════════════════════════════════════════════════════════════════ */

const COUPLE_SHARE_KEY = "wt_couple_share";

/** Récupère le lien de couple courant (requester, partenaire, ou pending par email). */
export async function getCoupleLink() {
  if (!supabase || !activeUserId) return null;
  const { data, error } = await supabase
    .from("couple_links")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return null;
  return data[0];
}

/** Crée une invitation `pending` vers l'email du partenaire. */
export async function createCoupleLink(partnerEmail) {
  if (!supabase || !activeUserId) return { error: "offline" };
  const email = String(partnerEmail || "").trim().toLowerCase();
  if (!email) return { error: "email_vide" };
  const { data, error } = await supabase
    .from("couple_links")
    .insert({ requester_id: activeUserId, partner_email: email, status: "pending" })
    .select()
    .single();
  if (error) return { error: error.message };
  return { link: data };
}

/** Le partenaire accepte : pose partner_id = lui-même, status = accepted. */
export async function acceptCoupleLink(id) {
  if (!supabase || !activeUserId) return { error: "offline" };
  const { data, error } = await supabase
    .from("couple_links")
    .update({ partner_id: activeUserId, status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { link: data };
}

/** Le partenaire refuse l'invitation. */
export async function declineCoupleLink(id) {
  if (!supabase || !activeUserId) return { error: "offline" };
  const { error } = await supabase
    .from("couple_links")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

/** Délie le couple (suppression de la ligne ; coupe l'accès RLS immédiatement). */
export async function unlinkCouple(id) {
  if (!supabase || !activeUserId) return { error: "offline" };
  const { error } = await supabase.from("couple_links").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

/** Lit le blob de partage du partenaire (RLS : autorisé seulement si lien accepté). */
export async function fetchPartnerShare(partnerId) {
  if (!supabase || !partnerId) return null;
  const { data, error } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", partnerId)
    .eq("key", COUPLE_SHARE_KEY)
    .maybeSingle();
  if (error || !data) return null;
  return data.value || null;
}

/** Publie / met à jour mon blob de partage (totaux only). Best-effort. */
export async function upsertMyShare(share) {
  if (!supabase || !activeUserId) return;
  try {
    await supabase.from("user_data").upsert(
      { user_id: activeUserId, key: COUPLE_SHARE_KEY, value: share, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
  } catch { /* hors-ligne : ignoré */ }
}
```

- [ ] **Step 2 : Vérifier que le build passe**

Run: `npm run build`
Expected: build OK (aucune erreur d'import/syntaxe).

- [ ] **Step 3 : Commit**

```bash
git add src/storage.js
git commit -m "feat(couple): appels Supabase liaison + blob de partage"
```

---

## Task 4 : Refonte du composant `Couple` (état réel)

**Files:**
- Modify: `src/App.jsx` — composant `Couple` (≈ lignes 3525-3719)

- [ ] **Step 1 : Ajouter les imports nécessaires**

Dans le bloc d'import storage (`import { useLocalStorage, clearLocalAppData, wipeCloudData } from "./storage.js";`), ajouter les fonctions couple :

```js
import {
  useLocalStorage, clearLocalAppData, wipeCloudData,
  getCoupleLink, createCoupleLink, acceptCoupleLink, declineCoupleLink,
  unlinkCouple, fetchPartnerShare,
} from "./storage.js";
```

Ajouter l'import du helper pur et de l'utilisateur courant en haut de `App.jsx` (près des autres imports applicatifs) :

```js
import { coupleLinkState } from "./couple.js";
```

- [ ] **Step 2 : Remplacer la signature + l'état mocké du composant `Couple`**

Remplacer le début du composant (de `function Couple({ transactions, simParams, patrimoine, profile }) {` jusqu'à la ligne `const partner = TEST_PROFILES.find((p) => p.id === partnerId);` incluse) par :

```js
function Couple({ transactions, simParams, patrimoine, profile, userId, userEmail }) {
  const T = useT();
  const inputStyle = makeInputStyle(T);
  const chartTip = makeChartTip(T);
  const [goalTarget, setGoalTarget] = useState(500000);
  const [sharedMonthly, setSharedMonthly] = useState(1000);

  // Lien de couple (chargé du cloud à l'ouverture).
  const [link, setLink] = useState(null);
  const [partnerShare, setPartnerShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const linkState = coupleLinkState(link, userId, userEmail);

  const reload = useCallback(async () => {
    setLoading(true);
    const l = await getCoupleLink();
    setLink(l);
    if (l && l.status === "accepted") {
      const partnerId = l.requester_id === userId ? l.partner_id : l.requester_id;
      setPartnerShare(await fetchPartnerShare(partnerId));
    } else {
      setPartnerShare(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const myNetWorth = useMemo(() => {
    const a = patrimoine.actifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    const p = patrimoine.passifs.flatMap((c) => c.items).reduce((s, i) => s + i.value, 0);
    return a - p;
  }, [patrimoine]);

  const partner = partnerShare; // { firstName, netWorth, monthly } | null
```

- [ ] **Step 3 : Adapter les dérivés patrimoniaux au nouveau `partner`**

Remplacer le bloc `partnerNetWorth` … `synergyBonus` (l'ancien calcul basé sur `partner.patrimoine` / `partner.simParams`) par :

```js
  const partnerNetWorth = partner ? (Number(partner.netWorth) || 0) : 0;

  const combinedNW = myNetWorth + partnerNetWorth;
  const myMonthly = simParams.monthly;
  const partnerMonthly = partner ? (Number(partner.monthly) || 0) : 0;
  const totalMonthly = myMonthly + partnerMonthly + sharedMonthly;
  const RATE = RATE_A;

  const yearsToGoal = useMemo(() => {
    for (let y = 1; y <= 50; y++) {
      if (fv(combinedNW, totalMonthly, RATE, y) >= goalTarget) return y;
    }
    return null;
  }, [combinedNW, totalMonthly, goalTarget]);

  const progressPct = Math.min(100, Math.round((combinedNW / goalTarget) * 100));
  const horizonY = Math.min(yearsToGoal || 20, 20);

  const projSeries = useMemo(() => Array.from({ length: horizonY + 1 }, (_, y) => ({
    year: 2026 + y,
    Ensemble: Math.round(fv(combinedNW, totalMonthly, RATE, y)),
    Séparément: partner
      ? Math.round(fv(myNetWorth, myMonthly, RATE, y) + fv(partnerNetWorth, partnerMonthly, RATE, y))
      : null,
  })), [combinedNW, totalMonthly, myNetWorth, partnerNetWorth, myMonthly, partnerMonthly, horizonY, partner]);

  const last = projSeries[projSeries.length - 1] || {};
  const synergyBonus = partner ? (last.Ensemble || 0) - (last.Séparément || 0) : 0;

  const myName = profile.firstName || "Moi";
  const partnerName = partner?.firstName || "Partenaire";

  const handleInvite = async () => {
    setErr(""); setBusy(true);
    const res = await createCoupleLink(inviteEmail);
    setBusy(false);
    if (res.error) { setErr("Échec de l'invitation. Réessayez."); return; }
    setInviteEmail("");
    reload();
  };
  const handleUnlink = async () => {
    if (!link) return;
    if (!window.confirm("Délier votre compte de votre partenaire ?")) return;
    setBusy(true);
    await unlinkCouple(link.id);
    setBusy(false);
    reload();
  };
```

- [ ] **Step 4 : Remplacer la carte « Choisir un partenaire » par l'UI de liaison**

Remplacer la `<Card>` « Choisir un partenaire » (le bloc `<Card> … TEST_PROFILES.map … </Card>`) par :

```js
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} style={{ color: T.blue }} />
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Partenaire</h2>
        </div>

        {loading && <p className="text-sm" style={{ color: T.muted }}>Chargement…</p>}

        {!loading && linkState === "none" && (
          <div>
            <p className="text-sm mb-3" style={{ color: T.muted }}>
              Invitez votre partenaire par e-mail. Vos patrimoines ne seront partagés qu'après son acceptation.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="email" value={inviteEmail} placeholder="email@partenaire.fr" style={{ ...inputStyle, flex: 1 }}
                onChange={(e) => setInviteEmail(e.target.value)} />
              <button onClick={handleInvite} disabled={busy || !inviteEmail.trim()}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm shrink-0"
                style={{ background: T.blue, color: "#fff", cursor: busy ? "not-allowed" : "pointer", opacity: busy || !inviteEmail.trim() ? 0.6 : 1 }}>
                Inviter
              </button>
            </div>
            {err && <div className="text-sm mt-2" style={{ color: T.red }}>{err}</div>}
          </div>
        )}

        {!loading && linkState === "pending_outgoing" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm" style={{ color: T.muted }}>
              En attente de l'acceptation de <strong style={{ color: T.text }}>{link.partner_email}</strong>.
            </p>
            <button onClick={handleUnlink} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm shrink-0" style={{ border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        )}

        {!loading && linkState === "declined" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm" style={{ color: T.muted }}>Invitation refusée.</p>
            <button onClick={handleUnlink} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm shrink-0" style={{ border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}>
              Supprimer
            </button>
          </div>
        )}

        {!loading && linkState === "accepted" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm" style={{ color: T.text }}>
              Lié à <strong>{partnerName}</strong>.
            </p>
            <div className="flex gap-2">
              <button onClick={reload} disabled={busy}
                className="px-4 py-2 rounded-xl text-sm shrink-0" style={{ border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer" }}>
                Rafraîchir
              </button>
              <button onClick={handleUnlink} disabled={busy}
                className="px-4 py-2 rounded-xl text-sm shrink-0" style={{ border: `1px solid ${T.red}44`, color: T.red, cursor: "pointer" }}>
                Délier
              </button>
            </div>
          </div>
        )}
      </Card>
```

- [ ] **Step 5 : Adapter la carte « Patrimoines combinés » au nouveau `partner`**

Dans la `<Card>` « PATRIMOINES COMBINÉS », remplacer la ligne du partenaire :

```js
          {partner && <div className="flex justify-between"><span className="text-sm" style={{ color: T.muted }}>{partner.profile.firstName}</span><span className="font-bold" style={{ color: T.green }}>{eur(partnerNetWorth)}</span></div>}
```

par :

```js
          {partner && <div className="flex justify-between"><span className="text-sm" style={{ color: T.muted }}>{partnerName}</span><span className="font-bold" style={{ color: T.green }}>{eur(partnerNetWorth)}</span></div>}
```

- [ ] **Step 6 : Build + vérifier l'absence de référence à `TEST_PROFILES` dans `Couple`**

Run: `npm run build`
Expected: build OK.

Run: `grep -n "TEST_PROFILES" src/App.jsx`
Expected: plus AUCune occurrence dans le composant `Couple` (lignes ~3525-3720). Si `TEST_PROFILES` n'est utilisé nulle part ailleurs, retirer l'import ligne 50 (`import { TX, HISTO, TEST_PROFILES, DEFAULT_PATRIMOINE } from "./seedData.js";` → enlever `TEST_PROFILES`). Si encore utilisé ailleurs, laisser l'import.

- [ ] **Step 7 : Commit**

```bash
git add src/App.jsx
git commit -m "feat(couple): composant Couple branché sur le lien réel"
```

---

## Task 5 : Câblage App (props, gating, bannière, upsert auto)

**Files:**
- Modify: `src/App.jsx` — point de montage de `<Couple>`, nav gating, bannière niveau App, effet d'upsert du share

- [ ] **Step 1 : Charger le lien de couple au niveau App**

Repérer le composant racine (là où sont déclarés `plan`, `profile`, `view`, etc. — autour de la ligne 7616 où vivent `onboarded`, `fireClicks`). Ajouter l'import en tête si absent :

```js
import { coupleLinkState } from "./couple.js";
import { getCoupleLink, acceptCoupleLink, declineCoupleLink, upsertMyShare } from "./storage.js";
import { shareFromPatrimoine } from "./couple.js";
import { supabase } from "./supabaseClient.js"; // déjà importé : ne pas dupliquer
```

> Note : `coupleLinkState` est déjà importé en Task 4. Ne PAS le ré-importer. Idem `supabase`. Ajouter seulement ce qui manque : `getCoupleLink, acceptCoupleLink, declineCoupleLink, upsertMyShare, shareFromPatrimoine`.

Dans le corps du composant racine, ajouter l'état + le chargement de l'utilisateur et du lien :

```js
  const [currentUser, setCurrentUser] = useState(null); // { id, email }
  const [coupleLink, setCoupleLink] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const u = data?.session?.user;
      if (alive && u) setCurrentUser({ id: u.id, email: u.email });
    })();
    return () => { alive = false; };
  }, []);

  const refreshCoupleLink = useCallback(async () => {
    setCoupleLink(await getCoupleLink());
  }, []);
  useEffect(() => { if (currentUser) refreshCoupleLink(); }, [currentUser, refreshCoupleLink]);

  const coupleLinkSt = coupleLinkState(coupleLink, currentUser?.id, currentUser?.email);
  const coupleLinked = coupleLinkSt === "accepted";
```

- [ ] **Step 2 : Publier mon blob de partage quand mes données changent (si lié)**

Ajouter, dans le composant racine, un effet qui upsert le share dès que patrimoine/épargne change ET qu'un lien existe (accepté ou en attente — pour qu'au moment de l'acceptation la donnée soit déjà là) :

```js
  useEffect(() => {
    if (!supabase || !currentUser) return;
    if (coupleLinkSt === "none") return;
    const share = shareFromPatrimoine(patrimoineDerived, profile, simParams.monthly);
    upsertMyShare(share);
  }, [coupleLinkSt, currentUser, patrimoineDerived, profile, simParams.monthly]);
```

> `patrimoineDerived` et `simParams` existent déjà dans ce composant (utilisés pour passer aux vues). Vérifier les noms exacts à proximité du point de montage des vues (~ligne 7920) et ajuster si besoin.

- [ ] **Step 3 : Bannière d'acceptation niveau App (visible même en plan gratuit)**

Juste avant le `<main>` qui contient les vues (≈ ligne 7913, là où commence la liste `{view === ...}`), insérer la bannière :

```js
      {coupleLinkSt === "pending_incoming" && coupleLink && (
        <div role="alert" className="flex items-center justify-between gap-3 flex-wrap"
          style={{ margin: "0 16px 12px", padding: "12px 16px", borderRadius: 12, background: "rgba(91,141,239,0.1)", border: `1px solid ${C?.blue || "#5b8def"}44` }}>
          <span style={{ fontSize: 14, color: "#e5e7eb" }}>
            <strong>{coupleLink.partner_email ? "Votre partenaire" : "Quelqu'un"}</strong> souhaite lier vos comptes pour partager vos patrimoines.
          </span>
          <div className="flex gap-2 shrink-0">
            <button onClick={async () => { await acceptCoupleLink(coupleLink.id); refreshCoupleLink(); setView("couple"); }}
              style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#5b8def", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Accepter
            </button>
            <button onClick={async () => { await declineCoupleLink(coupleLink.id); refreshCoupleLink(); }}
              style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#9ca3af", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Refuser
            </button>
          </div>
        </div>
      )}
```

> `C` est l'objet thème importé en tête de `App.jsx` (`import { C, glow, ASSET } from "./theme.js";`). Le fallback `"#5b8def"` couvre le cas où `C.blue` n'existe pas.

- [ ] **Step 4 : Mettre à jour le gating de l'onglet Couple**

Repérer la définition de `items` (≈ ligne 632) et la condition d'ajout de l'entrée `couple` :

```js
    ...(profile?.coupleMode && plan === "couple" ? [{ id: "couple", label: "Couple / Famille", icon: Users }] : []),
```

La remplacer par (visible si plan Couple OU lien accepté) :

```js
    ...((profile?.coupleMode && plan === "couple") || coupleLinked ? [{ id: "couple", label: "Couple / Famille", icon: Users }] : []),
```

> `coupleLinked` est calculé dans le composant racine (Step 1). Vérifier que la construction de `items` se fait bien dans le scope où `coupleLinked` est disponible. La sidebar `items` est définie dans le composant qui rend la nav ; si `items` est dans un sous-composant, passer `coupleLinked` en prop. Sinon, l'utiliser directement.

- [ ] **Step 5 : Passer les props `userId` / `userEmail` au composant `<Couple>`**

Repérer le montage de `<Couple … />` (≈ ligne 7946) :

```js
        {view === "couple"       && (canAccess(plan, "couple")      ? <Couple transactions={transactions} simParams={simParams} patrimoine={patrimoineDerived} profile={profile} /> : <PaywallBanner feature="couple" plan={plan} onUpgrade={() => setView("pricing")} />)}
```

Le remplacer par (autoriser aussi le partenaire lié, et transmettre l'identité) :

```js
        {view === "couple"       && ((canAccess(plan, "couple") || coupleLinked)
            ? <Couple transactions={transactions} simParams={simParams} patrimoine={patrimoineDerived} profile={profile} userId={currentUser?.id} userEmail={currentUser?.email} />
            : <PaywallBanner feature="couple" plan={plan} onUpgrade={() => setView("pricing")} />)}
```

- [ ] **Step 6 : Build + lancer toute la suite de tests**

Run: `npm run build`
Expected: build OK.

Run: `npm test`
Expected: tous les tests passent (dont `couple.test.js`).

- [ ] **Step 7 : Commit**

```bash
git add src/App.jsx
git commit -m "feat(couple): câblage App — gating, bannière acceptation, upsert share"
```

---

## Task 6 : Vérification RLS (checklist manuelle) + doc

**Files:**
- Modify: `supabase/schema.sql` (aucun changement de code ; on documente la procédure de test dans le spec si besoin)

> Pas de Supabase live en CI : cette tâche est une checklist à exécuter
> manuellement contre un projet Supabase de test avant déploiement.

- [ ] **Step 1 : Appliquer le schéma**

Exécuter le contenu de `supabase/schema.sql` dans le SQL Editor du projet Supabase de test (idempotent : `create … if not exists`, `drop policy if exists`).

- [ ] **Step 2 : Dérouler les 5 scénarios d'isolation**

Avec 3 comptes de test A, B, C :
1. A invite l'email de B → B voit la demande (bannière), C ne voit rien.
2. Tant que `pending` : A ne lit PAS `wt_couple_share` de B (requête directe renvoie vide).
3. B accepte → A lit `wt_couple_share` de B et inversement ; A ne lit AUCUNE autre clé de B (ex. `wt_patrimoine` reste interdit).
4. C ne lit jamais `wt_couple_share` de A ni de B.
5. A délie → A ne lit plus rien de B (accès coupé immédiatement).

Expected : chaque point conforme. Noter tout écart et corriger la policy concernée avant déploiement.

- [ ] **Step 3 : Commit (si ajustements SQL)**

```bash
git add supabase/schema.sql
git commit -m "fix(couple): ajustements RLS après vérification d'isolation"
```

---

## Self-Review (couverture spec)

- Table `couple_links` + index unicité → Task 2 ✅
- Blob `wt_couple_share` minimal → Task 1 (`shareFromPatrimoine`) + Task 3 (`upsertMyShare`/`fetchPartnerShare`) ✅
- RLS couple_links + user_data partenaire → Task 2 ✅
- Flux UI (none / pending out / pending in / accepted / declined) → Task 4 (onglet) + Task 5 (bannière) ✅
- Gating `coupleMode && (plan==='couple' || lié)` → Task 5 Step 4/5 ✅
- Helpers storage.js → Task 3 ✅
- Helper pur testable + tests → Task 1 ✅
- Tests d'isolation RLS → Task 6 ✅
- Retrait TEST_PROFILES → Task 4 Step 6 ✅
- Sync à l'ouverture + refresh → Task 4 (reload/useEffect + bouton Rafraîchir) ✅
