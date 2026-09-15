import { useTranslation } from 'react-i18next';
import type { StockStatus } from '../../api-client/client';

// §9.8 — a 6px square plus a text label. Never colour alone.
const STATUS_MAP: Record<StockStatus, { color: string; labelKey: string; filled: boolean }> = {
  IN_STOCK: { color: 'var(--ok)', labelKey: 'stock.inStock', filled: true },
  LOW: { color: 'var(--warn)', labelKey: 'stock.low', filled: true },
  CRITICAL: { color: 'var(--critical)', labelKey: 'stock.critical', filled: true },
  OUT: { color: 'var(--ink-faint)', labelKey: 'stock.outOfStock', filled: false },
};

export function StockStatusIndicator({ status }: { status: StockStatus }) {
  const { t } = useTranslation();
  const cfg = STATUS_MAP[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
      <span
        aria-hidden
        style={{
          width: '6px', height: '6px', borderRadius: '1px',
          background: cfg.filled ? cfg.color : 'transparent',
          border: cfg.filled ? 'none' : `1px solid ${cfg.color}`,
        }}
      />
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>{t(cfg.labelKey)}</span>
    </span>
  );
}
