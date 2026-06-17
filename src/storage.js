/* ────────────────────────────────────────────────────────────────────
   Couche de persistance — LOCAL-FIRST avec synchro cloud optionnelle.

   - Lecture : toujours synchrone depuis localStorage (instantané, hors-ligne).
   - Écriture : localStorage + (si connecté Supabase) push cloud en arrière-plan.
   - Connexion : `hydrateFromCloud(userId)` télécharge les données cloud au login
     et écrase le cache local ; `pushAllToCloud(userId)` pousse le local (1re synchro).

   Tant que Supabase n'est pas configuré/connecté, tout reste 100 % local —
   comportement identique à aujourd'hui. Le swap se fait ICI, nulle part ailleurs.
   ──────────────────────────────────────────────────────────────────── */
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

let activeUserId = null; // posé par hydrateFromCloud après login

/** Adaptateur bas niveau (cache local synchrone). */
export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota plein / mode privé : on ignore */
    }
    // Write-through cloud (best-effort, ne bloque jamais l'UI)
    if (supabase && activeUserId) pushToCloud(key, value);
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/**
 * État React persistant. Signature historique : (key, défaut) → [valeur, set].
 * Local-first : initialisation synchrone depuis le cache local.
 */
export function useLocalStorage(key, defaultValue) {
  const [state, setState] = useState(() => storage.get(key, defaultValue));
  useEffect(() => {
    storage.set(key, state);
  }, [key, state]);
  return [state, setState];
}

/* ───────────── Synchro cloud (Supabase) — table `user_data` ─────────────
   Schéma attendu (cf. supabase/schema.sql) :
     user_data ( user_id uuid, key text, value jsonb, updated_at timestamptz,
                 primary key (user_id, key) )  + RLS : user_id = auth.uid()
   ──────────────────────────────────────────────────────────────────── */

/** Push d'une clé vers le cloud (upsert). Best-effort, erreurs avalées. */
async function pushToCloud(key, value) {
  if (!supabase || !activeUserId) return;
  try {
    await supabase
      .from("user_data")
      .upsert(
        { user_id: activeUserId, key, value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
  } catch {
    /* hors-ligne / erreur réseau : le cache local reste la source de vérité */
  }
}

/** Pousse tout le localStorage courant vers le cloud (1re synchro après login). */
export async function pushAllToCloud(userId) {
  if (!supabase || !userId) return;
  activeUserId = userId;
  const rows = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    try {
      rows.push({ user_id: userId, key, value: JSON.parse(localStorage.getItem(key)), updated_at: new Date().toISOString() });
    } catch {
      /* valeur non-JSON : ignorée */
    }
  }
  if (rows.length) {
    try { await supabase.from("user_data").upsert(rows, { onConflict: "user_id,key" }); } catch { /* ignore */ }
  }
}

/** Télécharge les données cloud de l'utilisateur et écrase le cache local. */
export async function hydrateFromCloud(userId) {
  activeUserId = userId;
  if (!supabase || !userId) return;
  try {
    const { data, error } = await supabase.from("user_data").select("key,value").eq("user_id", userId);
    if (error || !data) return;
    for (const row of data) {
      try { localStorage.setItem(row.key, JSON.stringify(row.value)); } catch { /* ignore */ }
    }
  } catch {
    /* hors-ligne : on garde le cache local */
  }
}

/** Réinitialise l'état de synchro (à appeler au logout). */
export function clearCloudSync() {
  activeUserId = null;
}

/* ────────────────── Hook pour la synchro auth ──────────────────── */

/**
 * Écoute l'état d'authentification Supabase.
 * Login → hydrateFromCloud (récupère données cloud).
 * Logout → clearCloudSync.
 * Return : [user ou null, loading].
 */
export function useAuthState() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Récupère l'utilisateur courant au mount
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        activeUserId = data.user.id;
      }
      setLoading(false);
    });

    // Écoute les changements (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        activeUserId = session.user.id;
        // 1er login = hydrate depuis cloud (ou pousse si vide)
        if (event === "SIGNED_IN") {
          const { data: cloudData } = await supabase
            .from("user_data")
            .select("key")
            .eq("user_id", session.user.id)
            .limit(1);
          if (!cloudData || cloudData.length === 0) {
            await pushAllToCloud(session.user.id);
          } else {
            await hydrateFromCloud(session.user.id);
          }
        }
      } else {
        setUser(null);
        clearCloudSync();
      }
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  return [user, loading];
}
