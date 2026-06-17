/* ────────────────────────────────────────────────────────────────────
   Client Supabase — auth + persistance cloud (Sprint 2).

   Configuration via variables d'environnement (cf. .env.local) :
     VITE_SUPABASE_URL       = https://xxxxx.supabase.co
     VITE_SUPABASE_ANON_KEY  = clé publique "anon" (jamais la service_role !)

   Tant que ces variables sont absentes, `supabase` vaut `null` et l'app
   fonctionne en 100 % local (localStorage) — aucun changement de comportement.
   La clé "anon" est publique par design : la sécurité repose sur les
   policies RLS côté Supabase (cf. supabase/schema.sql).
   ──────────────────────────────────────────────────────────────────── */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // magic link / OAuth redirect
      },
    })
  : null;

/** Utilisateur courant (ou null). Stub pratique pour le reste de l'app. */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/**
 * En-tête Authorization avec le JWT Supabase courant, pour les appels au
 * backend protégé. Retourne {} si pas de session (le backend reste ouvert
 * en dev sans Supabase). À étaler dans les headers d'un fetch.
 */
export async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
