import { FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanLine, Keyboard, Search } from 'lucide-react';
import { claimScanner, releaseScanner, useBarcodeScannerListener, useHoldsScanner } from './barcode-scanner-listener.hook';
import { signalScan } from '../../design-system/scan-signal/scan-signal-bus';

// Two ways to provide a barcode (§6):
//   1. "Scan"   — listens for the wireless keyboard-wedge scanner anywhere on the
//                 page; no field needs focus. One field holds the scanner at a time.
//   2. "Manual" — a text field, always available (damaged label / flat battery).
type Mode = 'scan' | 'manual';

interface BarcodeInputProps {
  onSubmit: (code: string) => void;
  busy?: boolean;
  error?: string | null;
  label?: string;
}

export function BarcodeInput({ onSubmit, busy = false, error = null, label }: BarcodeInputProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('manual');
  const [value, setValue] = useState('');
  const fieldId = useId();
  const holdsScanner = useHoldsScanner(fieldId);

  const chooseMode = (next: Mode) => {
    setMode(next);
    if (next === 'scan') claimScanner(fieldId);
    else releaseScanner(fieldId);
  };
  useEffect(() => () => releaseScanner(fieldId), [fieldId]);

  useBarcodeScannerListener({
    isEnabled: mode === 'scan' && holdsScanner && !busy,
    onScan: onSubmit,
    onDuplicate: (code) => signalScan('duplicate', code, t('scanSignal.duplicateDetail')),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = value.trim();
    if (code) onSubmit(code);
  };

  const tab = (m: Mode, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => chooseMode(m)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
        border: 'none', borderRadius: 'var(--radius-sm)',
        // The chosen mode rises out of the pressed-in switch.
        background: mode === m ? 'var(--surface)' : 'transparent',
        boxShadow: mode === m ? 'var(--clay-raised-sm)' : 'none',
        color: mode === m ? 'var(--ink)' : 'var(--ink-muted)',
      }}
    >
      {icon}
      {text}
    </button>
  );

  return (
    <section style={{ background: 'var(--surface)', border: 'none', boxShadow: 'var(--clay-raised)', borderRadius: 'var(--radius-panel)' }}>
      {label && (
        <div style={{ padding: '10px 16px 0', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', width: 'fit-content', gap: '4px', margin: '12px 16px 0', padding: '4px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)' }}>
        {tab('manual', <Keyboard size={15} strokeWidth={1.5} />, t('barcode.manualMode'))}
        {tab('scan', <ScanLine size={15} strokeWidth={1.5} />, t('barcode.scanMode'))}
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {mode === 'manual' ? (
          <form onSubmit={submit} style={{ display: 'flex', gap: '8px' }}>
            <input
              autoFocus
              dir="ltr"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('barcode.manualPlaceholder')}
              style={{
                flex: 1, height: '36px', borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-pressed)',
                background: 'var(--surface-sunken)', color: 'var(--ink)', padding: '0 12px',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px',
                borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-tinted)',
                background: busy || !value.trim() ? 'var(--ink-faint)' : 'var(--primary)',
                color: 'var(--on-primary)', fontSize: 'var(--text-sm)', fontWeight: 500,
                cursor: busy || !value.trim() ? 'default' : 'pointer',
              }}
            >
              <Search size={16} strokeWidth={1.5} />
              {t('barcode.find')}
            </button>
          </form>
        ) : (
          // Scan mode — the listener above is live; this panel says whether this
          // field holds the scanner, and tapping it takes the scanner over.
          <button
            type="button"
            onClick={() => claimScanner(fieldId)}
            aria-pressed={holdsScanner}
            style={{
              width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              padding: 'var(--space-6)', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer',
              border: holdsScanner ? 'none' : '2px dashed var(--hairline-strong)',
              boxShadow: holdsScanner ? 'var(--clay-gantry)' : 'none',
              background: holdsScanner ? 'var(--gantry)' : 'transparent',
              color: holdsScanner ? 'var(--gantry-ink)' : 'var(--ink-muted)',
            }}
          >
            <ScanLine size={28} strokeWidth={1.25} aria-hidden />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {holdsScanner ? (busy ? t('common.loading') : t('barcode.scanReadyTitle')) : t('barcode.scanTakeOverTitle')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', maxWidth: '380px' }}>
              {holdsScanner && <span className="beacon" aria-hidden />}
              {holdsScanner ? t('barcode.scanReadyBody') : t('barcode.scanTakeOverBody')}
            </span>
          </button>
        )}

        {error && <div role="alert" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--critical)' }}>{error}</div>}
      </div>
    </section>
  );
}
