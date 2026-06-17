import { useRef, useEffect } from "react";
import * as THREE from "three";

const vertexShader = `
  uniform float time;
  uniform float intensity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(pos.x * 10.0 + time) * 0.1 * intensity;
    pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * intensity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  uniform float intensity;
  uniform vec3 color1;
  uniform vec3 color2;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float noise = sin(uv.x * 20.0 + time) * cos(uv.y * 15.0 + time * 0.8);
    noise += sin(uv.x * 35.0 - time * 2.0) * cos(uv.y * 25.0 + time * 1.2) * 0.5;
    vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
    color = mix(color, vec3(1.0), pow(abs(noise), 2.0) * intensity);
    float glow = 1.0 - length(uv - 0.5) * 2.0;
    glow = pow(max(glow, 0.0), 2.0);
    gl_FragColor = vec4(color * glow, glow * 0.8);
  }
`;

export default function PaperShaderBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const planes = [
      { pos: [0, 0, 0], c1: "#7c3aed", c2: "#0891b2" },
      { pos: [-0.5, 0.3, 0], c1: "#4f46e5", c2: "#7c3aed" },
      { pos: [0.5, -0.3, 0], c1: "#0d9488", c2: "#4f46e5" },
    ].map(({ pos, c1, c2 }) => {
      const uniforms = {
        time: { value: 0 },
        intensity: { value: 1.0 },
        color1: { value: new THREE.Color(c1) },
        color2: { value: new THREE.Color(c2) },
      };
      const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 32, 32), mat);
      mesh.position.set(...pos);
      scene.add(mesh);
      return { mesh, uniforms };
    });

    let animId;
    const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime() * 0.4;
      planes.forEach(({ uniforms }) => {
        uniforms.time.value = t;
        uniforms.intensity.value = 0.6 + Math.sin(t * 0.8) * 0.2;
      });
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", background: "#0f172a", width: "100%", height: "100%" }} />
  );
}
