import React from "react";
import { Shield } from "lucide-react";
import ShaderHero from "./ShaderHero.jsx";

// Demo usage of ShaderHero with WealthTrack's real hero copy.
const ShaderHeroPreview = () => {
  return (
    <ShaderHero
      trustBadge={{
        icon: <Shield size={12} />,
        text: "Outil de simulation patrimoniale · Non conseil en investissement (AMF)",
      }}
      headline={{ line1: "Simulez. Comprenez.", line2: "Décidez." }}
      subtitle="WealthTrack vous permet de comprendre vos finances en profondeur et d'agir avec méthode. Un outil de simulation, pas un agrégateur passif."
      buttons={{
        primary: { text: "Démarrer gratuitement" },
        secondary: { text: "Voir la démonstration" },
      }}
    />
  );
};

export default ShaderHeroPreview;
