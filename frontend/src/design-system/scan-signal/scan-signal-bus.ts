// Scan feedback that any screen can raise (§6: "distinct audio and haptic
// feedback for accepted, rejected and duplicate — the store room is noisy").
// A tiny publish/subscribe bus rather than a store: a signal is a momentary
// event, not state anyone needs to read back (§4 keeps Zustand for theme,
// language and the offline queue).
export type ScanSignalKind = 'accepted' | 'rejected' | 'duplicate';

export interface ScanSignal {
  kind: ScanSignalKind;
  /** The code or name the operator just scanned, shown large on the sign. */
  headline: string;
  /** One line saying what happened or what to do next. */
  detail?: string;
  id: number;
}

type Listener = (signal: ScanSignal) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function signalScan(kind: ScanSignalKind, headline: string, detail?: string): void {
  const signal: ScanSignal = { kind, headline, detail, id: nextId++ };
  playScanSound(kind);
  vibrateForScan(kind);
  listeners.forEach((listener) => listener(signal));
}

export function subscribeToScanSignals(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Three patterns that cannot be confused by ear: one high beep (accepted),
// two low buzzes (rejected), two short mid blips (duplicate).
const SOUND_PATTERNS: Record<ScanSignalKind, { wave: OscillatorType; notes: Array<[number, number]> }> = {
  accepted: { wave: 'sine', notes: [[1320, 0.09]] },
  rejected: { wave: 'square', notes: [[220, 0.16], [180, 0.22]] },
  duplicate: { wave: 'sine', notes: [[660, 0.05], [660, 0.05]] },
};
const VIBRATION_PATTERNS: Record<ScanSignalKind, number[]> = {
  accepted: [40],
  rejected: [80, 60, 80],
  duplicate: [30, 40, 30],
};

let audioContext: AudioContext | null = null;

function playScanSound(kind: ScanSignalKind): void {
  try {
    audioContext ??= new AudioContext();
    const pattern = SOUND_PATTERNS[kind];
    let at = audioContext.currentTime;
    for (const [frequency, duration] of pattern.notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = pattern.wave;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + duration);
      at += duration + 0.06;
    }
  } catch {
    // Audio can be blocked before the first user gesture; the visual sign still shows.
  }
}

function vibrateForScan(kind: ScanSignalKind): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(VIBRATION_PATTERNS[kind]);
}
