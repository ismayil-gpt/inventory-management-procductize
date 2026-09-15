import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  MapPin,
  ArrowLeftRight,
  ClipboardCheck,
  Sparkles,
  Truck,
  BarChart3,
  ScrollText,
  Users,
  Settings,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useSystemInfo } from '../api-client/client';
import { usePreferences } from './preferences.store';

// Fixed navigation rail (§9.7) — stays visible, not a hamburger menu.
const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'navigation.dashboard', Icon: LayoutDashboard },
  { to: '/products', labelKey: 'navigation.productCatalogue', Icon: Package },
  { to: '/locations', labelKey: 'navigation.storageLocations', Icon: MapPin },
  { to: '/stock', labelKey: 'navigation.stockMovements', Icon: ArrowLeftRight },
  { to: '/cycle-counting', labelKey: 'navigation.cycleCounting', Icon: ClipboardCheck },
  { to: '/replenishment', labelKey: 'navigation.replenishment', Icon: Sparkles },
  { to: '/suppliers', labelKey: 'navigation.suppliers', Icon: Truck },
  { to: '/reports', labelKey: 'navigation.reports', Icon: BarChart3 },
  { to: '/audit-log', labelKey: 'navigation.auditLog', Icon: ScrollText },
  { to: '/users', labelKey: 'navigation.userManagement', Icon: Users },
  { to: '/settings', labelKey: 'navigation.settings', Icon: Settings },
] as const;

export function NavigationRail() {
  const { t } = useTranslation();
  const info = useSystemInfo();
  const { language } = usePreferences();
  const orgName = language === 'ar'
    ? info.data?.organizationNameAr ?? info.data?.organizationName
    : info.data?.organizationName ?? info.data?.organizationNameAr;
  const demoLogins = info.data?.demoLogins ?? [];
  const [showDemo, setShowDemo] = useState(false);

  return (
    <nav
      aria-label="Primary"
      style={{
        width: 'var(--rail-width)',
        background: 'var(--surface)',
        borderInlineEnd: '1px solid var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: 'var(--space-3) var(--space-2)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '4px 10px var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo/mizan-mark.svg" alt="" width={26} height={26} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--primary)',
              fontSize: '18px',
            }}
          >
            MIZAN
          </span>
        </div>
        {orgName && (
          <span
            style={{
              fontSize: 'var(--text-2xs)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              paddingInlineStart: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={orgName}
          >
            {orgName}
          </span>
        )}
      </div>

      {NAV_ITEMS.map(({ to, labelKey, Icon }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '9px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: isActive ? 'var(--primary)' : 'var(--ink-muted)',
            background: isActive ? 'var(--primary-soft)' : 'transparent',
            borderInlineStart: isActive ? '2px solid var(--primary)' : '2px solid transparent',
            textDecoration: 'none',
          })}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}

      {/* Demo-login helper (development only — the backend omits this in production). */}
      {demoLogins.length > 0 && (
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            aria-expanded={showDemo}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '8px 10px', borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--hairline-strong)', background: 'transparent',
              color: 'var(--ink-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer',
            }}
          >
            <KeyRound size={15} strokeWidth={1.5} aria-hidden />
            <span style={{ flex: 1, textAlign: 'start' }}>{t('settings.demoLogins')}</span>
            {showDemo ? <EyeOff size={14} strokeWidth={1.5} aria-hidden /> : <Eye size={14} strokeWidth={1.5} aria-hidden />}
          </button>

          {showDemo && (
            <div style={{ marginTop: '6px', padding: '10px', background: 'var(--surface-sunken)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {demoLogins.map((login) => (
                <div key={login.role}>
                  <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '2px' }}>
                    {t(`roles.${login.role}`, login.role)}
                  </div>
                  <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)', wordBreak: 'break-all' }}>{login.email}</div>
                  <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink)', wordBreak: 'break-all' }}>{login.password}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
