import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from '../../../database/entities.js';
import { MIGRATIONS } from '../../../database/migrations.js';
import type { AppConfig } from '../config/app-config.module.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

/** Même configuration pour l'application, la CLI de migration et les tests. Jamais de synchronize. */
export function dataSourceOptions(config: AppConfig): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    username: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    extra: { max: config.DB_POOL_MAX },
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    migrationsRun: false,
    synchronize: false,
    dropSchema: false,
    namingStrategy: new SnakeNamingStrategy(),
    logging: config.DB_LOGGING ? ['query', 'error'] : ['error'],
  };
}
