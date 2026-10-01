import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useStockMovements, useProducts, useUsers, type MovementType,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from '../authentication/auth.store';
import { LocationChip } from '../../design-system/location-designator/LocationChip';

const MOVEMENT_TYPE_KEY: Record<MovementType, string> = {
  GOODS_IN: 'movements.goodsIn', GOODS_OUT: 'movements.goodsOut',
  TRANSFER: 'movements.transfer', ADJUSTMENT: 'movements.adjustment',
};

const PAGE_SIZE = 100;

/** `StockMovement.quantity` is a positive magnitude for GOODS_IN/GOODS_OUT/
 * TRANSFER (validated > 0 in movement.schema.ts) and only a signed delta for
 * ADJUSTMENT — so the sign shown here must follow the type, not just the
 * stored number's own sign (a GOODS_OUT row is a real decrease, even though
 * its `quantity` column is positive). */
function signedQty(type: MovementType, quantity: number): string {
  if (type === 'GOODS_OUT') return `-${quantity}`;
  if (type === 'TRANSFER') return `${quantity}`;
  return quantity > 0 ? `+${quantity}` : `${quantity}`; // GOODS_IN (always +) and ADJUSTMENT (already signed)
}

const control: React.CSSProperties = { height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };

/** Real, filterable movement history — distinct from the scan-to-record
 * workflow's "this session" outbox list, which only ever shows what this
 * browser has scanned. This reads GET /stock-movements directly. */
export function MovementHistoryPanel() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);

  const [type, setType] = useState<MovementType | ''>('');
  const [productId, setProductId] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const products = useProducts({});
  const users = useUsers(isAdmin); // GET /users is ADMIN-only (users.controller.ts) — never fire it as STORE_KEEPER
  const movements = useStockMovements({
    type: type || undefined, productId: productId || undefined, userId: userId || undefined,
    from: from || undefined, to: to || undefined, limit,
  });

  const resetPage = () => setLimit(PAGE_SIZE);

  const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '8px 12px', background: 'var(--surface-sunken)', position: 'sticky', top: 0 };
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 'var(--text-xs)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)', verticalAlign: 'middle' };
  const rows = movements.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <select aria-label={t('dashboard.activityType')} value={type} onChange={(e) => { setType(e.target.value as MovementType | ''); resetPage(); }} style={{ ...control, minWidth: '150px' }}>
          <option value="">{t('movements.filterAllTypes')}</option>
          {(Object.keys(MOVEMENT_TYPE_KEY) as MovementType[]).map((k) => <option key={k} value={k}>{t(MOVEMENT_TYPE_KEY[k])}</option>)}
        </select>
        <select aria-label={t('dashboard.activityProduct')} value={productId} onChange={(e) => { setProductId(e.target.value); resetPage(); }} style={{ ...control, minWidth: '200px' }}>
          <option value="">{t('movements.filterAllProducts')}</option>
          {products.data?.items.map((p) => <option key={p.id} value={p.id}>{p.sku} · {name(p.nameEn, p.nameAr)}</option>)}
        </select>
        {isAdmin && (
          <select aria-label={t('dashboard.activityBy')} value={userId} onChange={(e) => { setUserId(e.target.value); resetPage(); }} style={{ ...control, minWidth: '160px' }}>
            <option value="">{t('movements.filterAllUsers')}</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        )}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          {t('movements.filterFrom')}
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} style={{ ...control, minWidth: '150px' }} dir="ltr" />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          {t('movements.filterTo')}
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} style={{ ...control, minWidth: '150px' }} dir="ltr" />
        </label>
        <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }} className="tabular">
          {movements.isSuccess ? t('movements.resultCount', { count: rows.length }) : ''}
        </span>
      </div>

      {/* Table */}
      {/* A scrolling region must be reachable by keyboard (WCAG 2.1.1). */}
      <div role="region" aria-label={t('navigation.movements')} tabIndex={0} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: '65vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('dashboard.activityTime')}</th>
              <th style={th}>{t('dashboard.activityType')}</th>
              <th style={th}>{t('dashboard.activityProduct')}</th>
              <th style={{ ...th, textAlign: 'end' }}>{t('dashboard.activityQty')}</th>
              <th style={th}>{t('dashboard.activityLocation')}</th>
              <th style={th}>{t('movements.colReason')}</th>
              <th style={th}>{t('dashboard.activityBy')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }} dir="ltr">{m.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td style={td}>{t(MOVEMENT_TYPE_KEY[m.type])}</td>
                <td style={{ ...td, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name(m.nameEn, m.nameAr)}
                  <span style={{ color: 'var(--ink-faint)', marginInlineStart: '6px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }} dir="ltr">{m.sku}</span>
                </td>
                <td className="tabular" style={{ ...td, textAlign: 'end', fontWeight: 500 }} dir="ltr">{signedQty(m.type, m.quantity)}</td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {m.fromDesignator && <LocationChip designator={m.fromDesignator} />}
                    {m.fromDesignator && m.toDesignator && <span style={{ color: 'var(--ink-faint)' }}>→</span>}
                    {m.toDesignator && <LocationChip designator={m.toDesignator} />}
                    {!m.fromDesignator && !m.toDesignator && '—'}
                  </span>
                </td>
                <td style={{ ...td, color: 'var(--ink-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.reason ?? '—'}</td>
                <td style={{ ...td, color: 'var(--ink-muted)' }}>{m.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {movements.isLoading && <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('common.loading')}</div>}
        {movements.isSuccess && rows.length === 0 && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('movements.historyEmpty')}</div>
        )}
      </div>

      {movements.isSuccess && rows.length === limit && (
        <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} style={{ alignSelf: 'center', height: '36px', padding: '0 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          {t('movements.loadMore')}
        </button>
      )}
    </div>
  );
}
