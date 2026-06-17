# WealthTrack — Shader Background Prompt

Update or replace the WebGL shader background in `src/AnoAI.jsx`.

## Current Implementation
File: `src/AnoAI.jsx`
Tech: plain Three.js (no @react-three/fiber — it crashes with React 18).
Renderer: `THREE.WebGLRenderer`, `OrthographicCamera(-1,1,1,-1,0,1)`, full-screen `PlaneGeometry(2,2)`.
Position: `fixed`, `inset: 0`, `z-index: -1`, `pointerEvents: none`.
Clear color: `0x0f172a` (fallback if shader fails).
Pixel ratio: `window.devicePixelRatio`.
Animation: `requestAnimationFrame` loop, `iTime += 0.016` per frame (~60fps).
Uniforms: `iTime: float`, `iResolution: vec2`.

## Current Shader — Aurora / Diagonal Light Rays
The fragment shader produces **35 diagonal aurora rays** with:
- fBm noise (3 octaves, 0.3 amplitude) for organic turbulence
- Per-ray color: `sin/cos` oscillation across violet `(0.1,0.3,0.8)` → teal range
- Attenuation: `exp(sin(fi²)) / length(max(v, ...))` — bright core, soft fallout
- Thinness gradient: `smoothstep(0, 1, fi/35) * 0.8`
- Tail noise: `fbm * 0.3 * (1 - fi/35)` — textured fade
- Tone mapping: `tanh(pow(o/80, 1.4)) * 2.0`
- Subtle camera shake: `sin(iTime*1.2)*0.005`, `cos(iTime*2.1)*0.005`
- Diagonal projection matrix: `mat2(6,-4,4,6)` — creates the angled beam look

## Visual Result
Deep dark background (`#0f172a` base) with slow-moving diagonal light beams. 
Colors shift between violet, indigo, cyan, teal over time. 
Organic, not geometric — feels alive. 
Subtle, not overwhelming — content stays readable on top.

## Brand Constraint
Must feel: **dark-luxury fintech, premium, cinematic**.
Palette: violet (`#7c3aed`), indigo (`#4f46e5`), deep blue (`#0f172a` base).
Avoid: pure black, neon green, hot pink, orange.
Performance: `powerPreference: "high-performance"`, no heavy post-processing.

## Architecture Rules (CRITICAL)
- **Never import `@react-three/fiber`** — incompatible with React 18, crashes at `createReconciler`
- Use plain `import * as THREE from "three"` only (`three` v0.184.0 installed)
- Always cleanup: `cancelAnimationFrame`, `removeEventListener`, `geometry.dispose()`, `material.dispose()`, `renderer.dispose()`
- Container must clear existing children before appending: `while (container.firstChild) container.removeChild(container.firstChild)`
- Wrap everything in `try/catch` — silent fallback to clear color if WebGL unavailable
- Export default: `export default AnoAI`

## Replacement Template
```jsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const AnoAI = () => {
  const containerRef = useRef(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2x
      renderer.setClearColor(0x020617, 1);
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(renderer.domElement);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        },
        vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
        fragmentShader: `/* YOUR GLSL HERE */`,
      });

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(mesh);

      let frameId;
      const animate = () => {
        material.uniforms.iTime.value += 0.016;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener("resize", onResize);
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        mesh.geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    } catch (e) {
      console.error("Shader Error:", e);
    }
  }, []);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }} />;
};

export default AnoAI;
```

## Where It's Used
- `src/Landing.jsx` — imported and rendered as first child of the page root
- Renders below `HeroOrbs` (z:1) and all content (z:2)
- Previous experiments tried and reverted:
  - MeshGradient (@paper-design/shaders-react) — reverted, user preferred AnoAI
  - PaperShaderBackground (vanilla Three.js ShaderPlane) — reverted, user preferred AnoAI
