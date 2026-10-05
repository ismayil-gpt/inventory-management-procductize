import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useDialogFocus } from './dialog-focus.hook';

// A floating clay dialog. Rendered into <body> through a portal: pages sit
// inside the shell's scroll area, whose edge-fade mask would otherwise become
// the containing block for this fixed layer — the backdrop would cover only the
// work area and the dialog would centre on it instead of the screen.
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const { t } = useTranslation();
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  return createPortal(
    <div
      onClick={onClose}
      className="backdrop-enter"
      style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 0.32)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 'var(--space-4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="float-enter"
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-floating)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-4) var(--space-4) var(--space-6)', borderBottom: '1px solid var(--hairline)', position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-sign)', fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-lg)', fontWeight: 600, color: 'var(--ink)' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
            style={{ width: '36px', height: '36px', display: 'inline-grid', placeItems: 'center', flex: 'none', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--surface)', boxShadow: 'var(--clay-raised-sm)', color: 'var(--ink-muted)', cursor: 'pointer' }}
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div style={{ padding: 'var(--space-6)' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
