import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Copy } from 'lucide-react';
import { subscribeToScanSignals, type ScanSignal } from './scan-signal-bus';

// Full-screen confirmation of a scan, readable at arm's length (§18.3). The
// sign types keep their meaning: yellow direction sign = accepted, red
// mandatory sign = rejected, location sign = duplicate (ignored). It never
// blocks work: it ignores pointer events and clears itself.
const VISIBLE_MS: Record<ScanSignal['kind'], number> = { accepted: 900, duplicate: 900, rejected: 1800 };

export function ScanSignalOverlay() {
  const { t } = useTranslation();
  const [signal, setSignal] = useState<ScanSignal | null>(null);

  useEffect(() => subscribeToScanSignals(setSignal), []);

  useEffect(() => {
    if (!signal) return;
    const timer = window.setTimeout(() => setSignal(null), VISIBLE_MS[signal.kind]);
    return () => window.clearTimeout(timer);
  }, [signal]);

  if (!signal) return null;

  const look = {
    accepted: { className: 'sign-go', Icon: Check, label: t('scanSignal.accepted') },
    rejected: { className: 'sign-stop', Icon: X, label: t('scanSignal.rejected') },
    duplicate: { className: 'sign-location', Icon: Copy, label: t('scanSignal.duplicate') },
  }[signal.kind];

  return (
    <div
      role={signal.kind === 'rejected' ? 'alert' : 'status'}
      aria-live="assertive"
      className="backdrop-enter"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-6)',
        background: 'rgb(0 0 0 / 0.25)',
        pointerEvents: 'none',
      }}
    >
      <div
        key={signal.id}
        className={`${look.className} sign-enter`}
        style={{
          width: 'min(560px, 100%)',
          padding: 'var(--space-8) var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-floating)',
        }}
      >
        <look.Icon size={56} strokeWidth={2.25} aria-hidden />
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{look.label}</div>
        <div dir="ltr" style={{ fontFamily: 'var(--font-sign)', fontWeight: 600, fontSize: '40px', lineHeight: 1.1, wordBreak: 'break-word' }}>
          {signal.headline}
        </div>
        {signal.detail && <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{signal.detail}</div>}
      </div>
    </div>
  );
}
