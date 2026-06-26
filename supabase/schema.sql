-- ════════════════════════════════════════════════════════════════════
-- WealthTrack — schéma Supabase (à exécuter dans SQL Editor)
-- Stockage clé/valeur par utilisateur (miroir du localStorage).
-- Sécurité : RLS stricte — chaque user ne voit/écrit QUE ses lignes.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Active la Row Level Security
alter table public.user_data enable row level security;

-- Policies : un utilisateur n'accède qu'à ses propres données (auth.uid()).
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_data_delete_own" on public.user_data;
create policy "user_data_delete_own"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- Index pour les lectures par utilisateur
create index if not exists user_data_user_id_idx on public.user_data (user_id);


-- ════════════════════════════════════════════════════════════════════
-- ABONNEMENTS — source de vérité du plan payant.
--
-- SÉCURITÉ CRITIQUE : le plan d'un utilisateur NE DOIT JAMAIS provenir du
-- client (localStorage, paramètre d'URL…). Il vit ICI et n'est écrit QUE
-- par le webhook Stripe via la clé service_role (qui contourne la RLS).
--
-- RLS : l'utilisateur peut LIRE sa ligne (pour afficher son plan), mais
-- AUCUNE policy insert/update/delete n'existe → côté client, écrire est
-- impossible. Le service_role n'est pas soumis à la RLS.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.subscriptions (
  user_id                uuid        primary key references auth.users (id) on delete cascade,
  plan                   text        not null default 'free',      -- free | pro | couple
  status                 text        not null default 'inactive',  -- active | trialing | past_due | canceled | inactive
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Lecture seule de SA propre ligne. Pas d'autre policy = écriture client interdite.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Recherche par customer Stripe (utilisée par le webhook côté service_role).
create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);


-- ════════════════════════════════════════════════════════════════════
-- PHOTOS DE PROFIL — bucket Storage `avatars`.
--
-- Bucket public en LECTURE (l'URL publique sert à afficher l'avatar).
-- Écriture/màj/suppression : uniquement par le propriétaire, et uniquement
-- dans SON dossier `<user_id>/…` (vérifié via storage.foldername).
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lecture publique des avatars (bucket public).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Envoi : un user n'écrit que dans son propre dossier `<user_id>/`.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Mise à jour (upsert d'une nouvelle photo) sur son propre dossier.
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Suppression de sa propre photo.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


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

-- UPDATE : accepter/refuser (destinataire) ou annuler (requester).
-- SÉCURITÉ : le requester NE PEUT PAS se résoudre lui-même un partenaire
-- (sinon il poserait partner_id = victime + status = accepted et lirait le
-- blob de la victime). Seul le destinataire — identifié par son email JWT —
-- peut poser partner_id = lui-même. Les colonnes requester_id / partner_email
-- sont immuables (trigger ci-dessous), la RLS ne pouvant comparer OLD/NEW.
drop policy if exists "couple_links_update" on public.couple_links;
create policy "couple_links_update"
  on public.couple_links for update
  using (auth.uid() = requester_id
      or auth.uid() = partner_id
      or (auth.jwt() ->> 'email') = partner_email)
  with check (
    -- le requester ne peut que laisser le lien non résolu (annuler via DELETE)
    (auth.uid() = requester_id and partner_id is null and status in ('pending', 'declined'))
    -- le destinataire se résout LUI-MÊME (partner_id = soi) et seulement vers son email
    or (auth.uid() = partner_id and (auth.jwt() ->> 'email') = partner_email
        and status in ('accepted', 'declined'))
  );

-- requester_id et partner_email sont immuables après création (intégrité :
-- empêche de ré-router un lien existant vers une autre victime).
create or replace function public.couple_links_guard()
  returns trigger language plpgsql as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.partner_email is distinct from old.partner_email then
    raise exception 'requester_id et partner_email sont immuables';
  end if;
  return new;
end;
$$;

drop trigger if exists couple_links_guard_update on public.couple_links;
create trigger couple_links_guard_update
  before update on public.couple_links
  for each row execute function public.couple_links_guard();

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
