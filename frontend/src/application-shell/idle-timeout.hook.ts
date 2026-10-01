import { useCallback, useEffect, useRef, useState } from 'react';

// DESC control 6 — idle timeout (CLAUDE.md §11.1): after a configured period
// with no activity the user is signed out and must sign in again. Activity is
// shared through localStorage, so working in one tab keeps the others alive.
// A warning appears shortly before sign-out so a store keeper mid-task is not
// surprised.
const LAST_ACTIVITY_KEY = 'mizan.lastActivity';
const WARNING_BEFORE_MS = 60_000;
const CHECK_EVERY_MS = 5_000;
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

function readLastActivity(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

export function writeLastActivity(at: number): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Storage unavailable: this tab still tracks its own activity in memory.
  }
}

export interface IdleTimeoutState {
  /** Seconds left before sign-out while the warning is showing; null otherwise. */
  secondsLeft: number | null;
  stayActive: () => void;
}

export function useIdleTimeout(timeoutMinutes: number | undefined, onTimeout: () => void): IdleTimeoutState {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Latest callback without restarting the timer when the caller re-renders.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const stayActive = useCallback(() => {
    writeLastActivity(Date.now());
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;
    const timeoutMs = timeoutMinutes * 60_000;
    let lastWrite = 0;
    // Signing in counts as activity; a later restart of this effect must not.
    let localActivity = readLastActivity();

    const onActivity = () => {
      // Any activity, including during the warning, means the person is back.
      localActivity = Date.now();
      if (localActivity - lastWrite > ACTIVITY_WRITE_THROTTLE_MS) {
        lastWrite = localActivity;
        writeLastActivity(localActivity);
      }
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const last = Math.max(readLastActivity(), localActivity);
      const remaining = timeoutMs - (Date.now() - last);
      if (remaining <= 0) {
        window.clearInterval(timer);
        setSecondsLeft(null);
        onTimeoutRef.current();
      } else if (remaining <= WARNING_BEFORE_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, CHECK_EVERY_MS);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
    };
  }, [timeoutMinutes]);

  return { secondsLeft, stayActive };
}
