# Component Integration Guide

## Option 1: Recommended — CSS Animated Background ✅

**What:** Native CSS animated gradient background (matches design system)  
**File:** `src/AnimatedBackground.jsx`  
**Dependencies:** None (pure CSS/React)  
**Bundle impact:** +2KB  
**Performance:** 60fps, accessible (respects prefers-reduced-motion)

### Integration Steps

1. Import in Landing.jsx:
```jsx
import AnimatedBackground from "./AnimatedBackground";

// Wrap your landing page
export default function Landing() {
  return (
    <div className="relative w-full">
      <AnimatedBackground />
      {/* Your existing content here, with relative z-10+ classes */}
    </div>
  );
}
```

2. Update existing content wrapper (add `relative z-10`):
```jsx
<div className="relative z-10">
  {/* Hero content */}
</div>
```

**Benefits:**
✅ Matches fintech aesthetic  
✅ Zero external dependencies  
✅ Lightweight & fast  
✅ WCAG accessible  
✅ Responsive & mobile-friendly  

---

## Option 2: Advanced — Three.js Shader Background ⚠️

If you specifically want the animated shader effect (aurora/plasma style):

### Prerequisites Check

```bash
# Check current setup
npm list three
# Result: three not installed
```

### Step 1: Install Dependencies

```bash
npm install three
```

**Bundle impact:** +700KB (significant)  
**Performance impact:** GPU intensive, may affect battery on mobile

### Step 2: Create Component Structure

**Note:** WealthTrack doesn't use shadcn/ui or TypeScript. Adapt the component:

Create `src/ShaderBackground.jsx`:

```jsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ShaderBackground = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -1, 1, 1, -1, 0, 1
    );
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0f172a, 1);
    container.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;

        #define NUM_OCTAVES 3

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);

          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

          for (float i = 0.0; i < 35.0; i++) {
            v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));
            vec4 auroraColors = vec4(
              0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
              0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
              0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3),
              1.0
            );
            vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
          }

          o = tanh(pow(o / 100.0, vec4(1.6)));
          gl_FragColor = o * 1.5;
        }
      `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId;
    const animate = () => {
      material.uniforms.iTime.value += 0.016;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 z-0 w-full h-full"
      style={{ background: '#0f172a' }}
    />
  );
};

export default ShaderBackground;
```

### Step 3: Update Landing.jsx

Add to top-level wrapper:

```jsx
import ShaderBackground from "./ShaderBackground";

export default function Landing() {
  return (
    <div className="relative w-full overflow-hidden">
      <ShaderBackground />
      
      {/* Wrap all content with relative z-10+ */}
      <div className="relative z-10">
        {/* Your existing landing content */}
      </div>
    </div>
  );
}
```

### Step 4: Performance Optimization

Add to `index.html` for better Three.js performance:

```html
<script>
  // Disable shader background on low-end devices
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    window.disableShaders = true;
  }
</script>
```

Update `src/ShaderBackground.jsx`:

```jsx
if (window.disableShaders) {
  return <div className="fixed inset-0 z-0 bg-slate-950" />;
}
```

---

## Comparison: CSS vs Three.js

| Feature | CSS Option | Three.js Option |
|---------|-----------|-----------------|
| Bundle size | +2KB | +700KB |
| Performance | 60fps, stable | 60fps (GPU), battery drain |
| Mobile friendly | ✅ Yes | ⚠️ Careful |
| Accessibility | ✅ WCAG AA+ | ⚠️ GPU animations |
| Learning curve | Easy | Complex |
| Customization | CSS rules | GLSL shaders |
| Design fit | ✅ Fintech | ❌ AI startup |

---

## ❓ Questions for Your Use Case

1. **What's the goal?**
   - "More visual appeal" → CSS option (recommended)
   - "Specific shader effect needed" → Three.js option

2. **Target audience:**
   - Financial professionals → CSS (trustworthy)
   - Creative/design users → Three.js (impressive)

3. **Performance priorities:**
   - Mobile first → CSS
   - Desktop only → Three.js ok

4. **Budget:**
   - Minimal bandwidth → CSS
   - Premium experience → Three.js

---

## My Recommendation ✅

**Use the CSS AnimatedBackground.jsx** because:

1. ✅ Matches WealthTrack's fintech aesthetic
2. ✅ Zero external dependencies
3. ✅ Lightweight & performant
4. ✅ Fully accessible
5. ✅ Maintains design system integrity

**If you want the Three.js shader:**
- Use it on specific pages (not global background)
- Lazy-load for performance
- Add device memory check
- Test on mobile before deploying

---

## Next Steps

Choose one:

### Option A: Use CSS Background (Recommended)
```bash
# No installation needed
# src/AnimatedBackground.jsx is ready
# Just import in Landing.jsx
```

### Option B: Use Three.js Shader
```bash
npm install three
# Follow Step 1-4 above
```

**Which would you prefer?** 🚀
