import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Languages, Search } from 'lucide-react';
import { usePreferences } from './preferences.store';
import { useAuthStore } from '../features/authentication/auth.store';

interface TopBarProps {
  title: string;
}

// Laid out as in the approved "Airfield" demo (2026-10-01): the page's
// "you are here" sign, then search, language and theme. Sign-out lives at the
// foot of the navigation rail.
export function TopBar({ title }: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme, language, toggleLanguage } = usePreferences();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Search covers the catalogue: name, SKU or barcode, answered on the Products page.
  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : '/products');
  };

  const iconButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minWidth: '36px',
    height: '36px',
    borderRadius: 'var(--radius-md)',
    border: 'none', boxShadow: 'var(--clay-raised-sm)',
    background: 'var(--surface)',
    color: 'var(--ink-muted)',
    cursor: 'pointer',
  };

  return (
    <header
      style={{
        minHeight: '56px',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-4)',
        margin: 'var(--shell-gap) var(--shell-gap) 0',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--clay-raised)',
        flexWrap: 'wrap',
      }}
    >
      {/* "You are here" — the page title is a small location sign that swings in on each navigation. */}
      <h1
        key={title}
        className="sign-location sign-enter"
        style={{ margin: 0, fontSize: 'var(--text-base)', lineHeight: 1, padding: '9px 14px 6px', whiteSpace: 'nowrap' }}
      >
        {title}
      </h1>

      <span style={{ flex: 1 }} />

      <form role="search" onSubmit={onSearch} style={{ flex: '0 1 300px', minWidth: 0 }}>
        {/* The focus ring is drawn around the whole box (.focus-ring-within), not the bare text field. */}
        <label
          className="focus-ring-within"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '36px',
            padding: '0 12px',
            border: 'none', boxShadow: 'var(--clay-pressed)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-sunken)',
            color: 'var(--ink-muted)',
          }}
        >
          <Search size={16} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('navigation.search')}
            aria-label={t('navigation.search')}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 'var(--text-sm)' }}
          />
        </label>
      </form>

      {user && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25, paddingInline: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink)', fontWeight: 600 }}>{user.displayName}</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>{t(`roles.${user.role}`)}</span>
        </div>
      )}

      <button
        type="button"
        style={{ ...iconButton, padding: '0 10px', fontSize: 'var(--text-sm)' }}
        onClick={toggleLanguage}
        aria-label={t('common.language')}
        title={t('common.language')}
      >
        <Languages size={18} strokeWidth={1.5} aria-hidden />
        <span style={{ fontWeight: 600 }}>{language === 'ar' ? 'English' : 'العربية'}</span>
      </button>

      <button type="button" style={iconButton} onClick={toggleTheme} aria-label={t('common.theme')} title={t('common.theme')}>
        {isDark ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
      </button>
    </header>
  );
}
