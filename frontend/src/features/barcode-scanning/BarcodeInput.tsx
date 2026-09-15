import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanLine, Keyboard, Search } from 'lucide-react';

// Two ways to provide a barcode (§6):
//   1. "Scan"   — placeholder until the wireless HID scanner is bought. When the
//                 device arrives it types into a global listener; no code change
//                 to this component's contract is expected.
//   2. "Manual" — a text field, always available (damaged label / no device).
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = value.trim();
    if (code) onSubmit(code);
  };

  const tab = (m: Mode, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '7px 12px', fontSize: 'var(--text-xs)', fontWeight: 500, cursor: 'pointer',
        border: 'none', background: mode === m ? 'var(--surface)' : 'transparent',
        color: mode === m ? 'var(--primary)' : 'var(--ink-muted)',
        borderBottom: mode === m ? '2px solid var(--primary)' : '2px solid transparent',
      }}
    >
      {icon}
      {text}
    </button>
  );

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
      {label && (
        <div style={{ padding: '10px 16px 0', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: '2px', padding: '8px 12px 0', borderBottom: '1px solid var(--hairline)' }}>
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
                flex: 1, height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
                background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px',
                borderRadius: 'var(--radius-md)', border: 'none',
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
          // Scan mode — deliberately inert until the device is purchased.
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            padding: 'var(--space-6)', border: '1px dashed var(--hairline-strong)', borderRadius: 'var(--radius-md)',
            textAlign: 'center', color: 'var(--ink-muted)',
          }}>
            <ScanLine size={28} strokeWidth={1.25} />
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink)' }}>{t('barcode.scanUnavailableTitle')}</div>
            <div style={{ fontSize: 'var(--text-xs)', maxWidth: '380px' }}>{t('barcode.scanUnavailableBody')}</div>
            <span style={{ marginTop: '2px', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--warn)', background: 'var(--warn-soft)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
              {t('barcode.deviceComingSoon')}
            </span>
          </div>
        )}

        {error && <div role="alert" style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--critical)' }}>{error}</div>}
      </div>
    </section>
  );
}
