import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import { ThemeProvider } from "./ThemeProvider.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./typography.css";

const params = new URLSearchParams(window.location.search);
const frame = params.get("frame");
const preview = params.get("preview");

// Routes dev (?preview= / ?frame=) : lazy-loadées → exclues du bundle principal.
// En production, les composants de preview ne sont jamais importés.
const DEV_ROUTE = import.meta.env.DEV && (preview || frame);

const lazyDefault = (importer) => lazy(importer);
const lazyNamed = (importer, name) =>
  lazy(() => importer().then((m) => ({ default: m[name] })));

function resolveDevRoot() {
  switch (preview) {
    case "mesh":     return lazyDefault(() => import("./MeshGradientPreview.jsx"));
    case "paper":    return lazyDefault(() => import("./PaperShaderPreview.jsx"));
    case "hero":     return lazyDefault(() => import("./AnimatedShaderHeroPreview.jsx"));
    case "fullhero": return lazyDefault(() => import("./ShaderHeroPreview.jsx"));
    default: break;
  }
  if (frame === "free")    return lazyNamed(() => import("./DashboardFrames.jsx"), "FreeDashboardFrame");
  if (frame === "premium") return lazyNamed(() => import("./DashboardFrames.jsx"), "PremiumDashboardFrame");
  return AuthGate;
}

const Root = DEV_ROUTE ? resolveDevRoot() : AuthGate;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Suspense fallback={null}>
          <Root />
        </Suspense>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
