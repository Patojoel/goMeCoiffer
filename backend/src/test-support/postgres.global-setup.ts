import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';
import { MIGRATIONS } from '../database/migrations.js';

export interface PgTestServer {
  host: string;
  port: number;
  user: string;
  password: string;
  templateDatabase: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    pg: PgTestServer;
  }
}

const TEMPLATE = 'gmc_template';

/** Un PostgreSQL 17 par projet de tests ; base modèle posée par les vraies migrations, clonée par fichier. */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:17')
    .withPassword('gomecoiffer-test-only')
    .start();
  const server: PgTestServer = {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    templateDatabase: TEMPLATE,
  };

  const admin = new pg.Client({ ...server, database: container.getDatabase() });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE}`);
  await admin.end();

  const migrator = new DataSource({
    type: 'postgres',
    host: server.host,
    port: server.port,
    username: server.user,
    password: server.password,
    database: TEMPLATE,
    migrations: MIGRATIONS,
  });
  await migrator.initialize();
  await migrator.runMigrations({ transaction: 'each' });
  await migrator.destroy();

  project.provide('pg', server);
  return async () => {
    await container.stop();
  };
}
