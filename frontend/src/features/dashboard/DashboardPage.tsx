import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Package, Boxes, MapPin, Truck, Activity, AlertTriangle, CheckCircle2, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useDashboardSummary, type DashboardSummary } from '../../api-client/client';
import { useAuthStore } from '../authentication/auth.store';
import { usePreferences } from '../../application-shell/preferences.store';
import { LocationChip } from '../../design-system/location-designator/LocationChip';

function num(v?: number): string {
  return typeof v === 'number' ? v.toLocaleString('en-US') : '—';
}

const dayLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Dubai' });
const dayTimeLabel = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai',
});

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)' };
const panelTitle: React.CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' };
const panelSub: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginTop: '2px' };
const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--hairline-strong)', borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-xs)', color: 'var(--ink)', boxShadow: 'var(--shadow-floating)', padding: '8px 10px',
};

function StatCard({ icon, tint, value, label, sub }: { icon: React.ReactNode; tint: string; value: string; label: string; sub: string }) {
  return (
    <div style={{ ...card, padding: 'var(--space-4) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <span style={{ display: 'inline-flex', width: '36px', height: '36px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: `var(--${tint}-soft)`, color: `var(--${tint})` }}>{icon}</span>
      <div>
        <div className="tabular" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', fontWeight: 500, marginTop: '4px' }}>{label}</div>
        <div style={panelSub}>{sub}</div>
      </div>
    </div>
  );
}

// Same visual language throughout the page: a slim proportional bar plus a
// legend row with real counts — used for both stock health and the
// replenishment pipeline so the two read as one system, not two widgets.
function SegmentedBar({ segments }: { segments: Array<{ key: string; tone: string; label: string; count: number }> }) {
  const total = Math.max(1, segments.reduce((s, seg) => s + seg.count, 0));
  return (
    <div>
      <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
        {segments.map((seg) => seg.count > 0 && (
          <div key={seg.key} title={`${seg.label}: ${seg.count}`} style={{ width: `${(seg.count / total) * 100}%`, background: `var(--${seg.tone})` }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
        {segments.map((seg) => (
          <div key={seg.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: `var(--${seg.tone})` }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{seg.label}</span>
            <span className="tabular" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', fontWeight: 500 }}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovementTrendChart({ data, labels, isRtl }: { data: DashboardSummary['movementTrend']; labels: { in: string; out: string }; isRtl: boolean }) {
  const chartData = data.map((d) => ({ ...d, label: dayLabel.format(new Date(`${d.date}T00:00:00Z`)) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: isRtl ? -12 : 8, bottom: 0, left: isRtl ? 8 : -12 }}>
        <CartesianGrid vertical={false} stroke="var(--hairline)" />
        {/* §10 — charts mirror axis placement in RTL: earliest reads from the start of reading direction. */}
        <XAxis dataKey="label" reversed={isRtl} tick={{ fontSize: 11, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
        <YAxis orientation={isRtl ? 'right' : 'left'} tick={{ fontSize: 11, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--ink-muted)', marginBottom: '4px' }} cursor={{ stroke: 'var(--hairline-strong)' }} />
        <Line type="monotone" dataKey="goodsIn" name={labels.in} stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="goodsOut" name={labels.out} stroke="var(--ink-faint)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryBreakdownChart({ data, language }: { data: DashboardSummary['categoryBreakdown']; language: string }) {
  const isRtl = language === 'ar';
  const chartData = data.map((c) => ({ name: isRtl ? c.nameAr : c.nameEn, units: c.units }));
  const height = Math.max(180, chartData.length * 34);
  const axisWidth = isRtl ? 140 : 110;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: isRtl ? 0 : 16, bottom: 0, left: isRtl ? 16 : 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--hairline)" />
        {/* §10 — charts mirror axis placement in RTL: category axis moves to the reading-start side, bars grow toward it. */}
        <XAxis type="number" reversed={isRtl} tick={{ fontSize: 11, fill: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" orientation={isRtl ? 'right' : 'left'} tick={{ fontSize: 12, fill: 'var(--ink)' }} axisLine={false} tickLine={false} width={axisWidth} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-sunken)' }} />
        <Bar dataKey="units" fill="var(--primary)" radius={isRtl ? [2, 0, 0, 2] : [0, 2, 2, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const MOVEMENT_TYPE_KEY: Record<string, string> = {
  GOODS_IN: 'movements.goodsIn', GOODS_OUT: 'movements.goodsOut',
  TRANSFER: 'movements.transfer', ADJUSTMENT: 'movements.adjustment', CYCLE_COUNT: 'movements.cycleCount',
};

function RecentActivityTable({ rows, language }: { rows: DashboardSummary['recentActivity']; language: string }) {
  const { t } = useTranslation();
  const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '8px 12px', background: 'var(--surface-sunken)' };
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 'var(--text-xs)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)', verticalAlign: 'middle' };

  if (rows.length === 0) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('dashboard.noActivity')}</div>;
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>{t('dashboard.activityTime')}</th>
            <th style={th}>{t('dashboard.activityType')}</th>
            <th style={th}>{t('dashboard.activityProduct')}</th>
            <th style={{ ...th, textAlign: 'end' }}>{t('dashboard.activityQty')}</th>
            <th style={th}>{t('dashboard.activityLocation')}</th>
            <th style={th}>{t('dashboard.activityBy')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }} dir="ltr">{dayTimeLabel.format(new Date(r.createdAt))}</td>
              <td style={td}>{t(MOVEMENT_TYPE_KEY[r.type] ?? 'movements.adjustment')}</td>
              <td style={{ ...td, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {language === 'ar' ? r.productNameAr : r.productNameEn}
                <span style={{ color: 'var(--ink-faint)', marginInlineStart: '6px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }}>{r.sku}</span>
              </td>
              <td className="tabular" style={{ ...td, textAlign: 'end', fontWeight: 500 }}>{r.quantity > 0 ? '+' : ''}{r.quantity}</td>
              <td style={td}>{r.designator ? <LocationChip designator={r.designator} /> : '—'}</td>
              <td style={{ ...td, color: 'var(--ink-muted)' }}>{r.userDisplayName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: s, isSuccess } = useDashboardSummary();

  const health = s?.stockStatus ?? { inStock: 0, low: 0, critical: 0, outOfStock: 0 };
  const stockSegments = [
    { key: 'inStock', tone: 'ok', label: t('stock.inStock'), count: health.inStock },
    { key: 'low', tone: 'warn', label: t('stock.low'), count: health.low },
    { key: 'critical', tone: 'critical', label: t('stock.critical'), count: health.critical },
    { key: 'out', tone: 'ink-faint', label: t('stock.outOfStock'), count: health.outOfStock },
  ];
  const needsReorder = s?.needsReorder ?? 0;

  const pipelineTone: Record<string, string> = {
    PENDING: 'warn', APPROVED: 'ok', AMENDED: 'ink-muted', ORDERED: 'primary', RECEIVED: 'ok', REJECTED: 'critical',
  };
  const pipelineSegments = (s?.recommendationsPipeline ?? []).map((p) => ({
    key: p.status, tone: pipelineTone[p.status] ?? 'ink-muted', label: t(`replenishment.status.${p.status}`), count: p.count,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Friendly header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)' }}>{t('dashboard.welcome', { name: user?.displayName ?? '' })}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-base)', color: 'var(--ink-muted)' }}>{t('dashboard.glance')}</p>
      </div>

      {/* Key numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard icon={<Package size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.products)} label={t('dashboard.products')} sub={t('dashboard.productsSub')} />
        <StatCard icon={<Boxes size={18} strokeWidth={1.75} />} tint="ok" value={num(s?.totalUnits)} label={t('dashboard.unitsInStock')} sub={t('dashboard.unitsSub')} />
        <StatCard icon={<MapPin size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.shelves)} label={t('dashboard.storageShelves')} sub={t('dashboard.shelvesSub')} />
        <StatCard icon={<Truck size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.suppliers)} label={t('navigation.suppliers')} sub={t('dashboard.suppliersSub')} />
        <StatCard icon={<Activity size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.movements30d)} label={t('dashboard.movements30d')} sub={t('dashboard.movements30dSub')} />
      </div>

      {/* Charts: throughput trend + where stock sits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.6fr) minmax(260px, 1fr)', gap: 'var(--space-4)', alignItems: 'stretch' }}>
        <div style={card}>
          <div style={panelTitle}>{t('dashboard.movementTrend')}</div>
          <div style={panelSub}>{t('dashboard.movementTrendSub')}</div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
              <span style={{ width: '10px', height: '2px', background: 'var(--primary)', display: 'inline-block' }} />{t('movements.goodsIn')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
              <span style={{ width: '10px', height: '2px', background: 'var(--ink-faint)', display: 'inline-block' }} />{t('movements.goodsOut')}
            </span>
          </div>
          {isSuccess && <MovementTrendChart data={s.movementTrend} labels={{ in: t('movements.goodsIn'), out: t('movements.goodsOut') }} isRtl={language === 'ar'} />}
        </div>
        <div style={card}>
          <div style={panelTitle}>{t('dashboard.categoryBreakdown')}</div>
          <div style={panelSub}>{t('dashboard.categoryBreakdownSub')}</div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            {isSuccess && s.categoryBreakdown.length > 0
              ? <CategoryBreakdownChart data={s.categoryBreakdown} language={language} />
              : <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('dashboard.noActivity')}</div>}
          </div>
        </div>
      </div>

      {/* Stock health + replenishment pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
        <div style={card}>
          <div style={{ ...panelTitle, marginBottom: 'var(--space-4)' }}>{t('dashboard.stockHealth')}</div>
          <SegmentedBar segments={stockSegments} />
        </div>
        <div style={card}>
          <div style={{ ...panelTitle, marginBottom: 'var(--space-4)' }}>{t('dashboard.replenishmentPipeline')}</div>
          {pipelineSegments.some((p) => p.count > 0)
            ? <SegmentedBar segments={pipelineSegments} />
            : <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('dashboard.noActivity')}</div>}
        </div>
      </div>

      {/* Needs your attention */}
      {needsReorder > 0 ? (
        <div style={{ ...card, borderInlineStart: '3px solid var(--warn)', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--warn-soft)', color: 'var(--warn)', flexShrink: 0 }}>
            <AlertTriangle size={20} strokeWidth={1.75} />
          </span>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{t('dashboard.needReorder', { count: needsReorder })}</div>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('dashboard.needReorderBody')}</p>
            {(health.critical > 0 || health.outOfStock > 0) && (
              <div style={{ marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>
                {health.critical > 0 && <span style={{ color: 'var(--critical)' }}>{t('dashboard.ofCritical', { count: health.critical })}</span>}
                {health.critical > 0 && health.outOfStock > 0 && ' · '}
                {health.outOfStock > 0 && <span>{t('dashboard.ofOut', { count: health.outOfStock })}</span>}
              </div>
            )}
          </div>
          <button type="button" onClick={() => navigate('/replenishment')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            {t('dashboard.reviewRecs')}
            <ArrowRight size={16} strokeWidth={1.75} style={{ transform: language === 'ar' ? 'scaleX(-1)' : 'none' }} />
          </button>
        </div>
      ) : (
        <div style={{ ...card, borderInlineStart: '3px solid var(--ok)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--ok-soft)', color: 'var(--ok)', flexShrink: 0 }}>
            <CheckCircle2 size={20} strokeWidth={1.75} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{t('dashboard.allGood')}</div>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('dashboard.allGoodBody')}</p>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t('dashboard.recentActivity')}</span>
        </div>
        {isSuccess && <RecentActivityTable rows={s.recentActivity} language={language} />}
      </div>
    </div>
  );
}
