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

/* Écriture DEBOUNCÉE par clé : on regroupe les frappes rapprochées en un
   seul upsert (800 ms après la dernière modif) → évite de spammer le réseau. */
const DEBOUNCE_MS = 800;
const pushTimers = {};   // key → timeout id
const pendingValues = {}; // key → dernière valeur en attente

function flushKey(key) {
  if (!supabase || !activeUserId) return;
  if (!(key in pendingValues)) return;
  const value = pendingValues[key];
  delete pendingValues[key];
  clearTimeout(pushTimers[key]);
  delete pushTimers[key];
  supabase
    .from("user_data")
    .upsert(
      { user_id: activeUserId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    )
    .then(() => {}, () => { /* hors-ligne : le cache local reste la vérité */ });
}

/** Push d'une clé vers le cloud (debouncé). Best-effort, erreurs avalées. */
function pushToCloud(key, value) {
  if (!supabase || !activeUserId) return;
  pendingValues[key] = value;
  clearTimeout(pushTimers[key]);
  pushTimers[key] = setTimeout(() => flushKey(key), DEBOUNCE_MS);
}

/** Force l'envoi immédiat de toutes les écritures en attente (avant unload). */
export function flushPendingCloudWrites() {
  Object.keys(pendingValues).forEach(flushKey);
}

// Filet de sécurité : pousse les écritures en attente avant de quitter la page.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPendingCloudWrites);
  window.addEventListener("pagehide", flushPendingCloudWrites);
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

/**
 * Synchro au login (1 seul aller-retour) :
 *  - cloud VIDE → 1re synchro : on pousse le localStorage courant.
 *  - cloud PRÉSENT → source de vérité : on écrase le cache local avec le cloud.
 * À `await` AVANT de monter l'app pour que `useLocalStorage` lise les bonnes
 * valeurs dès l'initialisation (sinon l'app afficherait le seed local).
 */
export async function syncOnLogin(userId) {
  if (!supabase || !userId) return;
  activeUserId = userId;
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("key,value")
      .eq("user_id", userId);
    if (error) return;
    if (!data || data.length === 0) {
      await pushAllToCloud(userId); // cloud vide → on pousse le local
    } else {
      for (const row of data) {
        try { localStorage.setItem(row.key, JSON.stringify(row.value)); } catch { /* ignore */ }
      }
    }
  } catch {
    /* hors-ligne : on garde le cache local */
  }
}

/** Réinitialise l'état de synchro (à appeler au logout). */
export function clearCloudSync() {
  flushPendingCloudWrites();
  activeUserId = null;
}

/* Borne une promesse : si elle ne se résout pas en `ms`, on continue quand même.
   CRITIQUE : la sync cloud ne doit JAMAIS bloquer la connexion. En cas de
   réseau lent/coupé, on se rabat sur le cache local et la sync reprend après. */
function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
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
    let mounted = true;

    // Session existante au mount (utilisateur déjà connecté → on hydrate aussi)
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        activeUserId = data.user.id;
        if (mounted) setUser(data.user);
        // Sync en arrière-plan — ne bloque jamais le rendu
        withTimeout(syncOnLogin(data.user.id), 4000);
      }
      if (mounted) setLoading(false);
    });

    // Changements d'auth (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        activeUserId = session.user.id;
        if (mounted) setUser(session.user);
        if (mounted) setLoading(false);
        // Sync en arrière-plan — ne bloque JAMAIS la navigation post-login
        if (event === "SIGNED_IN") withTimeout(syncOnLogin(session.user.id), 4000);
      } else {
        if (mounted) setUser(null);
        if (mounted) setLoading(false);
        clearCloudSync();
      }
    });

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  return [user, loading];
}
