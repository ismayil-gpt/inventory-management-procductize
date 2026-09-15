import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NavigationRail } from './NavigationRail';
import { TopBar } from './TopBar';
import { StatusStrip } from './StatusStrip';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { AssistantLauncher } from '../features/assistant/AssistantLauncher';

// Rail + top bar + content + status strip (§9.7).
export function ApplicationShell() {
  const { t } = useTranslation();
  const location = useLocation();

  const TITLE_BY_PREFIX: Array<[string, string]> = [
    ['/products', 'navigation.productCatalogue'],
    ['/locations', 'navigation.storageLocations'],
    ['/stock', 'navigation.stockMovements'],
    ['/cycle-counting', 'navigation.cycleCounting'],
    ['/replenishment', 'navigation.replenishment'],
    ['/suppliers', 'navigation.suppliers'],
    ['/reports', 'navigation.reports'],
    ['/audit-log', 'navigation.auditLog'],
    ['/users', 'navigation.userManagement'],
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
          <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
        <StatusStrip />
      </div>
      <AssistantPanel />
      <AssistantLauncher />
    </div>
  );
}
