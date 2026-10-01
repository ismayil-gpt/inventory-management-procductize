import { useEffect, useRef, useState } from 'react';

// Keyboard-wedge scanner listener (§6). The wireless scanner "types" the
// barcode and presses Enter; it is told apart from a person by speed — a
// scanner sends keys under 30 ms apart, a person cannot. No focused field is
// needed: the store keeper never has to tap an input first.
const MAX_SCANNER_KEY_GAP_MS = 30;
const IDLE_FLUSH_MS = 100;
const MIN_BARCODE_LENGTH = 4;
const DUPLICATE_WINDOW_MS = 1500;

interface ScannerListenerOptions {
  isEnabled: boolean;
  onScan: (code: string) => void;
  /** The same code arrived again within 1.5 s — usually a double trigger. */
  onDuplicate?: (code: string) => void;
}

export function useBarcodeScannerListener({ isEnabled, onScan, onDuplicate }: ScannerListenerOptions): void {
  // Latest callbacks without re-binding the key listener on every render.
  const handlers = useRef({ onScan, onDuplicate });
  handlers.current = { onScan, onDuplicate };
  // Kept outside the effect: the listener pauses while a lookup runs, and the
  // duplicate window must survive that pause.
  const lastScan = useRef({ code: '', at: 0 });

  useEffect(() => {
    if (!isEnabled) return;
    let buffer = '';
    let lastKeyAt = 0;
    let idleTimer: number | undefined;

    const flush = () => {
      const code = buffer.trim();
      buffer = '';
      if (code.length < MIN_BARCODE_LENGTH) return;
      const now = Date.now();
      if (code === lastScan.current.code && now - lastScan.current.at < DUPLICATE_WINDOW_MS) {
        handlers.current.onDuplicate?.(code);
        return;
      }
      lastScan.current = { code, at: now };
      handlers.current.onScan(code);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Typing in a real field (quantity, reason, search) is never a scan.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const now = performance.now();
      if (event.key === 'Enter') {
        if (buffer.length >= MIN_BARCODE_LENGTH) event.preventDefault();
        window.clearTimeout(idleTimer);
        flush();
        return;
      }
      if (event.key.length !== 1) return;
      // A slow key means a person started typing: drop what was buffered.
      if (now - lastKeyAt > MAX_SCANNER_KEY_GAP_MS) buffer = '';
      buffer += event.key;
      lastKeyAt = now;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(flush, IDLE_FLUSH_MS);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(idleTimer);
    };
  }, [isEnabled]);
}

// Only one barcode field may take scanner input at a time — a page such as a
// transfer has a "from", a "to" and a product field. The field the operator
// last switched to Scan (or tapped) holds the scanner; the others wait.
let scannerHolderId: string | null = null;
const holderListeners = new Set<() => void>();

export function claimScanner(fieldId: string): void {
  scannerHolderId = fieldId;
  holderListeners.forEach((notify) => notify());
}

export function releaseScanner(fieldId: string): void {
  if (scannerHolderId !== fieldId) return;
  scannerHolderId = null;
  holderListeners.forEach((notify) => notify());
}

export function useHoldsScanner(fieldId: string): boolean {
  const [holds, setHolds] = useState(scannerHolderId === fieldId);
  useEffect(() => {
    const notify = () => setHolds(scannerHolderId === fieldId);
    holderListeners.add(notify);
    notify();
    return () => {
      holderListeners.delete(notify);
    };
  }, [fieldId]);
  return holds;
}
