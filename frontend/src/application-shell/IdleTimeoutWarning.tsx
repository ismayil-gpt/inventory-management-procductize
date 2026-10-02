import { useTranslation } from 'react-i18next';
import { useDialogFocus } from '../design-system/modal/dialog-focus.hook';

// Shown in the last minute before an idle sign-out (DESC control 6).
export function IdleTimeoutWarning({ secondsLeft, onStay }: { secondsLeft: number; onStay: () => void }) {
  const { t } = useTranslation();
  // Escape counts as "stay": the person is clearly at the keyboard.
  const dialogRef = useDialogFocus<HTMLDivElement>(onStay);
  return (
    <div className="backdrop-enter" style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', padding: 'var(--space-6)', background: 'rgb(0 0 0 / 0.4)' }}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-timeout-title"
        aria-describedby="idle-timeout-body"
        className="float-enter"
        style={{ width: 'min(420px, 100%)', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-floating)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <h2 id="idle-timeout-title" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t('idleTimeout.title')}</h2>
        <p id="idle-timeout-body" style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--ink-muted)' }}>
          {t('idleTimeout.body', { seconds: secondsLeft })}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onStay}
          style={{ height: '44px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--sign-go)', color: 'var(--sign-on-go)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer' }}
        >
          {t('idleTimeout.stay')}
        </button>
      </div>
    </div>
  );
}
