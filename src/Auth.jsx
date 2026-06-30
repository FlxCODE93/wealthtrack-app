import React, { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./supabaseClient.js";
import { useT } from "./ThemeProvider.jsx";
import { LogIn, Mail, Lock, AlertCircle } from "lucide-react";

// Fond animé partagé avec la landing / l'onboarding (WebGL, position: fixed).
const PaperShaderBackground = lazy(() => import("./PaperShaderBackground.jsx"));

export default function Auth({ onAuthSuccess, startSignup = false }) {
  const T = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(!startSignup);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Détecte le flow de recovery Supabase (lien email → #type=recovery)
  useEffect(() => {
    if (!supabase) return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
      // Supabase détecte le token automatiquement via detectSessionInUrl
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { setError("Minimum 6 caractères."); return; }
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      setIsRecovery(false);
      setInfo("Mot de passe mis à jour. Vous êtes connecté.");
      window.history.replaceState({}, "", window.location.pathname);
      onAuthSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!supabase) { setError("Supabase non configuré — vérifiez les variables d'environnement."); return; }
    setLoading(true);

    try {
      if (isLogin) {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
      onAuthSuccess?.();
    } catch (err) {
      setError(err.message || "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  };

  // Envoie un lien de réinitialisation de mot de passe (magic link).
  const handleResetPassword = async () => {
    setError("");
    setInfo("");
    if (!supabase) { setError("Supabase non configuré."); return; }
    if (!email) {
      setError("Saisissez votre email d'abord.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setInfo("Email envoyé. Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.");
    } catch (err) {
      setError(err.message || "Impossible d'envoyer l'email.");
    } finally {
      setLoading(false);
    }
  };

  if (isRecovery) return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", padding: 16 }}>
      <Suspense fallback={null}><PaperShaderBackground /></Suspense>
      <div style={{ maxWidth: 400, width: "100%", padding: 32, borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(22,27,46,0.64)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)" }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>Nouveau mot de passe</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "8px 0 0 0" }}>Choisissez un mot de passe sécurisé</p>
        </div>
        <form onSubmit={handleSetNewPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="wt-input-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg }}>
            <Lock size={16} style={{ color: T.muted, flexShrink: 0 }} />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe" required minLength={6}
              style={{ flex: 1, border: "none", background: "transparent", color: T.text, outline: "none", fontSize: 14 }} />
          </div>
          {error && (
            <div style={{ display: "flex", gap: 8, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#fca5a5" }}>{error}</span>
            </div>
          )}
          <button type="submit" disabled={loading} style={{ padding: "11px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Mise à jour..." : "Enregistrer"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        padding: 16,
      }}
    >
      <Suspense fallback={null}><PaperShaderBackground /></Suspense>
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          padding: 32,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(10,14,30,0.28)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "0 8px 48px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <LogIn size={32} style={{ color: T.blue }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>
            WealthTrack
          </h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "8px 0 0 0" }}>
            {isLogin ? "Connectez-vous" : "Créez un compte"}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              Email
            </label>
            <div className="wt-input-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg }}>
              <Mail size={16} style={{ color: T.muted, flexShrink: 0 }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                required
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  color: T.text,
                  outline: "none",
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              Mot de passe
            </label>
            <div className="wt-input-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg }}>
              <Lock size={16} style={{ color: T.muted, flexShrink: 0 }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=""
                required
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  color: T.text,
                  outline: "none",
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: "flex", gap: 8, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#fca5a5" }}>{error}</span>
            </div>
          )}

          {/* Info (succès reset password) */}
          {info && (
            <div style={{ display: "flex", gap: 8, padding: 12, borderRadius: 8, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)" }}>
              <Mail size={16} style={{ color: "#38bdf8", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#7dd3fc" }}>{info}</span>
            </div>
          )}

          {/* Mot de passe oublié (mode connexion uniquement) */}
          {isLogin && (
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              style={{ alignSelf: "center", background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              Mot de passe oublié ?
            </button>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "11px 16px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Connexion..." : isLogin ? "Se connecter" : "S'inscrire"}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
          <span style={{ color: T.muted }}>
            {isLogin ? "Vous n'avez pas de compte ? " : "Déjà inscrit ? "}
          </span>
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(""); setInfo(""); }}
            style={{ background: "none", border: "none", color: T.blue, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          >
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
