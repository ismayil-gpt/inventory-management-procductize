import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Typed Prisma client for the application. Connection is attempted on boot but
 * is non-fatal: if PostgreSQL is unreachable the API still starts and `/health`
 * reports `database: disconnected` (useful before the DB is provisioned).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');
  public isConnected = false;

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Connected to PostgreSQL.');
    } catch {
      this.isConnected = false;
      this.logger.warn('Database not connected — running without it.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch(() => undefined);
  }
}
