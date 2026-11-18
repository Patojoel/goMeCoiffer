import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { AppConfig } from './shared/infrastructure/config/app-config.module.js';
import { sessionMiddleware } from './shared/infrastructure/security/http-security.js';

/** Middlewares HTTP communs à main.ts et aux tests E2E ; gardes, pipe, filtre et intercepteur sont dans AppModule. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app as NestExpressApplication;
  if (config.TRUST_PROXY > 0) express.set('trust proxy', config.TRUST_PROXY);
  express.disable('x-powered-by');
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  const session = sessionMiddleware(config);
  app.use(session.middleware);
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();
  // Le pool du store de sessions vit hors du conteneur Nest : il se ferme avec l'application.
  const closeApp = app.close.bind(app);
  app.close = async () => {
    await closeApp();
    await session.close();
  };

  if (config.OPENAPI_ENABLED && config.APP_ENV !== 'prod') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('GoMeCoiffer API')
        .setVersion('0.1.0')
        .addCookieAuth(config.SESSION_COOKIE_NAME)
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
