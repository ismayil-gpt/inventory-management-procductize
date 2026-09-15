import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

/**
 * Liveness/readiness probe. Ref: docker-compose healthcheck + §13.1.
 * Intentionally has no auth so the frontend status strip can poll it.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Service health and dependency status' })
  check() {
    return {
      status: 'ok',
      service: 'mizan-backend',
      version: '0.1.0',
      environment: process.env.NODE_ENV ?? 'development',
      database: this.prisma.isConnected ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
