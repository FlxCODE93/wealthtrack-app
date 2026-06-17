import React from "react";
import AnimatedShaderHero from "./AnimatedShaderHero.jsx";
import { C } from "./theme.js";
import "./animations.css";

// Generic shader hero shell: full-screen nebula background (AnimatedShaderHero)
// + trust badge / two-line headline / subtitle / CTA buttons overlay.
// Ported from 21st.dev "Animated Shader Hero" demo, retinted to WealthTrack
// blue/violet and stripped of styled-jsx (Next.js-only) in favor of animations.css.
const ShaderHero = ({ trustBadge, headline, subtitle, buttons, className = "" }) => {
  return (
    <div className={`relative w-full min-h-screen overflow-hidden ${className}`} style={{ background: C.bg }}>
      <AnimatedShaderHero />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 min-h-screen">
        {trustBadge && (
          <div
            className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium wt-fade-in-down"
            style={{ background: `${C.blue}18`, border: `1px solid ${C.blue}44`, color: C.blue }}
          >
            {trustBadge.icon}
            <span>{trustBadge.text}</span>
          </div>
        )}

        <div className="max-w-4xl">
          <h1
            className="text-5xl md:text-7xl font-black mb-6 leading-none tracking-tight wt-fade-in-up wt-delay-200"
            style={{ background: `linear-gradient(135deg, ${C.blue}, #60a5fa)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            {headline.line1}
          </h1>
          <h1
            className="text-5xl md:text-7xl font-black mb-6 leading-none tracking-tight wt-shiny-text wt-fade-in-up wt-delay-400"
            style={{ backgroundImage: `linear-gradient(110deg, ${C.blue} 25%, #ffffff 50%, ${C.blue} 75%)` }}
          >
            {headline.line2}
          </h1>
        </div>

        <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed wt-fade-in-up wt-delay-600" style={{ color: C.muted }}>
          {subtitle}
        </p>

        {buttons && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10 wt-fade-in-up wt-delay-800">
            {buttons.primary && (
              <button
                onClick={buttons.primary.onClick}
                className="px-8 py-4 rounded-2xl text-base font-bold wt-button-press"
                style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.violet})`, color: "#fff" }}
              >
                {buttons.primary.text}
              </button>
            )}
            {buttons.secondary && (
              <button
                onClick={buttons.secondary.onClick}
                className="px-8 py-4 rounded-2xl text-base font-medium wt-button-press"
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.text }}
              >
                {buttons.secondary.text}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShaderHero;
