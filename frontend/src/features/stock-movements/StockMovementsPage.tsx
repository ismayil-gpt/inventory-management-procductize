import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, AlertTriangle, X } from 'lucide-react';
import {
  resolveLocationByBarcode, resolveProductByBarcode, ApiError,
  type MovementType, type ProductDetail, type LocationResolved,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { useOutbox, clearSyncedOutbox, type OutboxItem } from '../../offline-queue/outbox.store';
import { BarcodeInput } from '../barcode-scanning/BarcodeInput';
import { LocationChip } from '../../design-system/location-designator/LocationChip';

type Loc = Pick<LocationResolved, 'id' | 'designator' | 'typeNameEn' | 'typeNameAr'>;

const TYPE_CONFIG: Record<MovementType, { labelKey: string; slots: ('from' | 'to')[]; qtyLabelKey: string; reason: boolean; relevant: 'from' | 'to' }> = {
  GOODS_IN: { labelKey: 'movements.goodsIn', slots: ['to'], qtyLabelKey: 'movements.qtyReceived', reason: false, relevant: 'to' },
  GOODS_OUT: { labelKey: 'movements.goodsOut', slots: ['from'], qtyLabelKey: 'movements.qtyIssued', reason: false, relevant: 'from' },
  TRANSFER: { labelKey: 'movements.transfer', slots: ['from', 'to'], qtyLabelKey: 'movements.qtyTransfer', reason: false, relevant: 'from' },
  ADJUSTMENT: { labelKey: 'movements.adjustment', slots: ['to'], qtyLabelKey: 'movements.qtyCounted', reason: true, relevant: 'to' },
};

export function StockMovementsPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const outboxItems = useOutbox((s) => s.items);
  const enqueue = useOutbox((s) => s.enqueue);

  const [type, setType] = useState<MovementType>('GOODS_IN');
  const [fromLoc, setFromLoc] = useState<Loc | null>(null);
  const [toLoc, setToLoc] = useState<Loc | null>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [prodBusy, setProdBusy] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const cfg = TYPE_CONFIG[type];
  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);

  const resetAll = (nextType: MovementType) => {
    setType(nextType);
    setFromLoc(null); setToLoc(null); setProduct(null);
    setQuantity(''); setReason(''); setLocError(null); setProdError(null); setFormError(null);
  };

  const locationsReady = cfg.slots.every((s) => (s === 'from' ? fromLoc : toLoc));
  const relevantLoc = cfg.relevant === 'from' ? fromLoc : toLoc;
  const currentHere = useMemo(() => {
    if (!product || !relevantLoc) return 0;
    return product.positions.find((p) => p.locationNodeId === relevantLoc.id)?.quantity ?? 0;
  }, [product, relevantLoc]);

  const resolveLocation = (slot: 'from' | 'to') => async (code: string) => {
    setLocBusy(true); setLocError(null);
    try {
      const loc = await resolveLocationByBarcode(code);
      const value: Loc = { id: loc.id, designator: loc.designator, typeNameEn: loc.typeNameEn, typeNameAr: loc.typeNameAr };
      slot === 'from' ? setFromLoc(value) : setToLoc(value);
    } catch (err) {
      setLocError(err instanceof ApiError && err.status === 404 ? t('barcode.notFound') : t('errors.generic'));
    } finally { setLocBusy(false); }
  };

  const resolveProduct = async (code: string) => {
    setProdBusy(true); setProdError(null);
    try {
      setProduct(await resolveProductByBarcode(code));
      setQuantity(''); setReason(''); setFormError(null);
    } catch (err) {
      setProdError(err instanceof ApiError && err.status === 404 ? t('barcode.notFound') : t('errors.generic'));
    } finally { setProdBusy(false); }
  };

  const record = async () => {
    if (!product) return;
    setFormError(null);
    const entered = Number(quantity);
    if (!Number.isInteger(entered) || entered < 0) { setFormError(t('errors.generic')); return; }

    let movementQty = entered;
    if (type === 'ADJUSTMENT') {
      movementQty = entered - currentHere; // signed delta
      if (movementQty === 0) { setFormError(t('movements.noChange')); return; }
      if (reason.trim().length < 10) { setFormError(t('stock.adjustmentReasonRequired')); return; }
    } else {
      if (entered <= 0) { setFormError(t('errors.generic')); return; }
      if ((type === 'GOODS_OUT' || type === 'TRANSFER') && entered > currentHere) {
        setFormError(t('movements.insufficient', { count: currentHere })); return;
      }
    }

    const clientId = crypto.randomUUID();
    const item: OutboxItem = {
      clientId,
      payload: {
        clientId, type, productId: product.id,
        fromLocationNodeId: cfg.slots.includes('from') ? fromLoc?.id : null,
        toLocationNodeId: cfg.slots.includes('to') ? toLoc?.id : null,
        quantity: movementQty,
        reason: type === 'ADJUSTMENT' ? reason.trim() : null,
      },
      status: 'pending',
      createdAt: Date.now(),
      typeLabel: t(cfg.labelKey),
      productName: name(product.nameEn, product.nameAr),
      sku: product.sku,
      fromDesignator: fromLoc?.designator ?? null,
      toDesignator: toLoc?.designator ?? null,
      quantity: movementQty,
    };

    setRecording(true);
    try {
      await enqueue(item);
      // Refresh anything showing stock now that it changed.
      void queryClient.invalidateQueries();
      setProduct(null); setQuantity(''); setReason('');
    } finally { setRecording(false); }
  };

  const control: React.CSSProperties = { height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1.4fr) minmax(300px, 1fr)', gap: 'var(--space-4)', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Movement type */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
          {(Object.keys(TYPE_CONFIG) as MovementType[]).map((k) => (
            <button key={k} type="button" onClick={() => resetAll(k)} style={{
              flex: 1, padding: '8px', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer',
              border: 'none', borderRadius: 'var(--radius-sm)',
              background: type === k ? 'var(--surface)' : 'transparent',
              color: type === k ? 'var(--primary)' : 'var(--ink-muted)',
              boxShadow: type === k ? 'var(--shadow-floating)' : 'none',
            }}>
              {t(TYPE_CONFIG[k].labelKey)}
            </button>
          ))}
        </div>

        {/* Location slots */}
        {cfg.slots.map((slot) => {
          const value = slot === 'from' ? fromLoc : toLoc;
          const labelKey = type === 'ADJUSTMENT' ? 'movements.location' : slot === 'from' ? 'movements.fromLocation' : 'movements.toLocation';
          return value ? (
            <div key={slot} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t(labelKey)}</span>
                <LocationChip designator={value.designator} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{name(value.typeNameEn, value.typeNameAr)}</span>
              </div>
              <button type="button" onClick={() => (slot === 'from' ? setFromLoc(null) : setToLoc(null))} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>{t('movements.changeLocation')}</button>
            </div>
          ) : (
            <BarcodeInput key={slot} label={t(labelKey)} onSubmit={resolveLocation(slot)} busy={locBusy} error={locError} />
          );
        })}

        {/* Product + quantity */}
        {!locationsReady ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-8)' }}>{t('movements.setLocationsFirst')}</div>
        ) : !product ? (
          <BarcodeInput label={t('movements.scanProduct')} onSubmit={resolveProduct} busy={prodBusy} error={prodError} />
        ) : (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)' }}>{name(product.nameEn, product.nameAr)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }} dir="ltr">{product.sku} · {product.barcode}</div>
              </div>
              <button type="button" onClick={() => { setProduct(null); setFormError(null); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>{t('movements.changeProduct')}</button>
            </div>

            <div style={{ display: 'flex', gap: '20px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
              <span>{t('movements.currentHere')}: <span className="tabular" style={{ color: 'var(--ink)', fontWeight: 500 }}>{currentHere} {product.baseUnitCode}</span></span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
                {t(cfg.qtyLabelKey)}
                <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus className="tabular" style={{ ...control, width: '140px' }} />
              </label>
              {type === 'ADJUSTMENT' && quantity !== '' && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', paddingBottom: '10px' }}>
                  {t('movements.delta')}: <span className="tabular" style={{ color: 'var(--ink)' }}>{Number(quantity) - currentHere >= 0 ? '+' : ''}{Number(quantity) - currentHere}</span>
                </span>
              )}
            </div>

            {cfg.reason && (
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('movements.reasonLabel')} rows={2}
                style={{ ...control, height: 'auto', padding: '8px 12px', resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
            )}

            {formError && <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--critical)' }}>{formError}</div>}

            <button type="button" onClick={record} disabled={recording || quantity === ''} style={{
              height: '40px', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: 500, fontSize: 'var(--text-sm)',
              background: recording || quantity === '' ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)',
              cursor: recording || quantity === '' ? 'default' : 'pointer',
            }}>
              {recording ? t('movements.recording') : t('movements.record')}
            </button>
          </div>
        )}
      </div>

      {/* Session activity (from the offline outbox) */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t('movements.activity')}</span>
          {outboxItems.some((i) => i.status === 'synced') && (
            <button type="button" onClick={() => void clearSyncedOutbox()} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>{t('movements.clearSynced')}</button>
          )}
        </div>
        {outboxItems.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('movements.noActivity')}</div>
        ) : (
          <div style={{ maxHeight: '65vh', overflow: 'auto' }}>
            {outboxItems.map((item) => <ActivityRow key={item.clientId} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: OutboxItem }) {
  const { t } = useTranslation();
  const statusMap = {
    pending: { icon: <Clock size={14} />, color: 'var(--warn)', label: t('movements.queued') },
    synced: { icon: <Check size={14} />, color: 'var(--ok)', label: t('movements.synced') },
    error: { icon: <AlertTriangle size={14} />, color: 'var(--critical)', label: t('movements.failed') },
  } as const;
  const s = statusMap[item.status];
  const arrow = item.fromDesignator && item.toDesignator ? `${item.fromDesignator} → ${item.toDesignator}` : (item.toDesignator ?? item.fromDesignator ?? '');
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '10px 16px', borderTop: '1px solid var(--hairline)' }}>
      <span style={{ color: s.color, marginTop: '2px' }}>{s.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', fontWeight: 500 }}>{item.typeLabel}</span>
          <span className="tabular" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{item.quantity > 0 ? '+' : ''}{item.quantity}</span>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.productName}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
          <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)' }}>{arrow}</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: s.color }}>{s.label}</span>
        </div>
        {item.errorMessage && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--critical)', marginTop: '2px' }}>{item.errorMessage}</div>}
      </div>
    </div>
  );
}
