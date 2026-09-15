import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useUsers, createUser, updateUser, deleteUser, ApiError, type UserRow } from '../../api-client/client';
import { Modal } from '../../design-system/modal/Modal';
import { ConfirmDialog } from '../../design-system/confirm-dialog/ConfirmDialog';
import { useAuthStore } from '../authentication/auth.store';

const th: React.CSSProperties = { textAlign: 'start', fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 500, padding: '10px 12px', background: 'var(--surface-sunken)' };
const td: React.CSSProperties = { padding: '0 12px', height: '44px', fontSize: 'var(--text-sm)', color: 'var(--ink)', borderTop: '1px solid var(--hairline)' };

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const users = useUsers();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <button type="button" onClick={() => setEditing('new')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={1.5} /> {t('users.add')}
        </button>
      </div>
      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('users.deleteTitle')}
          message={t('users.deleteConfirm', { name: deleting.displayName })}
          onConfirm={async () => { await deleteUser(deleting.id); await queryClient.invalidateQueries({ queryKey: ['users'] }); }}
          onClose={() => setDeleting(null)}
        />
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{t('users.displayName')}</th>
              <th style={th}>{t('auth.email')}</th>
              <th style={th}>{t('users.role')}</th>
              <th style={th}>{t('users.active')}</th>
              <th style={th}>{t('users.lastLogin')}</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td style={td}>{u.displayName}</td>
                <td style={{ ...td, color: 'var(--ink-muted)' }} dir="ltr">{u.email}</td>
                <td style={td}>{t(`roles.${u.role}`)}</td>
                <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.isActive ? 'var(--ok)' : 'var(--ink-faint)' }} />{u.isActive ? t('users.yes') : t('users.no')}</span></td>
                <td style={{ ...td, color: 'var(--ink-muted)' }} className="tabular" dir="ltr">{u.lastLoginAt ? u.lastLoginAt.slice(0, 16).replace('T', ' ') : '—'}</td>
                <td style={{ ...td, textAlign: 'end' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button type="button" onClick={() => setEditing(u)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '30px', padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                      <Pencil size={13} /> {t('products.edit')}
                    </button>
                    {u.id !== currentUserId && (
                      <button type="button" onClick={() => setDeleting(u)} aria-label={t('common.delete')} title={t('common.delete')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '30px', width: '30px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--critical)', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserModal({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: user?.email ?? '', displayName: user?.displayName ?? '', role: user?.role ?? 'STORE_KEEPER', isActive: user?.isActive ?? true, password: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    try {
      setSaving(true);
      if (user) {
        const payload: Record<string, unknown> = { displayName: form.displayName, role: form.role, isActive: form.isActive };
        if (form.password) payload.password = form.password;
        await updateUser(user.id, payload);
      } else {
        await createUser({ email: form.email.trim().toLowerCase(), displayName: form.displayName.trim(), role: form.role as 'ADMIN' | 'STORE_KEEPER', password: form.password });
      }
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? (e.body.messageEn ?? (e.body.code === 'VALIDATION_ERROR' ? t('users.passwordHint') : t('errors.generic'))) : t('errors.generic'));
    } finally { setSaving(false); }
  };

  const input: React.CSSProperties = { height: '36px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };
  const lbl: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '4px', display: 'block' };

  return (
    <Modal title={user ? t('users.editTitle') : t('users.add')} onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <label><span style={lbl}>{t('auth.email')} *</span><input style={{ ...input, opacity: user ? 0.6 : 1 }} dir="ltr" disabled={Boolean(user)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label><span style={lbl}>{t('users.displayName')} *</span><input style={input} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
        <label><span style={lbl}>{t('users.role')} *</span>
          <select style={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'STORE_KEEPER' })}>
            <option value="STORE_KEEPER">{t('roles.STORE_KEEPER')}</option>
            <option value="ADMIN">{t('roles.ADMIN')}</option>
          </select>
        </label>
        <label><span style={lbl}>{user ? t('users.newPassword') : t('auth.password') + ' *'}</span><input type="password" style={input} placeholder={t('users.passwordHint')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></label>
        {user && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> {t('users.active')}
          </label>
        )}
      </div>
      {error && <div role="alert" style={{ marginTop: 'var(--space-3)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
        <button type="button" onClick={onClose} style={{ height: '36px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>{t('common.cancel')}</button>
        <button type="button" onClick={submit} disabled={saving} style={{ height: '36px', padding: '0 20px', borderRadius: 'var(--radius-md)', border: 'none', background: saving ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{t('common.save')}</button>
      </div>
    </Modal>
  );
}
