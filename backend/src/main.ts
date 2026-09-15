import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Mizan API bootstrap. Ref: CLAUDE.md §7 (API surface), §11 (DESC controls).
 * All routes are served under the /api/v1 prefix.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // DESC #13 — secure headers. CSP is relaxed only for the Swagger UI in dev.
  app.use(helmet());

  // Frontend (Vite dev server) may call the API from another origin in dev.
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({ origin: corsOrigin.split(','), credentials: true });

  // DESC #20 — input validation at every boundary is done with Zod (nestjs-zod,
  // §4), added with the first request DTOs. No class-validator pipe here.

  // Every route lives under /api/v1 (§7).
  app.setGlobalPrefix('api/v1');

  // OpenAPI docs at /api/v1/docs (§4 — @nestjs/swagger).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mizan Inventory API')
    .setDescription('On-premise, DESC-compliant inventory management API.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document);

  // Locally uses API_PORT (3000). A managed host (e.g. Cloud Run) injects PORT,
  // which takes precedence when present — local behaviour is unchanged.
  const port = Number(process.env.PORT ?? config.get('API_PORT', 3000));
  await app.listen(port, '0.0.0.0');
  logger.log(`Mizan API listening on port ${port} (prefix /api/v1)`);
  logger.log(`OpenAPI docs at /api/v1/docs`);
}

void bootstrap();
