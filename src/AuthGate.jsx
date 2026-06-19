import React, { useState, useEffect } from "react";
import { useAuthState } from "./storage.js";
import { supabase } from "./supabaseClient.js";
import Auth from "./Auth.jsx";
import App from "./App.jsx";

const DEV_SKIP_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === "true";

export default function AuthGate() {
  if (DEV_SKIP_AUTH) return <App />;

  const [user, loading] = useAuthState();
  const [isRecovery, setIsRecovery] = useState(
    window.location.hash.includes("type=recovery")
  );

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      if (event === "USER_UPDATED") setIsRecovery(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#020617" }}>
        <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 700 }}>Chargement...</div>
      </div>
    );
  }

  if (isRecovery) return <Auth onAuthSuccess={() => setIsRecovery(false)} />;
  return user ? <App userEmail={user.email} /> : <Auth onAuthSuccess={() => {}} />;
}
