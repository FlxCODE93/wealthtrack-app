import React from "react";

const AnimatedBackground = () => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        overflow: "hidden",
        background: "#0f172a",
      }}
    >
      {/* Animated gradient orbs — fintech palette */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {/* Violet orb — primary accent */}
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            filter: "blur(80px)",
            opacity: 0.35,
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
            top: "10%",
            left: "5%",
            animation: "float 8s ease-in-out infinite",
          }}
        />

        {/* Cyan orb — secondary accent */}
        <div
          style={{
            position: "absolute",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            filter: "blur(80px)",
            opacity: 0.25,
            background: "radial-gradient(circle, #0891b2 0%, transparent 70%)",
            top: "60%",
            right: "10%",
            animation: "float 10s ease-in-out infinite 1s",
          }}
        />

        {/* Gold orb — tertiary accent */}
        <div
          style={{
            position: "absolute",
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            filter: "blur(80px)",
            opacity: 0.2,
            background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
            bottom: "10%",
            left: "20%",
            animation: "float 12s ease-in-out infinite 2s",
          }}
        />
      </div>

      {/* Subtle noise texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.08,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-40px) translateX(-10px);
          }
          75% {
            transform: translateY(-20px) translateX(10px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AnimatedBackground;
