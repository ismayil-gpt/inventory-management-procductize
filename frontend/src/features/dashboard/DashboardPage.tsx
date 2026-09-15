import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Package, Boxes, MapPin, Truck, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useDashboardSummary } from '../../api-client/client';
import { useAuthStore } from '../authentication/auth.store';
import { usePreferences } from '../../application-shell/preferences.store';

function num(v?: number): string {
  return typeof v === 'number' ? v.toLocaleString('en-US') : '—';
}

function StatCard({ icon, tint, value, label, sub }: { icon: React.ReactNode; tint: string; value: string; label: string; sub: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <span style={{ display: 'inline-flex', width: '36px', height: '36px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: `var(--${tint}-soft)`, color: `var(--${tint})` }}>{icon}</span>
      <div>
        <div className="tabular" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', fontWeight: 500, marginTop: '4px' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{sub}</div>
      </div>
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
  const healthTotal = Math.max(1, health.inStock + health.low + health.critical + health.outOfStock);
  const segments = [
    { key: 'inStock', tone: 'ok', label: t('stock.inStock'), count: health.inStock },
    { key: 'low', tone: 'warn', label: t('stock.low'), count: health.low },
    { key: 'critical', tone: 'critical', label: t('stock.critical'), count: health.critical },
    { key: 'out', tone: 'ink-faint', label: t('stock.outOfStock'), count: health.outOfStock },
  ];
  const needsReorder = s?.needsReorder ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1000px' }}>
      {/* Friendly header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)' }}>{t('dashboard.welcome', { name: user?.displayName ?? '' })}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-base)', color: 'var(--ink-muted)' }}>{t('dashboard.glance')}</p>
      </div>

      {/* Key numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard icon={<Package size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.products)} label={t('dashboard.products')} sub={t('dashboard.productsSub')} />
        <StatCard icon={<Boxes size={18} strokeWidth={1.75} />} tint="ok" value={num(s?.totalUnits)} label={t('dashboard.unitsInStock')} sub={t('dashboard.unitsSub')} />
        <StatCard icon={<MapPin size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.shelves)} label={t('dashboard.storageShelves')} sub={t('dashboard.shelvesSub')} />
        <StatCard icon={<Truck size={18} strokeWidth={1.75} />} tint="primary" value={num(s?.suppliers)} label={t('navigation.suppliers')} sub={t('dashboard.suppliersSub')} />
      </div>

      {/* Stock health */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--space-4)' }}>{t('dashboard.stockHealth')}</div>
        <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
          {segments.map((seg) => seg.count > 0 && (
            <div key={seg.key} title={`${seg.label}: ${seg.count}`} style={{ width: `${(seg.count / healthTotal) * 100}%`, background: `var(--${seg.tone})` }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
          {segments.map((seg) => (
            <div key={seg.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: `var(--${seg.tone})` }} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{seg.label}</span>
              <span className="tabular" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', fontWeight: 500 }}>{isSuccess ? seg.count : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Needs your attention */}
      {needsReorder > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderInlineStart: '3px solid var(--warn)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderInlineStart: '3px solid var(--ok)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'var(--ok-soft)', color: 'var(--ok)', flexShrink: 0 }}>
            <CheckCircle2 size={20} strokeWidth={1.75} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{t('dashboard.allGood')}</div>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('dashboard.allGoodBody')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
