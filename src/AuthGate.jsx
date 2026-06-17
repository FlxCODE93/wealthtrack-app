import React from "react";
import { useAuthState } from "./storage.js";
import Auth from "./Auth.jsx";
import App from "./App.jsx";

// Bypass dev : VITE_DEV_SKIP_AUTH=true dans .env.local → saute le login.
// DEV uniquement (import.meta.env.DEV) : ignoré en build de production.
const DEV_SKIP_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === "true";

/**
 * Wrapper d'authentification.
 * Non connecté → Auth page.
 * Connecté → App.
 */
export default function AuthGate() {
  if (DEV_SKIP_AUTH) return <App />;

  const [user, loading] = useAuthState();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#020617" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 700 }}>Chargement...</div>
        </div>
      </div>
    );
  }

  return user ? <App /> : <Auth onAuthSuccess={() => {}} />;
}
