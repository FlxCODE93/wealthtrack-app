/* ────────────────────────────────────────────────────────────────────
   Configuration runtime — URL du backend API.
   Définie par VITE_API_URL (cf. .env.development / .env.production).
   Fallback localhost pour le dev si la variable n'est pas posée.
   ──────────────────────────────────────────────────────────────────── */
export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3001";
