import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSuppliers, createSupplier, updateSupplier, deleteSupplier, ApiError, type Supplier } from '../../api-client/client';
import { useAuthStore } from '../authentication/auth.store';
import { Modal } from '../../design-system/modal/Modal';
import { ConfirmDialog } from '../../design-system/confirm-dialog/ConfirmDialog';

const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '10px 12px', background: 'var(--surface-sunken)' };
const td: React.CSSProperties = { padding: '0 12px', height: '44px', fontSize: 'var(--text-sm)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)' };

export function SuppliersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [editing, setEditing] = useState<Supplier | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {isAdmin && (
        <div>
          <button type="button" onClick={() => setEditing('new')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            <Plus size={16} strokeWidth={1.5} /> {t('suppliers.add')}
          </button>
        </div>
      )}
      {editing && <SupplierModal supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('suppliers.deleteTitle')}
          message={t('suppliers.deleteConfirm', { name: deleting.name })}
          onConfirm={async () => { await deleteSupplier(deleting.id); await queryClient.invalidateQueries({ queryKey: ['suppliers'] }); }}
          onClose={() => setDeleting(null)}
        />
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('suppliers.name')}</th>
              <th style={th}>{t('suppliers.email')}</th>
              <th style={th}>{t('suppliers.phone')}</th>
              <th style={{ ...th, textAlign: 'end' }}>{t('suppliers.leadTime')}</th>
              {isAdmin && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {suppliers.data?.map((s) => (
              <tr key={s.id}>
                <td style={td}>{s.name}</td>
                <td style={{ ...td, color: 'var(--ink-muted)' }} dir="ltr">{s.email}</td>
                <td style={{ ...td, color: 'var(--ink-muted)' }} dir="ltr">{s.phone ?? '—'}</td>
                <td style={{ ...td, textAlign: 'end' }} className="tabular">{s.leadTimeDays}</td>
                {isAdmin && (
                  <td style={{ ...td, textAlign: 'end' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button type="button" onClick={() => setEditing(s)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '30px', padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                        <Pencil size={13} /> {t('products.edit')}
                      </button>
                      <button type="button" onClick={() => setDeleting(s)} aria-label={t('common.delete')} title={t('common.delete')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '30px', width: '30px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--critical)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {suppliers.data && suppliers.data.length === 0 && <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>{t('suppliers.empty')}</div>}
      </div>
    </div>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: supplier?.name ?? '', email: supplier?.email ?? '', phone: (supplier as Supplier & { phone?: string })?.phone ?? '', leadTimeDays: supplier?.leadTimeDays ?? 3 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!form.name.trim() || !form.email.trim()) { setError(t('suppliers.requiredMissing')); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, leadTimeDays: Number(form.leadTimeDays) };
      if (supplier) await updateSupplier(supplier.id, payload); else await createSupplier(payload);
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.body.messageEn ?? t('errors.generic') : t('errors.generic')); }
    finally { setSaving(false); }
  };

  const input: React.CSSProperties = { height: '36px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };
  const lbl: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '4px', display: 'block' };

  return (
    <Modal title={supplier ? t('suppliers.editTitle') : t('suppliers.add')} onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <label><span style={lbl}>{t('suppliers.name')} *</span><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label><span style={lbl}>{t('suppliers.email')} *</span><input style={input} dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label><span style={lbl}>{t('suppliers.phone')}</span><input style={input} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label><span style={lbl}>{t('suppliers.leadTime')} *</span><input type="number" min={0} className="tabular" style={input} value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) })} /></label>
      </div>
      {error && <div role="alert" style={{ marginTop: 'var(--space-3)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
        <button type="button" onClick={onClose} style={{ height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>{t('common.cancel')}</button>
        <button type="button" onClick={submit} disabled={saving} style={{ height: '36px', padding: '0 20px', borderRadius: 'var(--radius-md)', border: 'none', background: saving ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
