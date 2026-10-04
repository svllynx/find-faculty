"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * A single, page-wide motion controller rather than per-component GSAP
 * wiring, so every page stays a server component.
 *
 * Progressive enhancement is the point: every element this touches is fully
 * visible in the server-rendered HTML. Nothing is hidden by CSS and nothing
 * depends on this component running — it only ever animates FROM the
 * already-visible state, so a JS-disabled visitor, a slow connection, or a
 * browser this never finishes hydrating on all see the complete page.
 *
 *   data-hero-reveal       animates in once, immediately, in document order
 *   data-reveal            fades/lifts in the first time it scrolls into view
 *   data-reveal-group      stagger children of [data-reveal] inside this node
 */
export default function ScrollReveal() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const hero = gsap.utils.toArray<HTMLElement>("[data-hero-reveal]");
      if (hero.length) {
        gsap.from(hero, {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
        });
      }

      const groups = gsap.utils.toArray<HTMLElement>("[data-reveal-group]");
      groups.forEach((group) => {
        const items = group.querySelectorAll<HTMLElement>("[data-reveal]");
        if (!items.length) return;
        gsap.from(items, {
          y: 32,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: group,
            start: "top 85%",
            once: true,
          },
        });
      });

      // Standalone [data-reveal] elements not inside a [data-reveal-group].
      const standalone = gsap.utils
        .toArray<HTMLElement>("[data-reveal]")
        .filter((el) => !el.closest("[data-reveal-group]"));
      standalone.forEach((el) => {
        gsap.from(el, {
          y: 32,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            once: true,
          },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
