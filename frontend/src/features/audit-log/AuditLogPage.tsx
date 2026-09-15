import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditLog } from '../../api-client/client';

const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '10px 12px', background: 'var(--surface-sunken)', position: 'sticky', top: 0 };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 'var(--text-xs)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)', verticalAlign: 'top' };

const ENTITY_TYPES = ['', 'User', 'Product', 'LocationNode', 'StockMovement', 'Recommendation', 'PurchaseOrder', 'Supplier', 'CycleCount'];

export function AuditLogPage() {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const rows = useAuditLog({ entityType: entityType || undefined, action: action || undefined });

  const control: React.CSSProperties = { height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} style={{ ...control, minWidth: '180px' }}>
          {ENTITY_TYPES.map((e) => <option key={e} value={e}>{e || t('audit.allEntities')}</option>)}
        </select>
        <input value={action} onChange={(e) => setAction(e.target.value)} placeholder={t('audit.actionFilter')} style={{ ...control, minWidth: '200px' }} />
        <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }} className="tabular">{rows.data?.length ?? 0} {t('audit.entries')}</span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('audit.when')}</th>
              <th style={th}>{t('audit.actor')}</th>
              <th style={th}>{t('audit.action')}</th>
              <th style={th}>{t('audit.entity')}</th>
              <th style={th}>{t('audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.data?.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }} dir="ltr">{r.createdAt.slice(0, 19).replace('T', ' ')}</td>
                <td style={td}>{r.actorName}</td>
                <td style={td}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }}>{r.action}</span></td>
                <td style={{ ...td, color: 'var(--ink-muted)' }}>{r.entityType}</td>
                <td style={{ ...td, color: 'var(--ink-faint)', maxWidth: '360px' }}>
                  <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{r.after ? JSON.stringify(r.after) : (r.before ? JSON.stringify(r.before) : '')}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.data && rows.data.length === 0 && <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('audit.empty')}</div>}
      </div>
    </div>
  );
}
