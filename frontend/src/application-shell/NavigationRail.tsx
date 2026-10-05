import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sunrise,
  Building2,
  LayoutDashboard,
  ScanBarcode,
  ArrowLeftRight,
  ClipboardCheck,
  Package,
  Warehouse,
  ListChecks,
  FileText,
  Truck,
  Activity,
  FileSpreadsheet,
  MessageSquare,
  ShieldCheck,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { logoutRequest, useRecommendations, useSystemInfo } from '../api-client/client';
import { usePreferences } from './preferences.store';
import { useAuthStore } from '../features/authentication/auth.store';
import { useAssistantUi } from '../features/assistant/assistant.store';
import { MizanMark } from '../design-system/brand-mark/MizanMark';

// Fixed navigation rail (§9.7) — stays visible, never a hamburger. Grouped and
// worded as in the approved "Airfield" demo (2026-10-01).
interface RailLink {
  kind: 'link';
  key: string;
  to: string;
  labelKey: string;
  Icon: LucideIcon;
  /** The active check sees the query string so Scan and move / Movements can share /stock. */
  isActive: (pathname: string, search: string) => boolean;
  /** Hidden from roles the backend refuses (users and audit log are ADMIN-only APIs). */
  isAdminOnly?: boolean;
}
interface RailAction {
  kind: 'assistant';
  key: string;
  labelKey: string;
  Icon: LucideIcon;
}
type RailItem = RailLink | RailAction;

const startsWith = (prefix: string) => (pathname: string) => pathname.startsWith(prefix);
const link = (key: string, to: string, labelKey: string, Icon: LucideIcon, extra: Partial<RailLink> = {}): RailLink => ({
  kind: 'link', key, to, labelKey, Icon, isActive: startsWith(to), ...extra,
});

const NAV_GROUPS: Array<{ labelKey: string; items: RailItem[] }> = [
  {
    labelKey: 'navigation.groupOperate',
    items: [
      link('briefing', '/briefing', 'navigation.briefing', Sunrise),
      link('dashboard', '/dashboard', 'navigation.dashboard', LayoutDashboard),
      link('scan', '/stock', 'navigation.scanAndMove', ScanBarcode, {
        isActive: (p, s) => p.startsWith('/stock') && !s.includes('view=history'),
      }),
      link('movements', '/stock?view=history', 'navigation.movements', ArrowLeftRight, {
        isActive: (p, s) => p.startsWith('/stock') && s.includes('view=history'),
      }),
      link('counts', '/cycle-counting', 'navigation.cycleCounting', ClipboardCheck),
    ],
  },
  {
    labelKey: 'navigation.groupStock',
    items: [
      link('products', '/products', 'navigation.productCatalogue', Package),
      link('locations', '/locations', 'navigation.storageLocations', Warehouse),
    ],
  },
  {
    labelKey: 'navigation.groupPurchasing',
    items: [
      link('replenishment', '/replenishment', 'navigation.replenishment', ListChecks),
      link('orders', '/purchase-orders', 'navigation.purchaseOrders', FileText),
      link('suppliers', '/suppliers', 'navigation.suppliers', Truck),
    ],
  },
  {
    labelKey: 'navigation.groupAnalyse',
    items: [
      link('insights', '/insights', 'navigation.insights', Activity),
      link('reports', '/reports', 'navigation.reports', FileSpreadsheet),
      { kind: 'assistant', key: 'assistant', labelKey: 'navigation.assistant', Icon: MessageSquare },
    ],
  },
  {
    labelKey: 'navigation.groupAdminister',
    items: [
      link('audit', '/audit-log', 'navigation.auditLog', ShieldCheck, { isAdminOnly: true }),
      link('users', '/users', 'navigation.userManagement', Users, { isAdminOnly: true }),
      link('compliance', '/compliance', 'navigation.compliance', Building2, { isAdminOnly: true }),
      link('settings', '/settings', 'navigation.settings', Settings, { isAdminOnly: true }),
    ],
  },
];

const COLLAPSE_STORAGE_KEY = 'mizan.railCollapsed';
// §9.7 — on tablets (768–1024px) the rail collapses to icons on its own.
const NARROW_QUERY = '(max-width: 1024px)';

function readStoredCollapse(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = () => setIsNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isNarrow;
}

export function NavigationRail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const info = useSystemInfo();
  const { language } = usePreferences();
  const user = useAuthStore((s) => s.user);
  const openAssistant = useAssistantUi((s) => s.open);
  const isAssistantOpen = useAssistantUi((s) => s.isOpen);
  const pending = useRecommendations('PENDING');
  const pendingCount = pending.data?.length ?? 0;

  const orgName = language === 'ar'
    ? info.data?.organizationNameAr ?? info.data?.organizationName
    : info.data?.organizationName ?? info.data?.organizationNameAr;
  const demoLogins = info.data?.demoLogins ?? [];
  const [showDemo, setShowDemo] = useState(false);

  const isNarrow = useIsNarrow();
  const [isUserCollapsed, setIsUserCollapsed] = useState(readStoredCollapse);
  const isCollapsed = isUserCollapsed || isNarrow;
  const toggleCollapse = () => {
    const next = !isUserCollapsed;
    setIsUserCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Storage can be unavailable (private mode); the rail still toggles for this session.
    }
  };

  const onLogout = async () => {
    await logoutRequest();
    navigate('/login');
  };

  // The active item is a location sign that slides between links rather than
  // jumping, so the eye follows where you went (§9.9, expanded 2026-10-01).
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    setIndicator(active ? { top: active.offsetTop, height: active.offsetHeight } : null);
  }, [location.pathname, location.search, orgName, isCollapsed, user?.role, language]);

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    gap: '12px',
    width: '100%',
    minHeight: '36px',
    padding: isCollapsed ? '0' : '0 12px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'transparent',
    fontSize: 'var(--text-sm)',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--sign-legend)' : 'var(--ink-muted)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    textAlign: 'start',
  });

  const footButton: React.CSSProperties = {
    ...itemStyle(false),
    fontSize: 'var(--text-sm)',
  };

  return (
    <nav
      aria-label="Primary"
      ref={navRef}
      style={{
        position: 'relative',
        width: isCollapsed ? 'var(--rail-width-collapsed)' : 'var(--rail-width)',
        flex: 'none',
        // A raised clay slab floating on the ground, like the top bar and status strip.
        margin: 'var(--shell-gap)',
        marginInlineEnd: 0,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--clay-raised)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-3) var(--space-2) 0',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width var(--motion-medium) var(--motion-easing)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: isCollapsed ? '4px 0 var(--space-3)' : '4px 10px var(--space-3)', alignItems: isCollapsed ? 'center' : 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MizanMark size={30} title={isCollapsed ? 'Mizan' : undefined} />
          {!isCollapsed && (
            <span style={{ fontFamily: 'var(--font-sign)', fontWeight: 600, letterSpacing: '0.01em', color: 'var(--ink)', fontSize: '20px', lineHeight: 1, paddingTop: '3px' }}>
              Mizan
            </span>
          )}
        </div>
        {orgName && !isCollapsed && (
          <span
            style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--ink-muted)', paddingInlineStart: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={orgName}
          >
            {orgName}
          </span>
        )}
      </div>

      {indicator && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            insetInline: 'var(--space-2)',
            top: indicator.top,
            height: indicator.height,
            background: 'var(--sign)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--clay-tinted)',
            transition: 'top var(--motion-medium) var(--motion-settle), height var(--motion-medium) var(--motion-settle)',
            pointerEvents: 'none',
          }}
        />
      )}

      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => item.kind !== 'link' || !item.isAdminOnly || user?.role === 'ADMIN');
        if (items.length === 0) return null;
        return (
          <div key={group.labelKey} role="group" aria-label={t(group.labelKey)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {isCollapsed ? (
              <div aria-hidden style={{ height: '1px', background: 'var(--hairline)', margin: 'var(--space-2) 10px' }} />
            ) : (
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: 'var(--ink-faint)', padding: '8px 12px 2px', whiteSpace: 'nowrap' }}>
                {t(group.labelKey)}
              </div>
            )}
            {items.map((item) => {
              const label = t(item.labelKey);
              if (item.kind === 'assistant') {
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="rail-link"
                    onClick={openAssistant}
                    aria-pressed={isAssistantOpen}
                    title={isCollapsed ? label : undefined}
                    aria-label={isCollapsed ? label : undefined}
                    style={itemStyle(false)}
                  >
                    <item.Icon size={18} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
                    {!isCollapsed && <span>{label}</span>}
                  </button>
                );
              }
              const isActive = item.isActive(location.pathname, location.search);
              const showCount = item.key === 'replenishment' && pendingCount > 0;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={isActive ? 'rail-link active' : 'rail-link'}
                  data-active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  title={isCollapsed ? label : undefined}
                  aria-label={isCollapsed ? label : undefined}
                  style={itemStyle(isActive)}
                >
                  <item.Icon size={18} strokeWidth={1.5} aria-hidden style={{ flex: 'none' }} />
                  {!isCollapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
                  {showCount && (
                    <span
                      className="tabular"
                      title={t('navigation.pendingApprovals', { count: pendingCount })}
                      style={{
                        ...(isCollapsed ? { position: 'absolute', top: '4px', insetInlineEnd: '4px', fontSize: '10px', padding: '0 4px' } : { fontSize: 'var(--text-xs)', padding: '0 6px' }),
                        fontWeight: 600,
                        lineHeight: '18px',
                        borderRadius: 'var(--radius-chip)',
                        boxShadow: 'var(--clay-tinted)',
                        // On the yellow active sign the count flips to ink so it stays visible.
                        background: isActive ? 'var(--sign-legend)' : 'var(--sign-go)',
                        color: isActive ? 'var(--sign)' : 'var(--sign-on-go)',
                      }}
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}

      {/* Pinned to the bottom so collapse and sign out stay reachable when the list scrolls. */}
      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '2px', position: 'sticky', bottom: 0, paddingBottom: 'var(--space-3)', background: 'var(--surface)', borderEndStartRadius: 'var(--radius-panel)', borderEndEndRadius: 'var(--radius-panel)', zIndex: 1 }}>
        {/* Demo-login helper (development only — the backend omits this in production). */}
        {demoLogins.length > 0 && showDemo && !isCollapsed && (
          <div style={{ marginBottom: 'var(--space-2)', padding: '10px', background: 'var(--surface-sunken)', border: 'none', boxShadow: 'var(--clay-raised)', borderRadius: 'var(--radius-panel)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

        <div aria-hidden style={{ height: '1px', background: 'var(--hairline)', margin: '0 4px var(--space-2)' }} />
        {/* One row when expanded (collapse · demo logins · sign out) so the rail fits a 900px screen. */}
        <div style={{ display: 'flex', flexDirection: isCollapsed ? 'column' : 'row', gap: '2px' }}>
          {!isNarrow && (
            <button
              type="button"
              className="rail-link"
              onClick={toggleCollapse}
              aria-label={t(isCollapsed ? 'navigation.expand' : 'navigation.collapse')}
              title={t(isCollapsed ? 'navigation.expand' : 'navigation.collapse')}
              style={{ ...footButton, width: isCollapsed ? '100%' : '36px', padding: 0, justifyContent: 'center', flex: 'none' }}
            >
              {/* Panel icons point along the reading direction, so they mirror in RTL. */}
              {isCollapsed
                ? <PanelLeftOpen size={18} strokeWidth={1.5} aria-hidden style={{ transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />
                : <PanelLeftClose size={18} strokeWidth={1.5} aria-hidden style={{ transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />}
            </button>
          )}
          {demoLogins.length > 0 && !isCollapsed && (
            <button
              type="button"
              className="rail-link"
              onClick={() => setShowDemo((v) => !v)}
              aria-expanded={showDemo}
              aria-label={t('settings.demoLogins')}
              title={t('settings.demoLogins')}
              style={{ ...footButton, width: '36px', padding: 0, justifyContent: 'center', flex: 'none' }}
            >
              <KeyRound size={17} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="rail-link"
            onClick={() => void onLogout()}
            aria-label={isCollapsed ? t('common.logout') : undefined}
            title={isCollapsed ? t('common.logout') : undefined}
            style={{ ...footButton, flex: 1 }}
          >
            <LogOut size={18} strokeWidth={1.5} aria-hidden style={{ flex: 'none', transform: language === 'ar' ? 'scaleX(-1)' : undefined }} />
            {!isCollapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
}
