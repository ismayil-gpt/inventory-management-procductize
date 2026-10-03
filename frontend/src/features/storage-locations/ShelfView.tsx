import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { printLabels } from '../barcode-scanning/print-labels';
import { useTranslation } from 'react-i18next';
import {
  authFetch, useProducts, fetchLocationLabels, type LocationResolved, type LocationTreeNode, type StockStatus,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';

// A drawing of one rack as it stands in the room: its stock-holding children
// stacked top to bottom (the last-sorted level on top, as racks are numbered
// from the floor up), each holding its products as chips coloured by stock
// state. Works for any hierarchy — it draws whatever children the selected
// parent has (§5A.1); it never assumes "rack" or "level".
const STATUS_TONE: Record<StockStatus, { fill: string; ink: string; edge: string }> = {
  IN_STOCK: { fill: 'var(--ok-soft)', ink: 'var(--ok)', edge: 'var(--ok)' },
  LOW: { fill: 'var(--warn-soft)', ink: 'var(--warn)', edge: 'var(--warn)' },
  CRITICAL: { fill: 'var(--critical-soft)', ink: 'var(--critical)', edge: 'var(--critical)' },
  OUT: { fill: 'transparent', ink: 'var(--ink-muted)', edge: 'var(--hairline-strong)' },
};

interface ShelfViewProps {
  parent: LocationTreeNode;
  highlightedId?: string;
  onSelect: (id: string) => void;
}

export function ShelfView({ parent, highlightedId, onSelect }: ShelfViewProps) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const name = (en: string, ar: string) => (language === 'ar' ? ar || en : en || ar);
  const [printing, setPrinting] = useState(false);
  const printRack = async () => {
    setPrinting(true);
    try {
      printLabels(await fetchLocationLabels(parent.id, true), parent.designator);
    } finally {
      setPrinting(false);
    }
  };

  // Floor at the bottom: reverse the configured order so the first child sits lowest.
  const shelves = [...parent.children].reverse();
  // Same query key as useLocation(), so selecting a shelf reuses what is already loaded.
  const details = useQueries({
    queries: shelves.map((shelf) => ({
      queryKey: ['location', shelf.id],
      queryFn: () => authFetch<LocationResolved>(`/storage-locations/${shelf.id}`),
      retry: false,
    })),
  });
  const products = useProducts({});
  const statusById = new Map((products.data?.items ?? []).map((p) => [p.id, p.status]));

  return (
    <section aria-label={`${t('shelfView.title')} ${parent.designator}`} style={{ background: 'var(--surface)', border: 'none', boxShadow: 'var(--clay-raised)', borderRadius: 'var(--radius-panel)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', padding: '10px 16px', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          {t('shelfView.title')} <bdi dir="ltr" style={{ fontFamily: 'var(--font-mono)' }}>{parent.designator}</bdi>
        </span>
        <button type="button" onClick={() => void printRack()} disabled={printing} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 10px', borderRadius: 'var(--radius-sm)', border: 'none', boxShadow: 'var(--clay-raised-sm)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
          <Printer size={13} strokeWidth={1.5} aria-hidden /> {printing ? t('common.loading') : t('locations.printRackLabels')}
        </button>
        <span style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          {(['IN_STOCK', 'LOW', 'CRITICAL', 'OUT'] as StockStatus[]).map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: 'var(--radius-dot)', background: STATUS_TONE[s].fill, border: `1px solid ${STATUS_TONE[s].edge}` }} />
              {t(`shelfView.legend.${s}`)}
            </span>
          ))}
        </span>
      </div>

      {/* The rack frame: uprights either side, a shelf board under each level. */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderInline: '8px solid var(--hairline-strong)', margin: 'var(--space-3) var(--space-4) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)' }}>
        {shelves.map((shelf, index) => {
          const detail = details[index]?.data;
          const isHighlighted = shelf.id === highlightedId;
          return (
            <button
              key={shelf.id}
              type="button"
              onClick={() => onSelect(shelf.id)}
              aria-current={isHighlighted ? 'location' : undefined}
              style={{
                display: 'flex', alignItems: 'stretch', gap: 'var(--space-3)', width: '100%',
                padding: 'var(--space-2) var(--space-2) var(--space-3)', marginBlock: '4px', background: 'transparent', border: 'none',
                // Each level stands on its own rounded shelf board.
                borderBottom: '5px solid var(--hairline-strong)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'start',
              }}
            >
              <span
                dir="ltr"
                className={isHighlighted ? 'sign-location' : undefined}
                style={{
                  flex: 'none', minWidth: '52px', display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--font-sign)', fontWeight: 600, fontSize: 'var(--text-base)',
                  borderRadius: 'var(--radius-sign)', padding: '4px 8px',
                  ...(isHighlighted ? {} : { color: 'var(--ink-muted)', background: 'var(--surface)', boxShadow: 'var(--clay-raised-sm)' }),
                }}
              >
                {shelf.code}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', minHeight: '40px', padding: '2px', borderRadius: 'var(--radius-sm)', background: isHighlighted ? 'var(--primary-soft)' : undefined }}>
                {!detail && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{t('common.loading')}</span>}
                {detail && detail.stock.length === 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{t('shelfView.empty')}</span>}
                {detail?.stock.map((row) => {
                  const tone = STATUS_TONE[statusById.get(row.productId) ?? 'IN_STOCK'];
                  return (
                    <span
                      key={row.productId}
                      title={`${row.sku} · ${name(row.nameEn, row.nameAr)} · ${row.quantity}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '220px',
                        padding: '4px 8px', borderRadius: 'var(--radius-chip)', fontSize: 'var(--text-xs)',
                        background: tone.fill, color: 'var(--ink)', border: `1px solid ${tone.edge}`, boxShadow: 'var(--clay-raised-sm)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name(row.nameEn, row.nameAr)}</span>
                      <span className="tabular" style={{ fontWeight: 600, color: tone.ink }}>{row.quantity}</span>
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
