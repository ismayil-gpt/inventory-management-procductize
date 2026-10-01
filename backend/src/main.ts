import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Mizan API bootstrap. Ref: CLAUDE.md §7 (API surface), §11 (DESC controls).
 * All routes are served under the /api/v1 prefix.
 */
async function bootstrap(): Promise<void> {
  // Logs are buffered until Pino is ready, so even startup lines are JSON (§4, DESC #15).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Behind nginx (production), req.ip must come from X-Forwarded-For or every
  // client would share the proxy's address — that would make rate limiting
  // (DESC #12) and the audit log's IP column meaningless. Set TRUST_PROXY to the
  // number of proxy hops (1 for nginx); leave it unset when nothing sits in front.
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) app.getHttpAdapter().getInstance().set('trust proxy', Number(trustProxy) || trustProxy);

  // DESC #13 — secure headers with a strict Content-Security-Policy. The API
  // only ever returns data (JSON, PDF, Excel), so nothing may load or run from
  // its responses. The API docs page is the one HTML page here; it gets its own
  // narrower policy, and is switched off in production (SWAGGER_ENABLED).
  const apiHeaders = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
  });
  const docsHeaders = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Swagger UI sets inline styles on its own elements.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  });
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const isSwaggerEnabled = String(config.get('SWAGGER_ENABLED', isProduction ? 'false' : 'true')) === 'true';
  app.use((req: { path: string }, res: unknown, next: () => void) =>
    (isSwaggerEnabled && req.path.startsWith('/api/v1/docs') ? docsHeaders : apiHeaders)(req as never, res as never, next),
  );

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
  if (isSwaggerEnabled) {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document);
  }

  // Locally uses API_PORT (3000). A managed host (e.g. Cloud Run) injects PORT,
  // which takes precedence when present — local behaviour is unchanged.
  const port = Number(process.env.PORT ?? config.get('API_PORT', 3000));
  await app.listen(port, '0.0.0.0');
  logger.log(`Mizan API listening on port ${port} (prefix /api/v1)`);
  if (isSwaggerEnabled) logger.log(`OpenAPI docs at /api/v1/docs`);
}

void bootstrap();
