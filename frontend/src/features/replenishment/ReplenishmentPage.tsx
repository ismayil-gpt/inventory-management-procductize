import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, FileOutput, Check, X } from 'lucide-react';
import {
  useRecommendations, runReview, approveRecommendation, rejectRecommendation, generatePurchaseOrders,
  ApiError, type Recommendation,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from '../authentication/auth.store';

const STATUS_TONE: Record<string, string> = {
  PENDING: 'var(--warn)', APPROVED: 'var(--ok)', AMENDED: 'var(--ok)', REJECTED: 'var(--ink-faint)', ORDERED: 'var(--info)', RECEIVED: 'var(--ink-muted)',
};

export function ReplenishmentPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const recs = useRecommendations();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['recommendations'] });

  const doRun = async () => {
    setBusy(true); setNotice(null);
    try { const r = await runReview(); setNotice(t('replenishment.reviewDone', { count: r.generated })); refresh(); }
    finally { setBusy(false); }
  };
  const doGenerate = async () => {
    setBusy(true); setNotice(null);
    try {
      const r = await generatePurchaseOrders();
      setNotice(t('replenishment.posCreated', { count: r.created.length, skipped: r.skippedNoSupplier }));
      refresh();
    } finally { setBusy(false); }
  };

  const toolbarBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' };
  const pending = recs.data?.filter((r) => r.status === 'PENDING') ?? [];
  const approvedCount = recs.data?.filter((r) => r.status === 'APPROVED' || r.status === 'AMENDED').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => void doRun()} disabled={busy} style={{ ...toolbarBtn, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500 }}>
            <RefreshCw size={16} strokeWidth={1.5} /> {t('replenishment.runNow')}
          </button>
          <button type="button" onClick={() => void doGenerate()} disabled={busy || approvedCount === 0} style={{ ...toolbarBtn, opacity: approvedCount === 0 ? 0.5 : 1 }}>
            <FileOutput size={16} strokeWidth={1.5} /> {t('replenishment.generatePos')}{approvedCount ? ` (${approvedCount})` : ''}
          </button>
        </div>
      )}
      {notice && <div style={{ padding: '10px 14px', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>{notice}</div>}

      {recs.isLoading && <div style={{ color: 'var(--ink-muted)' }}>{t('common.loading')}</div>}
      {recs.data && recs.data.length === 0 && (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}>
          {t('replenishment.empty')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {(recs.data ?? []).map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} isAdmin={isAdmin} language={language} onDecided={refresh} statusTone={STATUS_TONE} />
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ rec, isAdmin, language, onDecided, statusTone }: { rec: Recommendation; isAdmin: boolean; language: string; onDecided: () => void; statusTone: Record<string, string> }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(String(rec.suggestedQty));
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);
  const reasoning = language === 'ar' ? rec.reasoningAr : rec.reasoningEn;

  const approve = async () => {
    setBusy(true); setError(null);
    try { await approveRecommendation(rec.id, Number(qty) === rec.suggestedQty ? undefined : Number(qty)); onDecided(); }
    catch (e) { setError(e instanceof ApiError ? e.body.messageEn ?? t('errors.generic') : t('errors.generic')); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    setBusy(true); setError(null);
    try { await rejectRecommendation(rec.id, reason); onDecided(); }
    catch (e) { setError(e instanceof ApiError ? e.body.messageEn ?? t('errors.generic') : t('errors.generic')); }
    finally { setBusy(false); }
  };

  const smallInput: React.CSSProperties = { height: '32px', width: '80px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 10px', fontSize: 'var(--text-sm)' };
  const actionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer', border: 'none' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4) var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)' }}>{name(rec.nameEn, rec.nameAr)}</span>
            <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{rec.sku}</span>
            <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: statusTone[rec.status] ?? 'var(--ink-muted)' }}>· {t(`replenishment.status.${rec.status}`)}</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', lineHeight: 1.5 }}>{reasoning}</p>
          <div style={{ marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>
            {t('products.supplier')}: {rec.supplierName ?? '—'}
            {rec.approvedQty != null && <> · {t('replenishment.approvedQty')}: <span className="tabular">{rec.approvedQty}</span></>}
          </div>
        </div>

        {isAdmin && rec.status === 'PENDING' && !rejecting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="tabular" style={smallInput} aria-label={t('replenishment.orderQty')} />
            <button type="button" onClick={() => void approve()} disabled={busy} style={{ ...actionBtn, background: 'var(--primary)', color: 'var(--on-primary)' }}><Check size={15} /> {t('replenishment.approve')}</button>
            <button type="button" onClick={() => setRejecting(true)} disabled={busy} style={{ ...actionBtn, background: 'var(--surface)', border: '1px solid var(--hairline)', color: 'var(--critical)' }}><X size={15} /> {t('replenishment.reject')}</button>
          </div>
        )}
      </div>

      {rejecting && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('replenishment.rejectReason')} style={{ flex: 1, minWidth: '220px', height: '34px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' }} />
          <button type="button" onClick={() => void reject()} disabled={busy || reason.trim().length < 3} style={{ ...actionBtn, background: 'var(--critical)', color: '#fff' }}>{t('replenishment.confirmReject')}</button>
          <button type="button" onClick={() => setRejecting(false)} style={{ ...actionBtn, background: 'var(--surface)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}>{t('common.cancel')}</button>
        </div>
      )}
      {error && <div role="alert" style={{ marginTop: '6px', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}
    </div>
  );
}
