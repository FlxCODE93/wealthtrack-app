import { useEffect, useRef } from "react";

/**
 * useScrollReveal — Intersection Observer pour animations au scroll
 * Ajoute la classe 'wt-revealed' quand l'élément entre dans le viewport
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const defaultOptions = {
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px",
      ...options,
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("wt-revealed");
        observer.unobserve(el);
      }
    }, defaultOptions);

    observer.observe(el);

    return () => observer.disconnect();
  }, [options]);

  return ref;
}

/**
 * useScrollRevealMultiple — Pour animer plusieurs éléments enfants
 * Ajoute 'wt-revealed' à chaque enfant avec délai
 */
export function useScrollRevealMultiple(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const defaultOptions = {
      threshold: 0.15,
      rootMargin: "0px 0px -50px 0px",
      ...options,
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const children = entry.target.querySelectorAll(".wt-reveal");
        children.forEach((child, index) => {
          setTimeout(() => {
            child.classList.add("wt-revealed");
          }, index * 100); // 100ms stagger
        });
        observer.unobserve(container);
      }
    }, defaultOptions);

    observer.observe(container);

    return () => observer.disconnect();
  }, [options]);

  return ref;
}
