import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardCheck, CloudOff, ShieldCheck } from 'lucide-react';
import {
  useRecommendations, usePredictiveAnalyticsSummary, useCycleCounts, approveRecommendation,
  ApiError, type Recommendation, type AtRiskProduct,
} from '../../api-client/client';
import { useAuthStore } from '../authentication/auth.store';
import { usePreferences } from '../../application-shell/preferences.store';
import { useOutbox } from '../../offline-queue/outbox.store';
import { CountUpNumber } from '../../design-system/airfield-signs/CountUpNumber';
import { StockStatusIndicator } from '../../design-system/stock-status-indicator/StockStatusIndicator';

// The AI Store Manager's morning briefing (§8). One screen that answers "what
// needs me today?" — every item carries its reasoning (§8.3, template text
// from real numbers, never the language model) and can be acted on in place.
// Nothing is ordered without a human: approving here is the same governed
// action as on the Replenishment page (§12 rule 5, ADMIN only).
const RUNNING_OUT_WITHIN_DAYS = 7;
const MAX_APPROVALS_SHOWN = 5;

// Weekday in the reader's language, date always DD/MM/YYYY with Western digits (§10).
const longDate = (language: string, date: Date) => {
  const weekday = new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-GB', { weekday: 'long', timeZone: 'Asia/Dubai' }).format(date);
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Dubai' }).format(date);
  return `${weekday} ${day}`;
};
const timeOfDay = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' });

const section: React.CSSProperties = { background: 'var(--surface)', border: 'none', boxShadow: 'var(--clay-raised)', borderRadius: 'var(--radius-panel)', overflow: 'hidden' };
const sectionHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--hairline)' };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--hairline)', flexWrap: 'wrap' };

function SectionTitle({ title, count, hint }: { title: string; count: number; hint?: string }) {
  return (
    <div style={sectionHead}>
      <span className="sign-go tabular" style={{ minWidth: '28px', textAlign: 'center', padding: '3px 8px', fontSize: 'var(--text-sm)' }}>{count}</span>
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{title}</h2>
        {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{hint}</div>}
      </div>
    </div>
  );
}

function ApprovalRow({ rec, isAdmin }: { rec: Recommendation; isAdmin: boolean }) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(String(rec.suggestedQty));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasoning = language === 'ar' ? rec.reasoningAr || rec.reasoningEn : rec.reasoningEn || rec.reasoningAr;
  const productName = language === 'ar' ? rec.nameAr || rec.nameEn : rec.nameEn || rec.nameAr;

  const approve = async () => {
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount <= 0) { setError(t('briefing.qtyInvalid')); return; }
    setBusy(true); setError(null);
    try {
      await approveRecommendation(rec.id, amount === rec.suggestedQty ? undefined : amount);
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    } catch (err) {
      setError(err instanceof ApiError ? (language === 'ar' ? err.body.messageAr : err.body.messageEn) ?? t('errors.generic') : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={row}>
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{productName}</span>
          <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{rec.sku}</span>
          {rec.supplierName && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{rec.supplierName}</span>}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-base)', lineHeight: 1.55, maxWidth: '72ch' }}>{reasoning}</p>
        {error && <div role="alert" style={{ marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--critical)' }}>{error}</div>}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="tabular"
            aria-label={t('replenishment.orderQty')}
            style={{ width: '88px', height: '40px', borderRadius: 'var(--radius-sm)', border: 'none', boxShadow: 'var(--clay-pressed)', background: 'var(--surface-sunken)', color: 'var(--ink)', padding: '0 10px', fontSize: 'var(--text-sm)' }}
          />
          <button
            type="button" onClick={() => void approve()} disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-tinted)', background: 'var(--sign-go)', color: 'var(--sign-on-go)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: busy ? 'default' : 'pointer' }}
          >
            <Check size={16} strokeWidth={2} aria-hidden /> {busy ? t('common.loading') : t('replenishment.approve')}
          </button>
        </div>
      )}
    </div>
  );
}

function RunningOutRow({ item }: { item: AtRiskProduct }) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const days = Math.max(0, Math.floor(item.daysUntilStockout));
  const productName = language === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
  return (
    <div style={row}>
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <Link to={`/products/${item.productId}`} style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)' }}>{productName}</Link>
        <span dir="ltr" style={{ marginInlineStart: '10px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{item.sku}</span>
        <div style={{ marginTop: '4px', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>
          {t('briefing.runningOutReason', { stock: item.currentStock, usage: Math.round(item.dailyUsage * 10) / 10, days })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{ width: '120px', height: '8px', borderRadius: '4px', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)', overflow: 'hidden', direction: language === 'ar' ? 'rtl' : 'ltr' }}>
          <div className="bar-grow" style={{ width: `${Math.min(100, (days / RUNNING_OUT_WITHIN_DAYS) * 100)}%`, height: '100%', background: days <= 2 ? 'var(--critical)' : 'var(--warn)' }} />
        </div>
        <span className="tabular" style={{ minWidth: '64px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{t('briefing.daysLeft', { count: days })}</span>
        <StockStatusIndicator status={item.status} />
      </div>
    </div>
  );
}

export function MorningBriefingPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const pending = useRecommendations('PENDING');
  const summary = usePredictiveAnalyticsSummary();
  const counts = useCycleCounts();
  const queued = useOutbox((s) => s.pendingCount);

  const pendingRecs = pending.data ?? [];
  const pendingProductIds = new Set(pendingRecs.map((r) => r.productId));
  // Products about to run out that the review has not already put up for approval.
  const runningOut = (summary.data?.daysUntilStockout ?? [])
    .filter((p) => p.daysUntilStockout <= RUNNING_OUT_WITHIN_DAYS && !pendingProductIds.has(p.productId))
    .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  const openCounts = (counts.data ?? []).filter((c) => c.status === 'OPEN');

  const approvalsThatNeedYou = isAdmin ? pendingRecs.length : 0;
  const thingsToday = approvalsThatNeedYou + runningOut.length + openCounts.length + (queued > 0 ? 1 : 0);
  const reviewedAt = pendingRecs.length
    ? pendingRecs.reduce((latest, r) => (r.generatedAt > latest ? r.generatedAt : latest), pendingRecs[0].generatedAt)
    : null;
  const isLoading = pending.isLoading || summary.isLoading || counts.isLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* The briefing's headline is the count itself, on the gantry. */}
      <section style={{ background: 'var(--gantry)', border: 'none', boxShadow: 'var(--clay-gantry)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div className="sign-location sign-enter tabular" style={{ fontSize: '56px', lineHeight: 1, padding: '14px 22px 8px', minWidth: '2ch', textAlign: 'center' }}>
          {isLoading ? '—' : <CountUpNumber value={thingsToday} />}
        </div>
        <div style={{ flex: '1 1 320px', color: 'var(--gantry-ink)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, lineHeight: 1.3 }}>
            {isLoading ? t('common.loading') : thingsToday === 0 ? t('briefing.allClearTitle') : t('briefing.headline', { count: thingsToday })}
          </h2>
          <div style={{ marginTop: '4px', fontSize: 'var(--text-sm)', color: 'var(--gantry-muted)' }}>
            {longDate(language, new Date())}
            {reviewedAt && <>{' · '}{t('briefing.reviewedAt', { time: timeOfDay.format(new Date(reviewedAt)) })}</>}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--gantry-muted)', maxWidth: '280px' }}>
          <ShieldCheck size={16} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
          {t('briefing.humanDecides')}
        </div>
      </section>

      {!isLoading && thingsToday === 0 && (
        <div style={{ ...section, padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-base)' }}>
          {t('briefing.allClearBody')}
        </div>
      )}

      {isAdmin && pendingRecs.length > 0 && (
        <section style={section}>
          <SectionTitle title={t('briefing.approveTitle')} count={pendingRecs.length} hint={t('briefing.approveHint')} />
          {pendingRecs.slice(0, MAX_APPROVALS_SHOWN).map((rec) => <ApprovalRow key={rec.id} rec={rec} isAdmin={isAdmin} />)}
          {pendingRecs.length > MAX_APPROVALS_SHOWN && (
            <div style={{ ...row, justifyContent: 'flex-end' }}>
              <Link to="/replenishment" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--primary-ink)' }}>
                {t('briefing.seeAllApprovals', { count: pendingRecs.length })}
              </Link>
            </div>
          )}
        </section>
      )}

      {runningOut.length > 0 && (
        <section style={section}>
          <SectionTitle title={t('briefing.runningOutTitle')} count={runningOut.length} hint={t('briefing.runningOutHint')} />
          {runningOut.map((item) => <RunningOutRow key={item.productId} item={item} />)}
        </section>
      )}

      {openCounts.length > 0 && (
        <section style={section}>
          <SectionTitle title={t('briefing.countsTitle')} count={openCounts.length} />
          {openCounts.map((c) => (
            <div key={c.id} style={row}>
              <ClipboardCheck size={18} strokeWidth={1.5} aria-hidden style={{ color: 'var(--ink-muted)' }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)' }}>
                {c.note || t('briefing.countUntitled')} · <span className="tabular">{t('briefing.countLines', { count: c.lineCount })}</span>
              </div>
              <Link to="/cycle-counting" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--primary-ink)' }}>{t('briefing.continueCount')}</Link>
            </div>
          ))}
        </section>
      )}

      {queued > 0 && (
        <section style={section}>
          <div style={{ ...row, borderTop: 'none' }}>
            <CloudOff size={18} strokeWidth={1.5} aria-hidden style={{ color: 'var(--warn)' }} />
            <div style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{t('briefing.queuedScans', { count: queued })}</div>
            <Link to="/stock" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--primary-ink)' }}>{t('briefing.reviewQueue')}</Link>
          </div>
        </section>
      )}
    </div>
  );
}
