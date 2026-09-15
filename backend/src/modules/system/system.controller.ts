import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

/**
 * Deployment identity for the frontend to display (app name, org, environment).
 * Demonstrates a real configured value travelling frontend<->backend. Public
 * (used by the login screen), so it only exposes the organisation's display name.
 */
@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  @Get('info')
  @ApiOperation({ summary: 'Deployment identity and runtime info' })
  async info() {
    // Organisation NAME comes from the database (configuration, not code) so the
    // shell reads whatever name and script this deployment's organization was set up with.
    let organizationName: string | null = null;
    let organizationNameAr: string | null = null;
    try {
      const org = await this.prisma.organization.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { nameEn: true, nameAr: true },
      });
      organizationName = org?.nameEn ?? null;
      organizationNameAr = org?.nameAr ?? null;
    } catch {
      /* database not reachable — fall back to the code below */
    }

    // Demo credentials for the sidebar helper — DEVELOPMENT ONLY. Never returned
    // in production, and only when explicitly configured in the deployment's env.
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const demoLogins = isProduction
      ? []
      : [
          { role: 'ADMIN', email: this.config.get<string>('DEMO_ADMIN_EMAIL'), password: this.config.get<string>('DEMO_ADMIN_PASSWORD') },
          { role: 'STORE_KEEPER', email: this.config.get<string>('DEMO_STOREKEEPER_EMAIL'), password: this.config.get<string>('DEMO_STOREKEEPER_PASSWORD') },
        ].filter((c): c is { role: string; email: string; password: string } => Boolean(c.email && c.password));

    return {
      appName: this.config.get<string>('APP_NAME', 'Mizan'),
      organizationCode: this.config.get<string>('ORGANIZATION_CODE', 'DEMO'),
      organizationName,
      organizationNameAr,
      environment: this.config.get<string>('NODE_ENV', 'development'),
      apiVersion: 'v1',
      nodeVersion: process.version,
      serverTime: new Date().toISOString(),
      timezone: this.config.get<string>('TZ', 'Asia/Dubai'),
      demoLogins,
    };
  }
}
