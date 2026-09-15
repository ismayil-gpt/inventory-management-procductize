import { Routes, Route, Navigate } from 'react-router-dom';
import { ApplicationShell } from './application-shell/ApplicationShell';
import { PlaceholderPage } from './application-shell/PlaceholderPage';
import { LoginPage } from './features/authentication/LoginPage';
import { RequireAuth } from './features/authentication/RequireAuth';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProductsPage } from './features/product-catalogue/ProductsPage';
import { ProductDetailPage } from './features/product-catalogue/ProductDetailPage';
import { LocationsPage } from './features/storage-locations/LocationsPage';
import { StockMovementsPage } from './features/stock-movements/StockMovementsPage';
import { ReplenishmentPage } from './features/replenishment/ReplenishmentPage';
import { SuppliersPage } from './features/suppliers/SuppliersPage';
import { CycleCountPage } from './features/cycle-counting/CycleCountPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AuditLogPage } from './features/audit-log/AuditLogPage';
import { UsersPage } from './features/user-management/UsersPage';
import { OrganizationSettingsPage } from './features/organization-settings/OrganizationSettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <ApplicationShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/stock" element={<StockMovementsPage />} />
        <Route path="/cycle-counting" element={<CycleCountPage />} />
        <Route path="/replenishment" element={<ReplenishmentPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<OrganizationSettingsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
