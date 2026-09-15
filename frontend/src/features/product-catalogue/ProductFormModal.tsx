import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../design-system/modal/Modal';
import {
  useProductCategories, useUnits, useSuppliers,
  createProduct, updateProduct, ApiError, type ProductDetail,
} from '../../api-client/client';
import { usePreferences } from '../../application-shell/preferences.store';

interface Props {
  existing?: ProductDetail | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const FIELD_LABEL: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '4px', display: 'block' };
// Module-level so it keeps a stable identity — defining it inside the component
// would remount the inputs on every keystroke and drop focus.
function Field({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><span style={FIELD_LABEL}>{lbl}</span>{children}</label>;
}

export function ProductFormModal({ existing, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const categories = useProductCategories();
  const units = useUnits();
  const suppliers = useSuppliers();
  const name = (en: string, ar: string) => (language === 'ar' ? ar : en);

  const [form, setForm] = useState({
    sku: existing?.sku ?? '',
    barcode: existing?.barcode ?? '',
    nameEn: existing?.nameEn ?? '',
    nameAr: existing?.nameAr ?? '',
    categoryId: existing?.categoryId ?? '',
    baseUnitId: existing ? '' : '',
    packSize: existing?.packSize ?? 1,
    reorderPoint: existing?.reorderPoint ?? 0,
    minLevel: existing?.minLevel ?? 0,
    maxLevel: existing?.maxLevel ?? 1,
    supplierId: existing?.supplierId ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  // On edit, preselect the base unit from its code (detail exposes code, not id).
  useEffect(() => {
    if (existing && !form.baseUnitId && units.data && existing.baseUnitCode) {
      const match = units.data.find((u) => u.code === existing.baseUnitCode);
      if (match) set('baseUnitId', match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.data]);

  const submit = async () => {
    setError(null);
    if (!form.sku.trim() || !form.nameEn.trim() || !form.nameAr.trim() || !form.baseUnitId) {
      setError(t('products.form.requiredMissing'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        categoryId: form.categoryId || null,
        baseUnitId: form.baseUnitId,
        packSize: Number(form.packSize),
        reorderPoint: Number(form.reorderPoint),
        minLevel: Number(form.minLevel),
        maxLevel: Number(form.maxLevel),
        supplierId: form.supplierId || null,
      };
      const saved = existing ? await updateProduct(existing.id, payload) : await createProduct(payload);
      void queryClient.invalidateQueries();
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof ApiError ? (language === 'ar' ? err.body.messageAr : err.body.messageEn) ?? t('errors.generic') : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const input: React.CSSProperties = { height: '36px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };

  return (
    <Modal title={existing ? t('products.form.editTitle') : t('products.form.newTitle')} onClose={onClose} width={560}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Field lbl={t('products.sku') + ' *'}><input style={input} dir="ltr" value={form.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field lbl={t('products.barcode')}><input style={input} dir="ltr" placeholder={t('products.form.barcodeHint')} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} /></Field>
        <Field lbl={t('products.name') + ' (EN) *'}><input style={input} value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
        <Field lbl={t('products.name') + ' (AR) *'}><input style={input} dir="rtl" value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} /></Field>
        <Field lbl={t('products.category')}>
          <select style={input} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">—</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{name(c.nameEn, c.nameAr)}</option>)}
          </select>
        </Field>
        <Field lbl={t('products.unit') + ' *'}>
          <select style={input} value={form.baseUnitId} onChange={(e) => set('baseUnitId', e.target.value)}>
            <option value="">—</option>
            {units.data?.map((u) => <option key={u.id} value={u.id}>{u.code} · {name(u.nameEn, u.nameAr)}</option>)}
          </select>
        </Field>
        <Field lbl={t('products.supplier')}>
          <select style={input} value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">—</option>
            {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field lbl={t('products.packSize')}><input type="number" min={1} style={input} className="tabular" value={form.packSize} onChange={(e) => set('packSize', e.target.value)} /></Field>
        <Field lbl={t('products.reorderPoint')}><input type="number" min={0} style={input} className="tabular" value={form.reorderPoint} onChange={(e) => set('reorderPoint', e.target.value)} /></Field>
        <Field lbl={t('products.form.minLevel')}><input type="number" min={0} style={input} className="tabular" value={form.minLevel} onChange={(e) => set('minLevel', e.target.value)} /></Field>
        <Field lbl={t('products.form.maxLevel')}><input type="number" min={1} style={input} className="tabular" value={form.maxLevel} onChange={(e) => set('maxLevel', e.target.value)} /></Field>
      </div>

      {existing && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)', marginTop: 'var(--space-3)' }}>{t('products.form.unitEditNote')}</p>}
      {error && <div role="alert" style={{ marginTop: 'var(--space-3)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
        <button type="button" onClick={onClose} style={{ height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>{t('common.cancel')}</button>
        <button type="button" onClick={submit} disabled={saving} style={{ height: '36px', padding: '0 20px', borderRadius: 'var(--radius-md)', border: 'none', background: saving ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', cursor: saving ? 'default' : 'pointer', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
