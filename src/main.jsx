import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import { FreeDashboardFrame, PremiumDashboardFrame } from "./DashboardFrames.jsx";
import { ThemeProvider } from "./ThemeProvider.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import MeshGradientPreview from "./MeshGradientPreview.jsx";
import PaperShaderPreview from "./PaperShaderPreview.jsx";
import AnimatedShaderHeroPreview from "./AnimatedShaderHeroPreview.jsx";
import ShaderHeroPreview from "./ShaderHeroPreview.jsx";
import "./typography.css";

const params = new URLSearchParams(window.location.search);
const frame = params.get("frame");
const preview = params.get("preview");

const Root =
  preview === "mesh" ? MeshGradientPreview :
  preview === "paper" ? PaperShaderPreview :
  preview === "hero" ? AnimatedShaderHeroPreview :
  preview === "fullhero" ? ShaderHeroPreview :
  frame === "free" ? FreeDashboardFrame :
  frame === "premium" ? PremiumDashboardFrame :
  AuthGate;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
