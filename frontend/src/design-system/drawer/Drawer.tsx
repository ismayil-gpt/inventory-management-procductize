import { ReactNode } from 'react';
import { X } from 'lucide-react';

// Edge-anchored panel (§9.5 — radius-lg, shadow only on floating layers). Anchors to
// the reading-end edge via a logical property so it flips sides automatically in RTL
// (§10) — right in English, left in Arabic — without any direction-specific code here.
export function Drawer({ title, onClose, children, width = 380 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 0.4)', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          insetBlock: 0,
          insetInlineEnd: 0,
          width,
          maxWidth: '100%',
          background: 'var(--surface)',
          borderInlineStart: '1px solid var(--hairline)',
          boxShadow: 'var(--shadow-floating)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', display: 'inline-flex' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );
}
