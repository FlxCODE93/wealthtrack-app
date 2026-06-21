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

/* ⚠️ ON NE SYNCHRONISE QUE LES DONNÉES APPLICATIVES (`wt_*`).
   Les clés système — notamment le token d'auth Supabase `sb-<ref>-auth-token` —
   NE DOIVENT JAMAIS transiter par le cloud : sinon on restaure au login un vieux
   token périmé par-dessus le token frais → déconnexion au refresh. */
const SYNC_PREFIX = "wt_";
const isSyncableKey = (key) => typeof key === "string" && key.startsWith(SYNC_PREFIX);

/* Marqueur du PROPRIÉTAIRE des données locales (user.id). Volontairement SANS
   préfixe `wt_` → jamais synchronisé ni purgé par clearLocalAppData(). Sert à
   détecter un changement d'utilisateur sur un appareil partagé (cf. syncOnLogin). */
const OWNER_KEY = "wealthtrack_data_owner";

/** Supprime TOUTES les données applicatives locales (`wt_*`) + écritures en attente.
   Appelé quand un AUTRE utilisateur se connecte sur le même appareil : sans ça,
   l'utilisateur B verrait — et pousserait dans SON cloud — les données de A. */
export function clearLocalAppData() {
  // Annule les pushes en attente (ils porteraient des valeurs d'un autre user).
  Object.keys(pushTimers).forEach((k) => clearTimeout(pushTimers[k]));
  Object.keys(pushTimers).forEach((k) => delete pushTimers[k]);
  Object.keys(pendingValues).forEach((k) => delete pendingValues[k]);
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isSyncableKey(key)) toRemove.push(key);
  }
  toRemove.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
}

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
  if (!isSyncableKey(key)) return; // jamais les clés système (token auth, etc.)
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
    if (!key || !isSyncableKey(key)) continue; // que les `wt_*`, jamais le token auth
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
      if (!isSyncableKey(row.key)) continue; // ne jamais restaurer une clé système
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

  // ── ISOLATION MULTI-UTILISATEUR (appareil partagé) ──────────────────────
  // Si les données locales appartiennent à un AUTRE utilisateur (ou propriétaire
  // inconnu), on les PURGE avant toute hydratation. Sinon, sur un téléphone où le
  // frère s'est déjà connecté, l'utilisateur verrait — et pousserait dans SON
  // cloud — les données du frère. On ne ré-sème le cloud depuis le local QUE pour
  // le même utilisateur de retour (édition hors-ligne légitime).
  let prevOwner = null;
  try { prevOwner = localStorage.getItem(OWNER_KEY); } catch { /* ignore */ }
  const sameOwner = prevOwner === userId;
  if (!sameOwner) clearLocalAppData();
  try { localStorage.setItem(OWNER_KEY, userId); } catch { /* ignore */ }

  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("key,value")
      .eq("user_id", userId);
    if (error) return;

    // Purge des lignes polluées écrites par l'ancienne version (clés système type
    // `sb-…-auth-token`) : un token d'auth n'a rien à faire en base.
    const polluted = (data || []).filter((row) => !isSyncableKey(row.key)).map((row) => row.key);
    if (polluted.length) {
      try { await supabase.from("user_data").delete().eq("user_id", userId).in("key", polluted); } catch { /* ignore */ }
    }

    const syncable = (data || []).filter((row) => isSyncableKey(row.key));
    if (syncable.length > 0) {
      for (const row of syncable) {
        try { localStorage.setItem(row.key, JSON.stringify(row.value)); } catch { /* ignore */ }
      }
    } else if (sameOwner) {
      // Même utilisateur, cloud vide → 1re synchro : on sème le cloud depuis son local.
      await pushAllToCloud(userId);
    }
    // Nouvel utilisateur + cloud vide → local déjà purgé : démarrage vierge (sûr).
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

    // Session existante au mount. ON UTILISE getSession() (lecture LOCALE depuis
    // le storage, zéro réseau) et SURTOUT PAS getUser() : ce dernier valide le
    // token côté serveur et, s'il tombe sur un token périmé, DÉTRUIT la session
    // courante (même fraîchement créée) → SIGNED_OUT → déconnexion fantôme.
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data?.session?.user;
      if (sessionUser) {
        activeUserId = sessionUser.id;
        // On ATTEND la sync AVANT de monter l'app : elle purge les données d'un
        // éventuel autre utilisateur (appareil partagé) et hydrate les bonnes.
        // Bornée à 4 s → ne bloque jamais durablement la connexion.
        await withTimeout(syncOnLogin(sessionUser.id), 4000);
        if (mounted) setUser(sessionUser);
      }
      if (mounted) setLoading(false);
    });

    // Changements d'auth.
    //
    // RÈGLE STRICTE : on ne DÉCONNECTE JAMAIS l'utilisateur depuis ce listener.
    // La seule déconnexion possible passe par le bouton « Se déconnecter » qui
    // appelle supabase.auth.signOut() PUIS window.location.reload() — au rechargement
    // getSession() renvoie null et la Landing s'affiche.
    //
    // Pourquoi : un `SIGNED_OUT` peut être émis par un refresh de token RATÉ
    // (session périmée résiduelle dans localStorage, refresh token déjà consommé,
    // course multi-onglets…). Le nuller ici provoquait des déconnexions fantômes
    // et le bounce vers la Landing 0,5 s après un login pourtant réussi.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        activeUserId = session.user.id;
        // À la connexion, on ATTEND la sync (purge multi-utilisateur + hydratation)
        // AVANT de monter l'app, pour ne jamais afficher les données d'un autre.
        if (event === "SIGNED_IN") await withTimeout(syncOnLogin(session.user.id), 4000);
        if (mounted) setUser(session.user);
      }
      // Aucun cas ne remet l'user à null — voir RÈGLE STRICTE ci-dessus.
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  return [user, loading];
}
