import { useEffect, useState } from 'react';

// Departure-board split-flap text (§9.6, §9.9). When the text changes, each
// character ticks through the flap alphabet and settles from left to right,
// the way a gate sign updates. The final text is laid underneath, invisible,
// so the cell keeps its settled width while the flaps are moving.
const FLAP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Mirrors --motion-flap-step; JS needs the number to drive the interval.
const FLAP_STEP_MS = 38;
// Ticks before the first character settles; each later character settles one tick after.
const TICKS_BEFORE_FIRST_SETTLES = 4;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface SplitFlapTextProps {
  text: string;
  /** Lets sibling segments start one after another, like a board updating. */
  startDelayMs?: number;
  /** Placeholders such as "———" stay still. */
  isAnimated?: boolean;
}

export function SplitFlapText({ text, startDelayMs = 0, isAnimated = true }: SplitFlapTextProps) {
  const [shown, setShown] = useState(text);
  const [step, setStep] = useState(Number.MAX_SAFE_INTEGER);

  useEffect(() => {
    if (!isAnimated || prefersReducedMotion()) {
      setShown(text);
      setStep(Number.MAX_SAFE_INTEGER);
      return;
    }
    const target = [...text];
    const lastStep = target.length + TICKS_BEFORE_FIRST_SETTLES;
    let current = 0;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        current += 1;
        setShown(
          target
            .map((ch, i) =>
              current >= i + TICKS_BEFORE_FIRST_SETTLES || !/[A-Z0-9]/i.test(ch)
                ? ch
                : FLAP_ALPHABET[Math.floor(Math.random() * FLAP_ALPHABET.length)],
            )
            .join(''),
        );
        setStep(current);
        if (current >= lastStep) window.clearInterval(interval);
      }, FLAP_STEP_MS);
    }, startDelayMs);
    setStep(0);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [text, startDelayMs, isAnimated]);

  return (
    <span style={{ display: 'inline-grid' }}>
      <span className="sr-only">{text}</span>
      <span aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{text}</span>
      <span aria-hidden style={{ gridArea: '1 / 1', textAlign: 'center', whiteSpace: 'nowrap' }}>
        {[...shown].map((ch, i) => {
          const isSettled = step >= i + TICKS_BEFORE_FIRST_SETTLES;
          return (
            <span key={isSettled ? `s${i}` : `${i}-${step}`} className={isSettled ? 'flap-char' : 'flap-char is-ticking'}>
              {ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}
