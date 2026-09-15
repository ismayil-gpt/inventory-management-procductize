import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { downloadReport } from '../../api-client/client';

const REPORTS: Array<{ key: 'stock-on-hand' | 'stock-movements' | 'replenishment'; titleKey: string; descKey: string }> = [
  { key: 'stock-on-hand', titleKey: 'reports.stockOnHand', descKey: 'reports.stockOnHandDesc' },
  { key: 'stock-movements', titleKey: 'reports.stockMovements', descKey: 'reports.stockMovementsDesc' },
  { key: 'replenishment', titleKey: 'reports.replenishment', descKey: 'reports.replenishmentDesc' },
];

export function ReportsPage() {
  const { t } = useTranslation();
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
      {REPORTS.map((r) => (
        <div key={r.key} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)' }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{t(r.titleKey)}</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', margin: '6px 0 var(--space-4)' }}>{t(r.descKey)}</p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" onClick={() => void downloadReport(r.key, 'xlsx')} style={btn}><FileSpreadsheet size={15} strokeWidth={1.5} /> {t('reports.excel')}</button>
            <button type="button" onClick={() => void downloadReport(r.key, 'pdf')} style={btn}><FileText size={15} strokeWidth={1.5} /> {t('reports.pdf')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
