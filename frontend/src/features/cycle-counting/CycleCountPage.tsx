import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft } from 'lucide-react';
import {
  useCycleCounts, createCycleCount, cycleCountGet, cycleCountScan, cycleCountClose,
  resolveLocationByBarcode, resolveProductByBarcode, ApiError,
  type CycleCountReport, type LocationResolved, type ProductDetail,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { BarcodeInput } from '../barcode-scanning/BarcodeInput';
import { LocationChip } from '../../design-system/location-designator/LocationChip';

export function CycleCountPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sessions = useCycleCounts();
  const [report, setReport] = useState<CycleCountReport | null>(null);

  const open = async (id: string) => setReport(await cycleCountGet(id));
  const start = async () => {
    const { id } = await createCycleCount();
    queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    setReport({ id, status: 'OPEN', note: null, lines: [] });
  };

  if (report) return <CycleCountSession report={report} setReport={setReport} onExit={() => { setReport(null); queryClient.invalidateQueries({ queryKey: ['cycle-counts'] }); }} />;

  const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '10px 12px', background: 'var(--surface-sunken)' };
  const td: React.CSSProperties = { padding: '0 12px', height: '44px', fontSize: 'var(--text-sm)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <button type="button" onClick={() => void start()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={1.5} /> {t('cycleCount.start')}
        </button>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>{t('cycleCount.session')}</th><th style={th}>{t('cycleCount.note')}</th><th style={{ ...th, textAlign: 'end' }}>{t('cycleCount.lines')}</th><th style={th}>{t('purchaseOrders.status')}</th><th style={th}></th></tr></thead>
          <tbody>
            {sessions.data?.map((s) => (
              <tr key={s.id}>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }} dir="ltr">{s.id.slice(0, 8)}</td>
                <td style={td}>{s.note ?? '—'}</td>
                <td style={{ ...td, textAlign: 'end' }} className="tabular">{s.lineCount}</td>
                <td style={td}><span style={{ fontSize: 'var(--text-xs)', color: s.status === 'OPEN' ? 'var(--warn)' : 'var(--ink-muted)' }}>{t(`cycleCount.status.${s.status}`)}</span></td>
                <td style={{ ...td, textAlign: 'end' }}>
                  <button type="button" onClick={() => void open(s.id)} style={{ height: '30px', padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>{s.status === 'OPEN' ? t('cycleCount.continue') : t('cycleCount.view')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.data && sessions.data.length === 0 && <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('cycleCount.empty')}</div>}
      </div>
    </div>
  );
}

function CycleCountSession({ report, setReport, onExit }: { report: CycleCountReport; setReport: (r: CycleCountReport) => void; onExit: () => void }) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);
  const isOpen = report.status === 'OPEN';

  const [loc, setLoc] = useState<Pick<LocationResolved, 'id' | 'designator'> | null>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [counted, setCounted] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolveLoc = async (code: string) => { setErr(null); try { const l = await resolveLocationByBarcode(code); setLoc({ id: l.id, designator: l.designator }); } catch (e) { setErr(e instanceof ApiError && e.status === 404 ? t('barcode.notFound') : t('errors.generic')); } };
  const resolveProd = async (code: string) => { setErr(null); try { setProduct(await resolveProductByBarcode(code)); setCounted(''); } catch (e) { setErr(e instanceof ApiError && e.status === 404 ? t('barcode.notFound') : t('errors.generic')); } };

  const record = async () => {
    if (!loc || !product || counted === '') return;
    setBusy(true); setErr(null);
    try { setReport(await cycleCountScan(report.id, product.id, loc.id, Number(counted))); setProduct(null); setCounted(''); }
    catch (e) { setErr(e instanceof ApiError ? e.body.messageEn ?? t('errors.generic') : t('errors.generic')); }
    finally { setBusy(false); }
  };
  const close = async (apply: boolean) => {
    setBusy(true); setErr(null);
    try { setReport(await cycleCountClose(report.id, apply)); }
    catch (e) { setErr(e instanceof ApiError ? e.body.messageEn ?? t('errors.generic') : t('errors.generic')); }
    finally { setBusy(false); }
  };

  const control: React.CSSProperties = { height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer' };
  const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '8px 12px', background: 'var(--surface-sunken)' };
  const td: React.CSSProperties = { padding: '0 12px', height: '40px', fontSize: 'var(--text-sm)', borderTop: '1px solid var(--hairline)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={onExit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={16} strokeWidth={1.5} style={{ transform: language === 'ar' ? 'scaleX(-1)' : 'none' }} /> {t('cycleCount.back')}
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: isOpen ? 'var(--warn)' : 'var(--ok)' }}>{t(`cycleCount.status.${report.status}`)}{report.applied != null ? ` · ${t('cycleCount.applied', { count: report.applied })}` : ''}</span>
      </div>

      {isOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          {!loc ? <BarcodeInput label={t('cycleCount.scanLocation')} onSubmit={resolveLoc} /> : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <LocationChip designator={loc.designator} />
              <button type="button" onClick={() => setLoc(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>{t('movements.changeLocation')}</button>
            </div>
          )}
          {loc && (product ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{name(product.nameEn, product.nameAr)}</div><div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>{product.sku}</div></div>
              <input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={t('cycleCount.counted')} className="tabular" style={{ ...control, width: '90px' }} autoFocus />
              <button type="button" onClick={() => void record()} disabled={busy || counted === ''} style={{ ...btn, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)' }}>{t('cycleCount.record')}</button>
            </div>
          ) : <BarcodeInput label={t('cycleCount.scanProduct')} onSubmit={resolveProd} />)}
        </div>
      )}
      {err && <div role="alert" style={{ color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{err}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>{t('products.sku')}</th><th style={th}>{t('cycleCount.location')}</th><th style={{ ...th, textAlign: 'end' }}>{t('cycleCount.system')}</th><th style={{ ...th, textAlign: 'end' }}>{t('cycleCount.counted')}</th><th style={{ ...th, textAlign: 'end' }}>{t('cycleCount.variance')}</th></tr></thead>
          <tbody>
            {report.lines.map((l) => (
              <tr key={`${l.productId}:${l.locationNodeId}`}>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }} dir="ltr">{l.sku}</td>
                <td style={td}><LocationChip designator={l.designator} /></td>
                <td style={{ ...td, textAlign: 'end' }} className="tabular">{l.currentQty}</td>
                <td style={{ ...td, textAlign: 'end' }} className="tabular">{l.countedQty}</td>
                <td style={{ ...td, textAlign: 'end', fontWeight: 600, color: l.variance === 0 ? 'var(--ink-muted)' : l.variance > 0 ? 'var(--ok)' : 'var(--critical)' }} className="tabular">{l.variance > 0 ? '+' : ''}{l.variance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.lines.length === 0 && <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('cycleCount.noCounts')}</div>}
      </div>

      {isOpen && report.lines.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" onClick={() => void close(false)} disabled={busy} style={{ ...btn, border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' }}>{t('cycleCount.closeOnly')}</button>
          <button type="button" onClick={() => void close(true)} disabled={busy} style={{ ...btn, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500 }}>{t('cycleCount.closeApply')}</button>
        </div>
      )}
    </div>
  );
}
