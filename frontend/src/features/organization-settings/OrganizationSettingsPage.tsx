import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check } from 'lucide-react';
import { useOrganization, updateOrganization, ApiError } from '../../api-client/client';
import { useAuthStore } from '../authentication/auth.store';
import { usePreferences } from '../../application-shell/preferences.store';

// White-label settings (§5A.5, §7 PATCH /organization). Rebrand the deployment for
// a new customer here — no code change or migration. ADMIN edits; others read.
export function OrganizationSettingsPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const org = useOrganization();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [form, setForm] = useState({ nameEn: '', nameAr: '', defaultLanguage: 'en', timezone: 'Asia/Dubai' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (org.data) {
      setForm({ nameEn: org.data.nameEn, nameAr: org.data.nameAr, defaultLanguage: org.data.defaultLanguage, timezone: org.data.timezone });
    }
  }, [org.data]);

  const save = async () => {
    setError(null); setSaved(false); setSaving(true);
    try {
      await updateOrganization({
        nameEn: form.nameEn.trim(), nameAr: form.nameAr.trim(),
        defaultLanguage: form.defaultLanguage, timezone: form.timezone.trim(),
      });
      // Refresh the shell/login branding (they read the org name from /system/info).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization'] }),
        queryClient.invalidateQueries({ queryKey: ['system-info'] }),
      ]);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? (language === 'ar' ? e.body.messageAr : e.body.messageEn) ?? t('errors.generic') : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const input: React.CSSProperties = { height: '36px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)' };
  const lbl: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '4px', display: 'block' };
  const disabled = !isAdmin;

  if (org.isLoading) return <div style={{ color: 'var(--ink-muted)' }}>{t('common.loading')}</div>;
  if (org.isError || !org.data) return <div style={{ color: 'var(--critical)' }}>{t('errors.generic')}</div>;

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: 'var(--primary)' }}><Building2 size={20} strokeWidth={1.5} /></span>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>{t('settings.title')}</h2>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('settings.intro')}</p>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <span style={lbl}>{t('settings.code')}</span>
          <div style={{ ...input, display: 'flex', alignItems: 'center', background: 'var(--surface-sunken)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }} dir="ltr">{org.data.code}</div>
          <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)', marginTop: '3px' }}>{t('settings.codeHint')}</div>
        </div>

        <label><span style={lbl}>{t('settings.nameEn')} *</span>
          <input style={{ ...input, opacity: disabled ? 0.7 : 1 }} dir="ltr" disabled={disabled} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </label>
        <label><span style={lbl}>{t('settings.nameAr')} *</span>
          <input style={{ ...input, opacity: disabled ? 0.7 : 1 }} dir="rtl" disabled={disabled} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
        </label>

        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 200px' }}><span style={lbl}>{t('settings.defaultLanguage')}</span>
            <select style={{ ...input, opacity: disabled ? 0.7 : 1 }} disabled={disabled} value={form.defaultLanguage} onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <label style={{ flex: '1 1 200px' }}><span style={lbl}>{t('settings.timezone')}</span>
            <input style={{ ...input, opacity: disabled ? 0.7 : 1 }} dir="ltr" disabled={disabled} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </label>
        </div>

        {error && <div role="alert" style={{ color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}

        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={() => void save()} disabled={saving || !form.nameEn.trim() || !form.nameAr.trim()}
              style={{ height: '36px', padding: '0 20px', borderRadius: 'var(--radius-md)', border: 'none', background: saving ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
            {saved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ok)', fontSize: 'var(--text-sm)' }}><Check size={15} /> {t('settings.saved')}</span>}
          </div>
        )}
        {!isAdmin && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{t('settings.adminOnly')}</div>}
      </div>
    </div>
  );
}
