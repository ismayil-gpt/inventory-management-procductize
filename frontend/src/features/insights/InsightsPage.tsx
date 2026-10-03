import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Wallet, TrendingUp, ShoppingCart } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  usePredictiveAnalyticsSummary, useProductForecast, useProducts, useOrganization,
  formatCurrency, type StockStatus,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { StockStatusIndicator } from '../../design-system/stock-status-indicator/StockStatusIndicator';

const card: React.CSSProperties = { background: 'var(--surface)', border: 'none', boxShadow: 'var(--clay-raised)', borderRadius: 'var(--radius-panel)', padding: 'var(--space-6)' };
const panelTitle: React.CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' };
const panelSub: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginTop: '2px' };
const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)', border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-xs)', color: 'var(--ink)', boxShadow: 'var(--shadow-floating)', padding: '8px 10px',
};
const emptyStyle: React.CSSProperties = { padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' };

const STATUS_TONE: Record<StockStatus, string> = { OUT: 'ink-faint', CRITICAL: 'critical', LOW: 'warn', IN_STOCK: 'ok' };

function KpiTile({ icon, tint, value, label, sub }: { icon: React.ReactNode; tint: string; value: string; label: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: 'var(--space-4) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <span style={{ display: 'inline-flex', width: '36px', height: '36px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: `var(--${tint}-soft)`, color: `var(--${tint})` }}>{icon}</span>
      <div>
        <div className="tabular" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', fontWeight: 500, marginTop: '4px' }}>{label}</div>
        {sub && <div style={panelSub}>{sub}</div>}
      </div>
    </div>
  );
}

/** A thin, rounded-end sparkline — hand-drawn SVG rather than a full chart, so
 * many can sit inline in a table row without axis/tooltip overhead. */
function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const width = 72;
  const height = 24;
  if (data.length < 2 || data.every((v) => v === 0)) {
    return <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)' }}>—</span>;
  }
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={`var(--${tone})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Thin proportional bar, rounded ends, anchored to the baseline — the same
 * mark language as the dashboard's stock-health bar, scaled per-row here. */
function DaysBar({ days, maxDays, tone }: { days: number; maxDays: number; tone: string }) {
  const pct = Math.max(4, Math.min(100, (days / maxDays) * 100));
  return (
    <div style={{ width: '72px', height: '6px', borderRadius: '3px', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)', overflow: 'hidden' }}>
      <div className="bar-grow" style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: `var(--${tone})` }} />
    </div>
  );
}

function StockoutTable({ rows, currency, language, t }: {
  rows: ReturnType<typeof usePredictiveAnalyticsSummary>['data'] extends infer S ? (S extends { daysUntilStockout: infer R } ? R : never) : never;
  currency: string; language: string; t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '8px 12px', background: 'var(--surface-sunken)' };
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 'var(--text-sm)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)', verticalAlign: 'middle', height: '44px' };

  if (!rows || rows.length === 0) return <div style={emptyStyle}>{t('insights.stockoutEmpty')}</div>;

  const maxDays = Math.max(...rows.map((r) => r.daysUntilStockout), 7);
  void currency; // reserved for a future per-row cost column — not needed yet

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>{t('insights.colProduct')}</th>
            <th style={th}>{t('products.status')}</th>
            <th style={{ ...th, textAlign: 'end' }}>{t('insights.colDaysLeft')}</th>
            <th style={{ ...th, textAlign: 'end' }}>{t('insights.colDailyUsage')}</th>
            <th style={th}>{t('insights.colRecentUsage')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone = STATUS_TONE[r.status];
            return (
              <tr key={r.productId}>
                <td style={td}>
                  {language === 'ar' ? r.nameAr : r.nameEn}
                  <span style={{ color: 'var(--ink-faint)', marginInlineStart: '6px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }} dir="ltr">{r.sku}</span>
                </td>
                <td style={td}><StockStatusIndicator status={r.status} /></td>
                <td style={{ ...td, textAlign: 'end' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
                    <span className="tabular" style={{ fontWeight: 600, color: `var(--${tone})` }}>{r.daysUntilStockout}</span>
                    <DaysBar days={r.daysUntilStockout} maxDays={maxDays} tone={tone} />
                  </div>
                </td>
                <td className="tabular" style={{ ...td, textAlign: 'end', color: 'var(--ink-muted)' }}>{r.dailyUsage}</td>
                <td style={td}><Sparkline data={r.sparkline} tone={tone} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ForecastChart({ productId, language, t }: { productId: string; language: string; t: (k: string, o?: Record<string, unknown>) => string }) {
  const isRtl = language === 'ar';
  const { data, isLoading, isError } = useProductForecast(productId);

  if (isLoading || !data) return <div style={emptyStyle}>{t('common.loading')}</div>;
  if (isError) return <div style={emptyStyle}>{t('insights.forecastUnavailable')}</div>;
  if (data.historyDays === 0) return <div style={emptyStyle}>{t('insights.forecastEmpty')}</div>;

  const historyPoints = data.history.map((h) => ({ date: h.date, actual: h.actual, forecast: null as number | null }));
  const forecastPoints = data.hasForecast
    ? data.forecast.map((f) => ({ date: f.date, actual: null as number | null, forecast: f.value }))
    : [];
  // Bridge the two series at the seam so the forecast line visually continues
  // from the last real data point instead of starting with a gap.
  if (data.hasForecast && historyPoints.length > 0) {
    historyPoints[historyPoints.length - 1] = { ...historyPoints[historyPoints.length - 1], forecast: data.history[data.history.length - 1].actual };
  }
  const chartData = [...historyPoints, ...forecastPoints];
  const dayLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Dubai' });

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          <span style={{ width: '10px', height: '2px', background: 'var(--chart-primary)', display: 'inline-block' }} />{t('insights.forecastActual')}
        </span>
        {data.hasForecast && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
            <span style={{ width: '10px', height: '0', borderTop: '2px dashed var(--ink-faint)', display: 'inline-block' }} />{t('insights.forecastForecast')}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: isRtl ? -12 : 8, bottom: 0, left: isRtl ? 8 : -12 }}>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis dataKey="date" reversed={isRtl} tickFormatter={(v: string) => dayLabel.format(new Date(`${v}T00:00:00Z`))} tick={{ fontSize: 11, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} minTickGap={24} />
          <YAxis orientation={isRtl ? 'right' : 'left'} tick={{ fontSize: 11, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v: string) => dayLabel.format(new Date(`${v}T00:00:00Z`))} cursor={{ stroke: 'var(--hairline-strong)' }} />
          <Line type="monotone" dataKey="actual" name={t('insights.forecastActual')} stroke="var(--chart-primary)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls={false} />
          {data.hasForecast && (
            <Line type="monotone" dataKey="forecast" name={t('insights.forecastForecast')} stroke="var(--ink-faint)" strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
      {!data.hasForecast && (
        <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
          {t('insights.forecastBuilding', { days: data.historyDays, min: data.minHistoryForForecast })}
        </p>
      )}
    </div>
  );
}

function SpendBarList({ rows, currency, isRtl }: { rows: Array<{ label: string; amount: number }>; currency: string; isRtl: boolean }) {
  if (rows.length === 0) return <div style={{ ...emptyStyle, padding: 'var(--space-4)' }}>—</div>;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--ink)', marginBottom: '4px' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{r.label}</span>
            <span className="tabular" style={{ color: 'var(--ink-muted)', fontWeight: 500 }} dir="ltr">{formatCurrency(r.amount, currency, 0)}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-sunken)', boxShadow: 'var(--clay-pressed)', overflow: 'hidden', direction: isRtl ? 'rtl' : 'ltr' }}>
            <div className="bar-grow" style={{ width: `${(r.amount / max) * 100}%`, height: '100%', borderRadius: '4px', background: 'var(--chart-primary)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsightsPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const isRtl = language === 'ar';
  const summary = usePredictiveAnalyticsSummary();
  const organization = useOrganization();
  const currency = summary.data?.currency ?? organization.data?.currency ?? 'AED';
  const products = useProducts({});
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  useEffect(() => {
    if (selectedProductId) return;
    const firstAtRisk = summary.data?.daysUntilStockout[0]?.productId;
    if (firstAtRisk) setSelectedProductId(firstAtRisk);
    else if (products.data?.items[0]) setSelectedProductId(products.data.items[0].id);
  }, [selectedProductId, summary.data, products.data]);

  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);
  const spendBySupplier = useMemo(
    () => (summary.data?.projectedSpend.bySupplier ?? []).map((s) => ({ label: s.supplierName ?? t('insights.noSupplier'), amount: s.amount })),
    [summary.data, t],
  );
  const spendByCategory = useMemo(
    () => (summary.data?.projectedSpend.byCategory ?? []).map((c) => ({ label: c.nameEn ? name(c.nameEn, c.nameAr ?? c.nameEn) : t('insights.noCategory'), amount: c.amount })),
    [summary.data, language, t],
  );

  const control: React.CSSProperties = { height: '36px', borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-pressed)', background: 'var(--surface-sunken)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)' }}>{t('insights.title')}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-base)', color: 'var(--ink-muted)' }}>{t('insights.subtitle')}</p>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        {summary.isLoading ? (
          <div style={emptyStyle}>{t('common.loading')}</div>
        ) : (
          <>
            <KpiTile icon={<AlertTriangle size={18} strokeWidth={1.75} />} tint="critical" value={String(summary.data?.kpis.stockoutWithin7Days ?? 0)} label={t('insights.kpiStockout7')} />
            <KpiTile icon={<Wallet size={18} strokeWidth={1.75} />} tint="primary" value={formatCurrency(summary.data?.kpis.projectedSpend ?? 0, currency, 0)} label={t('insights.kpiSpend')} sub={t('insights.kpiSpendSub')} />
            <KpiTile icon={<TrendingUp size={18} strokeWidth={1.75} />} tint="warn" value={String(summary.data?.kpis.trendingUpCount ?? 0)} label={t('insights.kpiTrendingUp')} />
            <KpiTile icon={<ShoppingCart size={18} strokeWidth={1.75} />} tint="primary" value={String(summary.data?.kpis.reorderNeededCount ?? 0)} label={t('insights.kpiReorderNeeded')} />
          </>
        )}
      </div>

      {/* Days until stockout */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <div style={panelTitle}>{t('insights.stockoutPanelTitle')}</div>
          <div style={panelSub}>{t('insights.stockoutPanelSub')}</div>
        </div>
        {summary.isLoading
          ? <div style={emptyStyle}>{t('common.loading')}</div>
          : <StockoutTable rows={summary.data?.daysUntilStockout ?? []} currency={currency} language={language} t={t} />}
      </div>

      {/* Forecast vs actual + projected spend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) minmax(280px, 1fr)', gap: 'var(--space-4)', alignItems: 'stretch' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div>
              <div style={panelTitle}>{t('insights.forecastPanelTitle')}</div>
              <div style={panelSub}>{t('insights.forecastPanelSub')}</div>
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ ...control, minWidth: '200px' }}
              aria-label={t('insights.forecastSelectProduct')}
            >
              {products.data?.items.map((p) => (
                <option key={p.id} value={p.id}>{name(p.nameEn, p.nameAr)}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            {selectedProductId
              ? <ForecastChart productId={selectedProductId} language={language} t={t} />
              : <div style={emptyStyle}>{t('common.loading')}</div>}
          </div>
        </div>

        <div style={card}>
          <div style={panelTitle}>{t('insights.spendPanelTitle')}</div>
          <div style={panelSub}>{t('insights.spendPanelSub')}</div>

          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('insights.spendTotal')}</span>
            <span className="tabular" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--ink)' }} dir="ltr">{formatCurrency(summary.data?.projectedSpend.total ?? 0, currency, 0)}</span>
          </div>

          {summary.isSuccess && summary.data.projectedSpend.total === 0 ? (
            <div style={{ ...emptyStyle, padding: 'var(--space-6) 0 0' }}>{t('insights.spendEmpty')}</div>
          ) : (
            <>
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 'var(--space-3)' }}>{t('insights.spendBySupplier')}</div>
                <SpendBarList rows={spendBySupplier} currency={currency} isRtl={isRtl} />
              </div>
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 'var(--space-3)' }}>{t('insights.spendByCategory')}</div>
                <SpendBarList rows={spendByCategory} currency={currency} isRtl={isRtl} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
