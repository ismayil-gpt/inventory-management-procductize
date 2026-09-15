import { FormEvent, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from './auth.store';
import { loginRequest, useSystemInfo, ApiError } from '../../api-client/client';

// Real JWT login (§11 #3-5). argon2id verification + lockout are enforced server-side.
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toggleLanguage, language } = usePreferences();
  const { setSession } = useAuthStore();
  const currentUser = useAuthStore((s) => s.user);
  const info = useSystemInfo();
  const orgName = language === 'ar'
    ? info.data?.organizationNameAr ?? info.data?.organizationName
    : info.data?.organizationName ?? info.data?.organizationNameAr;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await loginRequest(email.trim().toLowerCase(), password);
      setSession(session);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.body.code === 'ACCOUNT_LOCKED') {
          setError(t('auth.accountLocked', { minutes: err.body.lockedMinutes ?? 15 }));
        } else if (err.body.code === 'INVALID_CREDENTIALS') {
          setError(t('auth.invalidCredentials'));
        } else {
          setError((language === 'ar' ? err.body.messageAr : err.body.messageEn) ?? t('errors.generic'));
        }
      } else {
        setError(t('errors.network'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const field: React.CSSProperties = {
    height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)',
    background: 'var(--surface)', color: 'var(--ink)', padding: '0 12px', fontSize: 'var(--text-sm)', width: '100%',
  };
  const label: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '6px', display: 'block' };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--canvas)', padding: 'var(--space-6)' }}>
      <div style={{ width: '360px', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-6)' }}>
          <img src="/logo/mizan-mark.svg" alt="Mizan" width={48} height={48} />
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.1em', fontSize: 'var(--text-xl)', color: 'var(--primary)' }}>MIZAN</div>
          <div style={{ height: '2px', width: '64px', background: 'var(--gold)' }} />
          <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{t('app.tagline')}</div>
          {orgName && (
            <div style={{ marginTop: '2px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>{orgName}</div>
          )}
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={label} htmlFor="email">{t('auth.email')}</label>
            <input id="email" type="email" required style={field} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="username" />
          </div>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={label} htmlFor="password">{t('auth.password')}</label>
            <input id="password" type="password" required style={field} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>

          {error && (
            <div role="alert" style={{ marginBottom: 'var(--space-4)', padding: '9px 12px', borderRadius: 'var(--radius-md)', background: 'var(--critical-soft)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            width: '100%', height: '40px', borderRadius: 'var(--radius-md)', border: 'none',
            background: submitting ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)',
            fontWeight: 500, fontSize: 'var(--text-sm)', cursor: submitting ? 'default' : 'pointer',
          }}>
            {submitting ? t('common.loading') : t('auth.signIn')}
          </button>
        </form>

        <button type="button" onClick={toggleLanguage} style={{ marginTop: 'var(--space-3)', background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', width: '100%' }}>
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
    </div>
  );
}
