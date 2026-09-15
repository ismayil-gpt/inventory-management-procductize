import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../modal/Modal';
import { ApiError } from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';

/**
 * A guarded confirmation dialog for destructive actions. It runs `onConfirm`,
 * keeps its own busy/error state, and shows the backend's localised message when
 * a delete is refused (e.g. "has history — deactivate instead") without closing.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  danger = true,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? (language === 'ar' ? e.body.messageAr : e.body.messageEn) ?? t('errors.generic') : t('errors.generic'));
      setBusy(false);
    }
  };

  const btn: React.CSSProperties = { height: '36px', padding: '0 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer' };
  const confirmBg = danger ? 'var(--critical)' : 'var(--primary)';

  return (
    <Modal title={title} onClose={busy ? () => undefined : onClose} width={420}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <span style={{ color: danger ? 'var(--critical)' : 'var(--primary)', marginTop: '1px', flexShrink: 0 }}><AlertTriangle size={20} strokeWidth={1.75} /></span>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.6 }}>{message}</div>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--critical-soft)', border: '1px solid var(--critical)', borderRadius: 'var(--radius-md)', color: 'var(--critical)', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
        <button type="button" onClick={onClose} disabled={busy} style={{ ...btn, border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}>{t('common.cancel')}</button>
        <button type="button" onClick={() => void run()} disabled={busy} style={{ ...btn, border: 'none', background: busy ? 'var(--ink-faint)' : confirmBg, color: 'var(--on-primary)' }}>
          {busy ? t('common.deleting') : (confirmLabel ?? t('common.delete'))}
        </button>
      </div>
    </Modal>
  );
}
