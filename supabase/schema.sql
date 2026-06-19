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
