import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Printer, Trash2 } from 'lucide-react';
import { useProduct, fetchProductLabel, deleteProduct } from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from '../authentication/auth.store';
import { StockStatusIndicator } from '../../design-system/stock-status-indicator/StockStatusIndicator';
import { LocationChip } from '../../design-system/location-designator/LocationChip';
import { ConfirmDialog } from '../../design-system/confirm-dialog/ConfirmDialog';
import { printLabels } from '../../features/barcode-scanning/print-labels';
import { ProductFormModal } from './ProductFormModal';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', marginTop: '2px' }}>{children}</div>
    </div>
  );
}

export function ProductDetailPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, isError } = useProduct(id);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = (en?: string | null, ar?: string | null) => (language === 'ar' ? ar : en) ?? '—';

  const printOne = async () => {
    if (!p) return;
    printLabels(await fetchProductLabel(p.id), p.sku);
  };

  if (isLoading) return <div style={{ color: 'var(--ink-muted)' }}>{t('common.loading')}</div>;
  if (isError || !p) return <div style={{ color: 'var(--critical)' }}>{t('errors.generic')}</div>;

  const actionBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {editing && <ProductFormModal existing={p} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={t('products.deleteTitle')}
          message={t('products.deleteConfirm', { name: name(p.nameEn, p.nameAr) })}
          onConfirm={async () => { await deleteProduct(p.id); await queryClient.invalidateQueries({ queryKey: ['products'] }); navigate('/products'); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={() => navigate('/products')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={16} strokeWidth={1.5} style={{ transform: language === 'ar' ? 'scaleX(-1)' : 'none' }} />
          {t('products.back')}
        </button>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" onClick={() => void printOne()} style={actionBtn}><Printer size={15} strokeWidth={1.5} /> {t('products.printLabel')}</button>
          {isAdmin && <button type="button" onClick={() => setEditing(true)} style={actionBtn}><Pencil size={15} strokeWidth={1.5} /> {t('products.edit')}</button>}
          {isAdmin && <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...actionBtn, color: 'var(--critical)' }}><Trash2 size={15} strokeWidth={1.5} /> {t('common.delete')}</button>}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)' }}>{name(p.nameEn, p.nameAr)}</h2>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', marginTop: '2px' }} dir={language === 'ar' ? 'ltr' : 'rtl'}>{name(p.nameAr, p.nameEn)}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="tabular" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--ink)' }}>{p.totalStock} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{p.baseUnitCode}</span></div>
            <StockStatusIndicator status={p.status} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--hairline)' }}>
          <Field label={t('products.sku')}><span style={{ fontFamily: 'var(--font-mono)' }} dir="ltr">{p.sku}</span></Field>
          <Field label={t('products.barcode')}><span style={{ fontFamily: 'var(--font-mono)' }} dir="ltr">{p.barcode}</span></Field>
          <Field label={t('products.barcodeSource')}>{p.barcodeSource === 'INTERNAL' ? t('products.internal') : 'EAN/UPC'}</Field>
          <Field label={t('products.category')}>{name(p.categoryNameEn, p.categoryNameAr)}</Field>
          <Field label={t('products.supplier')}>{p.supplierName ?? '—'}</Field>
          <Field label={t('products.leadTime')}><span className="tabular">{p.supplierLeadTimeDays ?? '—'}</span></Field>
          <Field label={t('products.unit')}>{p.baseUnitCode ?? '—'}</Field>
          <Field label={t('products.packSize')}><span className="tabular">{p.packSize}</span></Field>
          <Field label={t('products.reorderPoint')}><span className="tabular">{p.reorderPoint}</span></Field>
          <Field label={t('products.minMax')}><span className="tabular">{p.minLevel} / {p.maxLevel}</span></Field>
        </div>
      </div>

      {/* Stock positions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', borderBottom: '1px solid var(--hairline)' }}>
          {t('products.positions')}
        </div>
        {p.positions.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('products.noPositions')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {p.positions.map((pos) => (
                <tr key={pos.locationNodeId} style={{ borderTop: '1px solid var(--hairline)' }}>
                  <td style={{ padding: '10px 16px' }}><LocationChip designator={pos.designator} /></td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }} dir="ltr">{pos.barcode ?? ''}</td>
                  <td className="tabular" style={{ padding: '10px 16px', textAlign: 'end', fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{pos.quantity} {p.baseUnitCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
