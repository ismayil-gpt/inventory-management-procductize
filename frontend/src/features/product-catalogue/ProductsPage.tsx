import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, Printer } from 'lucide-react';
import { useProducts, useProductCategories, resolveProductByBarcode, fetchLabelsBatch, ApiError } from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from '../authentication/auth.store';
import { StockStatusIndicator } from '../../design-system/stock-status-indicator/StockStatusIndicator';
import { BarcodeInput } from '../../features/barcode-scanning/BarcodeInput';
import { printLabels } from '../../features/barcode-scanning/print-labels';
import { ProductFormModal } from './ProductFormModal';
import { ImportModal } from './ImportModal';

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const thStyle: React.CSSProperties = {
  position: 'sticky', top: 0, background: 'var(--surface-sunken)', textAlign: 'start',
  fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase',
  color: 'var(--ink-muted)', fontWeight: 500, padding: '8px 12px', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '0 12px', height: '40px', fontSize: 'var(--text-sm)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)' };

export function ProductsPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const search = useDebounced(searchInput);

  const products = useProducts({ search, categoryId: categoryId || undefined, lowStock });
  const categories = useProductCategories();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const printAll = async () => {
    if (!products.data || products.data.items.length === 0) return;
    const labels = await fetchLabelsBatch('product', products.data.items.map((p) => p.id));
    printLabels(labels, t('products.printLabels'));
  };

  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const onBarcode = async (code: string) => {
    setBarcodeBusy(true);
    setBarcodeError(null);
    try {
      const product = await resolveProductByBarcode(code);
      navigate(`/products/${product.id}`);
    } catch (err) {
      setBarcodeError(err instanceof ApiError && err.status === 404 ? t('barcode.notFound') : t('errors.generic'));
    } finally {
      setBarcodeBusy(false);
    }
  };

  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);
  const control: React.CSSProperties = {
    height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
    background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)',
  };

  const toolbarBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', cursor: 'pointer', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {isAdmin && (
          <button type="button" onClick={() => setShowForm(true)} style={{ ...toolbarBtn, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500 }}>
            <Plus size={16} strokeWidth={1.5} /> {t('products.newProduct')}
          </button>
        )}
        {isAdmin && (
          <button type="button" onClick={() => setShowImport(true)} style={toolbarBtn}>
            <Upload size={16} strokeWidth={1.5} /> {t('products.importBtn')}
          </button>
        )}
        <button type="button" onClick={() => void printAll()} style={toolbarBtn}>
          <Printer size={16} strokeWidth={1.5} /> {t('products.printLabels')}
        </button>
      </div>

      {showForm && <ProductFormModal onClose={() => setShowForm(false)} onSaved={(id) => { setShowForm(false); navigate(`/products/${id}`); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      <BarcodeInput label={t('locations.findByBarcodeProduct')} onSubmit={onBarcode} busy={barcodeBusy} error={barcodeError} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('products.searchPlaceholder')}
          style={{ ...control, minWidth: '260px', flex: '1 1 260px' }}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...control, minWidth: '180px' }}>
          <option value="">{t('products.allCategories')}</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>{name(c.nameEn, c.nameAr)}</option>
          ))}
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
          {t('products.lowStockOnly')}
        </label>
        <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }} className="tabular">
          {products.data ? t('products.count', { count: products.data.total }) : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('products.sku')}</th>
              <th style={thStyle}>{t('products.name')}</th>
              <th style={thStyle}>{t('products.category')}</th>
              <th style={{ ...thStyle, textAlign: 'end' }}>{t('products.onHand')}</th>
              <th style={{ ...thStyle, textAlign: 'end' }}>{t('products.reorderPoint')}</th>
              <th style={thStyle}>{t('products.status')}</th>
            </tr>
          </thead>
          <tbody>
            {products.data?.items.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/products/${p.id}`)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }} dir="ltr">{p.sku}</td>
                <td style={tdStyle}>{name(p.nameEn, p.nameAr)}</td>
                <td style={{ ...tdStyle, color: 'var(--ink-muted)' }}>{name(p.categoryNameEn ?? '—', p.categoryNameAr ?? '—')}</td>
                <td style={{ ...tdStyle, textAlign: 'end' }} className="tabular">{p.totalStock} {p.baseUnitCode ?? ''}</td>
                <td style={{ ...tdStyle, textAlign: 'end', color: 'var(--ink-muted)' }} className="tabular">{p.reorderPoint}</td>
                <td style={tdStyle}><StockStatusIndicator status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.isLoading && <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('common.loading')}</div>}
        {products.data && products.data.total === 0 && (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('products.empty')}</div>
        )}
      </div>
    </div>
  );
}
