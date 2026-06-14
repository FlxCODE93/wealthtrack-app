/**
 * WealthTrack — Utilitaires GSAP partagés pour le motion design.
 *
 * Toutes les animations respectent `prefers-reduced-motion` et restent
 * dans une fourchette de 150-800ms. Centralisé ici pour éviter de
 * dupliquer la logique de count-up / célébration entre FI.jsx, App.jsx, etc.
 */
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { C } from "../theme.js";

gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };

/* ─── Reduced motion ─────────────────────────────────────────────────── */
export function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/* ─── Valeur précédente (pour détecter les transitions) ─────────────── */
export function usePrevious(value) {
  const ref = useRef(value);
  const prev = ref.current;
  useEffect(() => { ref.current = value; });
  return prev;
}

/* ─── Count-up : ref à attacher à un <span> ──────────────────────────── */
export function useCountUp(value, { duration = 0.6, formatter = (n) => String(Math.round(n)), ease = "power2.out" } = {}) {
  const ref = useRef(null);
  const prev = usePrevious(value);
  const tweenRef = useRef(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    if (tweenRef.current) tweenRef.current.kill();

    if (prev === value || prefersReducedMotion()) {
      el.textContent = formatter(value);
      return;
    }
    const obj = { v: prev ?? value };
    tweenRef.current = gsap.to(obj, {
      v: value,
      duration,
      ease,
      onUpdate: () => { el.textContent = formatter(obj.v); },
      onComplete: () => { el.textContent = formatter(value); },
    });
  }, { dependencies: [value], scope: ref });

  return ref;
}

/* ─── <AnimatedNumber /> : nombre qui s'anime à chaque changement ────── */
export function AnimatedNumber({ value, formatter = (n) => String(Math.round(n)), duration = 0.6, className, style }) {
  const ref = useCountUp(value, { duration, formatter });
  return <span ref={ref} className={className} style={style}>{formatter(value)}</span>;
}

/* ─── <GrowthValue /> : count-up + pop + flash de couleur (gain/perte) ─
   `flashRef` (optionnel) : élément externe à illuminer (ex: la carte KPI
   entière) — sinon le flash reste localisé au wrapper inline du chiffre. */
export function GrowthValue({ value, formatter = (n) => String(Math.round(n)), duration = 0.7, className, style, flashRef }) {
  const wrapRef = useRef(null);
  const numRef = useRef(null);
  const prev = usePrevious(value);
  const tlRef = useRef(null);

  useGSAP(() => {
    const numEl = numRef.current;
    if (!numEl) return;
    if (tlRef.current) tlRef.current.kill();

    if (prev === value || prefersReducedMotion()) {
      numEl.textContent = formatter(value);
      return;
    }

    const diff = value - prev;
    const positive = diff >= 0;
    const flashRGB = positive ? "0,200,150" : "255,92,122";
    const obj = { v: prev };
    const tl = gsap.timeline();

    tl.to(obj, {
      v: value,
      duration,
      ease: "power2.out",
      onUpdate: () => { numEl.textContent = formatter(obj.v); },
      onComplete: () => { numEl.textContent = formatter(value); },
    }, 0);

    // Pop sur le chiffre lui-même — feedback "ça bouge" immédiat
    tl.fromTo(numEl,
      { scale: 1 },
      { scale: 1.08, duration: 0.2, ease: "power2.out", yoyo: true, repeat: 1, transformOrigin: "left center" },
      0
    );

    const flashEl = flashRef?.current || wrapRef.current;
    if (flashEl) {
      tl.fromTo(flashEl,
        { backgroundColor: `rgba(${flashRGB},0.28)`, boxShadow: `inset 0 0 0 1px rgba(${flashRGB},0.45)` },
        {
          backgroundColor: `rgba(${flashRGB},0)`, boxShadow: `inset 0 0 0 1px rgba(${flashRGB},0)`,
          duration: duration + 0.35, ease: "power1.out",
          onComplete: () => gsap.set(flashEl, { clearProps: "backgroundColor,boxShadow" }),
        },
        0
      );
    }
    tlRef.current = tl;
  }, { dependencies: [value], scope: wrapRef });

  return (
    <span ref={wrapRef} className={className} style={{ borderRadius: 6, display: "inline-block", ...style }}>
      <span ref={numRef} style={{ display: "inline-block" }}>{formatter(value)}</span>
    </span>
  );
}

/* ─── Confettis : burst de particules pour les moments à fort impact ──
   Crée des nœuds DOM imperatifs dans `containerEl` (doit être un élément
   vide, non géré par React — typiquement un <div> de overlay avec
   position:absolute/inset:0/overflow:visible) puis les anime et les
   retire eux-mêmes en fin de course. */
export const CONFETTI_COLORS = [C.green, C.amber, C.blue, C.violet, C.greenSoft];

export function confettiBurst(containerEl, { count = 18, colors = CONFETTI_COLORS } = {}) {
  if (!containerEl || prefersReducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    const size = 4 + Math.random() * 5;
    const tall = Math.random() > 0.5;
    el.style.cssText =
      `position:absolute;left:50%;top:50%;width:${size}px;height:${tall ? size * 2.6 : size}px;` +
      `background:${colors[i % colors.length]};border-radius:${tall ? "2px" : "50%"};` +
      `pointer-events:none;will-change:transform,opacity;`;
    containerEl.appendChild(el);

    const angle = -Math.random() * Math.PI; // hémisphère supérieur (éclate vers le haut)
    const dist  = 36 + Math.random() * 56;
    gsap.to(el, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist + 50, // léger effet de gravité en fin de course
      rotation: (Math.random() - 0.5) * 420,
      opacity: 0,
      scale: 0.5,
      duration: 0.7 + Math.random() * 0.5,
      ease: "power2.out",
      onComplete: () => el.remove(),
    });
  }
}

/* ─── Célébration : pop + ripple + confettis, pour jalons/records/gains ─ */
export function celebrate({ cardEl, ringEl, iconEl, confettiEl, color = "#00c896", confettiColors } = {}) {
  if (prefersReducedMotion()) return null;
  const tl = gsap.timeline();

  if (cardEl) {
    tl.to(cardEl, { scale: 1.08, duration: 0.18, ease: "power2.out", transformOrigin: "50% 50%" }, 0)
      .to(cardEl, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" }, 0.18);
  }
  if (iconEl) {
    tl.fromTo(iconEl,
      { scale: 0.5, rotate: -35 },
      { scale: 1, rotate: 0, duration: 0.5, ease: "back.out(2.5)", transformOrigin: "50% 50%" },
      0
    );
  }
  if (ringEl) {
    tl.fromTo(ringEl,
      { opacity: 0.9, scale: 1, borderColor: color },
      { opacity: 0, scale: 1.35, duration: 0.7, ease: "power2.out" },
      0
    );
  }
  if (confettiEl) {
    confettiBurst(confettiEl, confettiColors ? { colors: confettiColors } : undefined);
  }
  return tl;
}

/* ─── Hook : déclenche une célébration au passage false → true ───────── */
export function useCelebrateOnTrue(flag, { cardRef, ringRef, iconRef, confettiRef, color, confettiColors } = {}) {
  const prevFlag = usePrevious(flag);
  useGSAP(() => {
    if (!prevFlag && flag) {
      celebrate({
        cardEl: cardRef?.current, ringEl: ringRef?.current, iconEl: iconRef?.current,
        confettiEl: confettiRef?.current, color, confettiColors,
      });
    }
  }, { dependencies: [flag] });
}

/* ─── Toast de célébration : bannière qui slide depuis le haut ───────── */
export function CelebrationToast({ show, onDone, icon, title, subtitle, color = C.green }) {
  const ref = useRef(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el || !show) return;

    if (prefersReducedMotion()) {
      const t = setTimeout(() => onDone?.(), 2200);
      return () => clearTimeout(t);
    }

    const tl = gsap.timeline({ onComplete: () => onDone?.() });
    tl.fromTo(el,
      { y: -100, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }
    ).to(el, { y: -100, opacity: 0, duration: 0.35, ease: "power2.in" }, "+=2.2");

    return () => tl.kill();
  }, { dependencies: [show] });

  if (!show) return null;

  // Wrapper plein-largeur + flex centering : évite tout calcul de
  // translateX(-50%) qui entrerait en conflit avec les tweens GSAP.
  return (
    <div style={{
      position: "fixed", top: 16, left: 0, right: 0, zIndex: 9999,
      display: "flex", justifyContent: "center", pointerEvents: "none", padding: "0 16px",
    }}>
      <div ref={ref} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 20px", borderRadius: 999,
        background: "rgba(20,20,45,0.92)", backdropFilter: "blur(12px)",
        border: `1px solid ${color}55`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${color}33`,
        maxWidth: "100%", pointerEvents: "auto",
      }}>
        {icon}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

/* ─── Hook : file d'attente simple pour <CelebrationToast/> ──────────── */
export function useCelebrationToast() {
  const [toast, setToast] = useState(null);
  const node = (
    <CelebrationToast {...(toast || {})} show={!!toast} onDone={() => setToast(null)} />
  );
  return [node, setToast];
}

/* ─── Barre de progression de scroll : fine barre fixe en haut de page ─
   S'anime en largeur (scaleX) selon la position de scroll de la page —
   esthétique "SaaS premium" (Linear, Vercel…), gradient signature de l'app. */
export function ScrollProgressBar({ color }) {
  const barRef = useRef(null);

  useGSAP(() => {
    const bar = barRef.current;
    if (!bar) return;

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (prefersReducedMotion()) gsap.set(bar, { scaleX: progress });
      else gsap.to(bar, { scaleX: progress, duration: 0.3, ease: "power2.out", overwrite: true });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 9999, pointerEvents: "none" }}>
      <div ref={barRef} style={{
        height: "100%", width: "100%", transformOrigin: "0% 50%", transform: "scaleX(0)",
        background: color || C.gradientPrimary,
        boxShadow: `0 0 12px ${C.violet}66`,
      }} />
    </div>
  );
}
