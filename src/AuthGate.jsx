import React from "react";
import { useAuthState } from "./storage.js";
import Auth from "./Auth.jsx";
import App from "./App.jsx";

/**
 * Wrapper d'authentification.
 * Non connecté → Auth page.
 * Connecté → App.
 */
export default function AuthGate() {
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
