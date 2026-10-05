import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useDialogFocus } from '../modal/dialog-focus.hook';

// A floating clay slab anchored to the reading-end edge (right in English,
// left in Arabic — logical properties, §10). Inset from the screen edges by the
// shell gap so it sits with the rail, top bar and status strip rather than
// being glued to the window edge. `icon` and `subtitle` are optional header
// content; `headerActions` sits before the close button. Portalled into <body>
// so no ancestor's mask or transform can capture this fixed layer (see Modal).
export function Drawer({
  title,
  subtitle,
  icon,
  headerActions,
  onClose,
  children,
  width = 420,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useTranslation();
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  return createPortal(
    <div
      onClick={onClose}
      className="backdrop-enter"
      style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 0.28)', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer-enter"
        style={{
          position: 'fixed',
          insetBlock: 'var(--shell-gap)',
          insetInlineEnd: 'var(--shell-gap)',
          width,
          maxWidth: 'calc(100% - 2 * var(--shell-gap))',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-floating)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-4) var(--space-3) var(--space-5)' }}>
          {icon}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-sign)', fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-lg)', fontWeight: 600, color: 'var(--ink)' }}>{title}</h2>
            {subtitle && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{subtitle}</div>}
          </div>
          {headerActions}
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
