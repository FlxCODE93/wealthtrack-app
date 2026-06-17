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
