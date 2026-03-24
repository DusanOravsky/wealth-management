"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 (or previous value) to `target` over `duration` ms.
 * Returns the current animated value.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }

    startValueRef.current = value;
    startRef.current = null;

    function easeOut(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const current = startValueRef.current + (target - startValueRef.current) * easeOut(progress);
      setValue(Math.round(current));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
