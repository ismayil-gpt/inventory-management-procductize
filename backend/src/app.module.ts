import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { SystemModule } from './modules/system/system.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { UsersModule } from './modules/users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductCategoriesModule } from './modules/product-categories/product-categories.module';
import { StorageLocationsModule } from './modules/storage-locations/storage-locations.module';
import { StockMovementsModule } from './modules/stock-movements/stock-movements.module';
import { BarcodeLabelsModule } from './modules/barcode-labels/barcode-labels.module';
import { ReferenceDataModule } from './modules/reference-data/reference-data.module';
import { EmailModule } from './email/email.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ReplenishmentModule } from './modules/replenishment/replenishment.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CycleCountingModule } from './modules/cycle-counting/cycle-counting.module';
import { AssistantModule } from './modules/assistant/assistant.module';

/**
 * Root module. Feature modules are added here as capabilities land (§3.2).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Local .env first, then the shared development env at the repo root.
      envFilePath: ['.env', '../.env.development'],
    }),
    PrismaModule,
    HealthModule,
    SystemModule,
    OrganizationModule,
    AuthenticationModule,
    UsersModule,
    DashboardModule,
    ProductsModule,
    ProductCategoriesModule,
    StorageLocationsModule,
    StockMovementsModule,
    BarcodeLabelsModule,
    ReferenceDataModule,
    EmailModule,
    SuppliersModule,
    ReplenishmentModule,
    PurchaseOrdersModule,
    AuditLogModule,
    ReportsModule,
    CycleCountingModule,
    AssistantModule,
  ],
})
export class AppModule {}
