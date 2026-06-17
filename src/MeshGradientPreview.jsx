import React from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import { C } from "./theme.js";
import "./animations.css";

const MeshGradientPreview = () => {
  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: -1 }}>
        <MeshGradient
          style={{ width: "100%", height: "100%" }}
          colors={["hsl(216, 90%, 27%)", "hsl(243, 68%, 36%)", "hsl(205, 91%, 64%)", "hsl(211, 61%, 57%)"]}
          distortion={0.8}
          swirl={0.1}
          speed={1}
        />
      </div>

      <section className="relative z-10 text-center px-6 pt-32 pb-16 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-none tracking-tight" style={{ color: C.text }}>
          Simulez.{" "}
          <span style={{ background: `linear-gradient(135deg, ${C.blue}, #60a5fa)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Comprenez.
          </span>
          <br />
          <span className="wt-shiny-text" style={{ backgroundImage: `linear-gradient(110deg, ${C.blue} 25%, #ffffff 50%, ${C.blue} 75%)` }}>
            Décidez.
          </span>
        </h1>
        <p className="text-lg md:text-xl mb-4 max-w-2xl mx-auto leading-relaxed" style={{ color: C.muted }}>
          Aperçu : fond MeshGradient (palette bleu/indigo) en remplacement d'AnoAI.
        </p>
      </section>
    </div>
  );
};

export default MeshGradientPreview;
