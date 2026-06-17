import React from "react";

/**
 * Capture les erreurs de rendu d'un sous-arbre React et affiche un écran de
 * repli au lieu d'un écran blanc. Critique pour un produit financier : un
 * crash isolé ne doit jamais faire disparaître toute l'application.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Point de branchement futur pour un service de monitoring (Sentry, etc.)
    console.error("ErrorBoundary a capturé une erreur :", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#f8fafc",
          fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            Une erreur inattendue est survenue
          </div>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Vos données restent enregistrées localement. Rechargez la page ou
            réessayez — si le problème persiste, contactez le support.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recharger la page
            </button>
            <button
              onClick={this.handleReset}
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 12,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }
}
