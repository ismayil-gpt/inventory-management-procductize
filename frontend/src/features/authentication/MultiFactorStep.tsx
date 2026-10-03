import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import {
  verifyMultiFactorCode, startMultiFactorEnrollment, confirmMultiFactorEnrollment,
  ApiError, type MultiFactorEnrollment,
} from '../../api-client/client';
import type { Session } from './auth.store';

// Second step of sign-in when two-step sign-in is on (DESC control 7): either
// the code from the authenticator app, or — the first time — setting the app
// up from a QR code drawn by the server.
interface MultiFactorStepProps {
  mode: 'verify' | 'enroll';
  mfaToken: string;
  onSignedIn: (session: Session) => void;
  /** Back to email and password, with the reason when the step expired. */
  onRestart: (message?: string) => void;
}

export function MultiFactorStep({ mode, mfaToken, onSignedIn, onRestart }: MultiFactorStepProps) {
  const { t, i18n } = useTranslation();
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<MultiFactorEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = (err: unknown) =>
    err instanceof ApiError
      ? (i18n.language === 'ar' ? err.body.messageAr : err.body.messageEn) ?? t('errors.generic')
      : t('errors.network');

  useEffect(() => {
    if (mode !== 'enroll') return;
    startMultiFactorEnrollment(mfaToken)
      .then(setEnrollment)
      .catch((err) => (err instanceof ApiError && err.body.code === 'MFA_CHALLENGE_EXPIRED' ? onRestart(describe(err)) : setError(describe(err))));
    // Enrolment starts once per challenge.
  }, [mode, mfaToken]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t('mfa.codeFormat'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = mode === 'verify' ? await verifyMultiFactorCode(mfaToken, code) : await confirmMultiFactorEnrollment(mfaToken, code);
      onSignedIn(session);
    } catch (err) {
      if (err instanceof ApiError && (err.body.code === 'MFA_CHALLENGE_EXPIRED' || err.body.code === 'ACCOUNT_LOCKED')) {
        onRestart(describe(err));
        return;
      }
      setError(describe(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <ShieldCheck size={22} strokeWidth={1.5} aria-hidden style={{ color: 'var(--primary-ink)', flex: 'none', marginTop: '2px' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{t(mode === 'verify' ? 'mfa.verifyTitle' : 'mfa.enrollTitle')}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            {t(mode === 'verify' ? 'mfa.verifyBody' : 'mfa.enrollBody')}
          </p>
        </div>
      </div>

      {mode === 'enroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-4)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          {enrollment ? (
            <>
              {/* White quiet zone so the code scans in both themes. */}
              <img src={enrollment.qrDataUrl} alt={t('mfa.qrAlt')} width={180} height={180} style={{ background: 'var(--paper)', padding: '6px', borderRadius: 'var(--radius-sm)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{t('mfa.manualKeyLabel')}</span>
              <code dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', letterSpacing: '0.05em', userSelect: 'all', wordBreak: 'break-all', textAlign: 'center' }}>{enrollment.manualKey}</code>
            </>
          ) : (
            !error && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{t('common.loading')}</span>
          )}
        </div>
      )}

      <div>
        <label htmlFor="mfa-code" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '6px', display: 'block' }}>{t('mfa.codeLabel')}</label>
        <input
          id="mfa-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={mode === 'verify'}
          dir="ltr"
          placeholder="123456"
          aria-describedby={error ? 'mfa-error' : undefined}
          style={{ width: '100%', height: '48px', borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--clay-pressed)', background: 'var(--surface-sunken)', color: 'var(--ink)', padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '24px', letterSpacing: '0.3em', textAlign: 'center' }}
        />
      </div>

      {error && <div id="mfa-error" role="alert" className="sign-enter" style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', background: 'var(--critical-soft)', color: 'var(--critical)', fontSize: 'var(--text-xs)' }}>{error}</div>}

      <button type="submit" disabled={busy || (mode === 'enroll' && !enrollment)} style={{ height: '44px', borderRadius: 'var(--radius-md)', border: 'none', background: busy ? 'var(--ink-faint)' : 'var(--primary)', color: 'var(--on-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: busy ? 'default' : 'pointer', boxShadow: 'var(--clay-tinted)' }}>
        {busy ? t('common.loading') : t(mode === 'verify' ? 'mfa.verifyAction' : 'mfa.enrollAction')}
      </button>
      <button type="button" onClick={() => onRestart()} style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
        {t('mfa.startOver')}
      </button>
    </form>
  );
}
