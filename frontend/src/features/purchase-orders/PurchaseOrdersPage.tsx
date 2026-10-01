import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { usePurchaseOrders, openPurchaseOrderPdf, type PurchaseOrderSummary } from '../../api-client/client';

// Read-only list of purchase orders (restored 2026-10-01). Orders are created
// from Replenishment — one per supplier per approval run (§12 rule 7) — so this
// screen only lists them and opens each PDF.
const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '10px 12px', background: 'var(--surface-sunken)', position: 'sticky', top: 0 };
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)', verticalAlign: 'middle' };

const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai',
});

// A draft still needs action, so it wears the direction sign; sent and
// received orders are settled and stay quiet.
function StatusTag({ status }: { status: PurchaseOrderSummary['status'] }) {
  const { t } = useTranslation();
  const look: Record<PurchaseOrderSummary['status'], React.CSSProperties> = {
    DRAFT: { background: 'var(--sign-go)', color: 'var(--sign-on-go)' },
    SENT: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--hairline-strong)' },
    RECEIVED: { background: 'transparent', color: 'var(--ok)', border: '1px solid var(--ok)' },
  };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-chip)', fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap', ...look[status] }}>
      {t(`purchaseOrders.statusLabel.${status}`)}
    </span>
  );
}

export function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const orders = usePurchaseOrders();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewPdf = async (id: string) => {
    setError(null);
    setOpeningId(id);
    try {
      await openPurchaseOrderPdf(id);
    } catch {
      setError(t('errors.network'));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--ink-muted)', maxWidth: '72ch' }}>{t('purchaseOrders.intro')}</p>

      {error && <div role="alert" className="sign-stop" style={{ padding: '10px 14px', fontSize: 'var(--text-sm)' }}>{error}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('purchaseOrders.number')}</th>
              <th style={th}>{t('purchaseOrders.supplier')}</th>
              <th style={th}>{t('purchaseOrders.created')}</th>
              <th style={{ ...th, textAlign: 'end' }}>{t('purchaseOrders.lines')}</th>
              <th style={{ ...th, textAlign: 'end' }}>{t('purchaseOrders.totalQty')}</th>
              <th style={th}>{t('purchaseOrders.status')}</th>
              <th style={th}>{t('purchaseOrders.sentAt')}</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {orders.data?.map((po) => (
              <tr key={po.id}>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontWeight: 600 }} dir="ltr">{po.poNumber}</td>
                <td style={td}>{po.supplierName}</td>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }} dir="ltr">{dateTime.format(new Date(po.createdAt))}</td>
                <td className="tabular" style={{ ...td, textAlign: 'end' }}>{po.lineCount}</td>
                <td className="tabular" style={{ ...td, textAlign: 'end' }}>{po.totalQty.toLocaleString('en-US')}</td>
                <td style={td}><StatusTag status={po.status} /></td>
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }} dir="ltr">
                  {po.sentAt ? dateTime.format(new Date(po.sentAt)) : <span style={{ fontFamily: 'var(--font-sans)' }}>{t('purchaseOrders.notSent')}</span>}
                </td>
                <td style={{ ...td, textAlign: 'end' }}>
                  <button
                    type="button"
                    onClick={() => void viewPdf(po.id)}
                    disabled={openingId === po.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <FileText size={14} strokeWidth={1.5} aria-hidden /> {openingId === po.id ? t('common.loading') : t('purchaseOrders.viewPdf')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.isLoading && <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('common.loading')}</div>}
        {orders.data && orders.data.length === 0 && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>
            {t('purchaseOrders.empty')} {t('purchaseOrders.generateHint')}
          </div>
        )}
      </div>
    </div>
  );
}
