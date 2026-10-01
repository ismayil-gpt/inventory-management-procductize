import { FormEvent, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../application-shell/preferences.store';
import { useAuthStore } from './auth.store';
import { loginRequest, useSystemInfo, ApiError } from '../../api-client/client';
import { MizanMark } from '../../design-system/brand-mark/MizanMark';
import { SplitFlapText } from '../../design-system/airfield-signs/SplitFlapText';

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

  if (currentUser) return <Navigate to="/briefing" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await loginRequest(email.trim().toLowerCase(), password);
      setSession(session);
      navigate('/briefing');
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
      <div className="float-enter" style={{ width: '380px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Arrival gantry: the mark beside a location sign whose legend flaps into place. */}
        <div style={{ background: 'var(--gantry)', border: '1px solid var(--gantry-line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <MizanMark size={60} title="Mizan" />
            <div dir="ltr" className="sign-location sign-enter" style={{ flex: 1, fontSize: '36px', lineHeight: 1, padding: '12px 16px 8px', textAlign: 'center', letterSpacing: 'var(--tracking-designator)' }}>
              <SplitFlapText text="MIZAN" startDelayMs={180} />
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--gantry-line)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--gantry-muted)' }}>
            <span>{t('app.tagline')}</span>
            {orgName && <span style={{ color: 'var(--gantry-ink)', fontWeight: 600, textAlign: 'end' }}>{orgName}</span>}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>

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
            <div role="alert" className="sign-enter" style={{ marginBottom: 'var(--space-4)', padding: '9px 12px', borderRadius: 'var(--radius-md)', background: 'var(--critical-soft)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            width: '100%', height: '44px', fontWeight: 600, borderRadius: 'var(--radius-md)', border: 'none',
            background: submitting ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)',
            fontSize: 'var(--text-sm)', cursor: submitting ? 'default' : 'pointer',
          }}>
            {submitting ? t('common.loading') : t('auth.signIn')}
          </button>
        </form>

        <button type="button" onClick={toggleLanguage} style={{ marginTop: 'var(--space-3)', background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', width: '100%' }}>
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
        </div>
      </div>
    </div>
  );
}
