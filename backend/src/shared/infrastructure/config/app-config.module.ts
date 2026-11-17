import { type DynamicModule, Global, Module } from '@nestjs/common';
import { type Env, parseEnv } from './env.schema.js';

export const APP_CONFIG = Symbol('APP_CONFIG');
export type AppConfig = Env;

/** Configuration validée une fois au démarrage, injectée par le token APP_CONFIG. */
@Global()
@Module({})
export class AppConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  return parseEnv(source);
}
