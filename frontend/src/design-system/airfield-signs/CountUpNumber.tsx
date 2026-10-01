import { useEffect, useRef, useState } from 'react';

// Counts a figure up to its value when it first appears or changes (§9.9,
// expanded 2026-10-01). The settled value is always the real number; only the
// journey to it is animated, and reduced-motion users see the value at once.
const COUNT_DURATION_MS = 480; // mirrors --motion-slow

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

export function CountUpNumber({ value, format = (n) => n.toLocaleString('en-US') }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    fromRef.current = value;
    if (isReduced || from === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_DURATION_MS);
      setShown(Math.round(from + (value - from) * easeOutCubic(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className="tabular">
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}
