import { ReactNode } from 'react';
import { X } from 'lucide-react';

// A tight, hairline-bordered modal (§9.5 — shadow only on floating layers).
export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 0.4)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 'var(--space-4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-floating)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--hairline)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', display: 'inline-flex' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ padding: 'var(--space-6)' }}>{children}</div>
      </div>
    </div>
  );
}
