import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Languages, LogOut } from 'lucide-react';
import { usePreferences } from './preferences.store';
import { useAuthStore } from '../features/authentication/auth.store';
import { logoutRequest } from '../api-client/client';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme, language, toggleLanguage } = usePreferences();
  const user = useAuthStore((s) => s.user);

  const onLogout = async () => {
    await logoutRequest();
    navigate('/login');
  };
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const iconButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--hairline)',
    background: 'var(--surface)',
    color: 'var(--ink-muted)',
    cursor: 'pointer',
  };

  return (
    <header
      style={{
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: '0 var(--space-6)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)' }}>
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button type="button" style={iconButton} onClick={toggleTheme} aria-label={t('common.theme')} title={t('common.theme')}>
          {isDark ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
        </button>

        <button
          type="button"
          style={{ ...iconButton, width: 'auto', gap: '6px', padding: '0 12px', fontSize: 'var(--text-sm)' }}
          onClick={toggleLanguage}
          aria-label={t('common.language')}
          title={t('common.language')}
        >
          <Languages size={18} strokeWidth={1.5} />
          <span style={{ fontWeight: 500 }}>{language === 'ar' ? 'العربية' : 'EN'}</span>
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--hairline)' }} />

        {user && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: language === 'ar' ? 'flex-start' : 'flex-end', lineHeight: 1.2 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink)', fontWeight: 500 }}>{user.displayName}</span>
            <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
              {t(`roles.${user.role}`)}
            </span>
          </div>
        )}

        <button type="button" style={iconButton} onClick={onLogout} aria-label={t('common.logout')} title={t('common.logout')}>
          <LogOut size={18} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
