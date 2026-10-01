import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NavigationRail } from './NavigationRail';
import { TopBar } from './TopBar';
import { StatusStrip } from './StatusStrip';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { AssistantLauncher } from '../features/assistant/AssistantLauncher';
import { ScanSignalOverlay } from '../design-system/scan-signal/ScanSignalOverlay';

// Rail + top bar + content + status strip (§9.7).
export function ApplicationShell() {
  const { t } = useTranslation();
  const location = useLocation();

  const TITLE_BY_PREFIX: Array<[string, string]> = [
    ['/products', 'navigation.productCatalogue'],
    ['/locations', 'navigation.storageLocations'],
    ['/stock', location.search.includes('view=history') ? 'navigation.movements' : 'navigation.scanAndMove'],
    ['/cycle-counting', 'navigation.cycleCounting'],
    ['/replenishment', 'navigation.replenishment'],
    ['/purchase-orders', 'navigation.purchaseOrders'],
    ['/suppliers', 'navigation.suppliers'],
    ['/reports', 'navigation.reports'],
    ['/audit-log', 'navigation.auditLog'],
    ['/users', 'navigation.userManagement'],
    ['/insights', 'navigation.insights'],
    ['/settings', 'navigation.settings'],
    ['/briefing', 'navigation.briefing'],
    ['/compliance', 'navigation.compliance'],
    ['/dashboard', 'navigation.dashboard'],
  ];
  const titleKey = TITLE_BY_PREFIX.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ?? 'app.name';

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--canvas)' }}>
      <NavigationRail />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <TopBar title={t(titleKey)} />
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--space-6)',
          }}
        >
          {/* Keyed on the path so each navigation replays the entry sequence. */}
          <div key={location.pathname} className="page-enter" style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
        <StatusStrip />
      </div>
      <AssistantPanel />
      <AssistantLauncher />
      <ScanSignalOverlay />
    </div>
  );
}
