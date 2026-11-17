import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_CONFIG, type AppConfig } from '../config/app-config.module.js';

/** Hors local, l'application refuse de démarrer si une migration n'est pas appliquée. */
@Injectable()
export class PendingMigrationsCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(PendingMigrationsCheck.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.dataSource.showMigrations())) return;
    if (this.config.APP_ENV === 'local') {
      this.logger.warn('Migrations en attente : lancez `pnpm --filter api migration:run`.');
      return;
    }
    throw new Error('Migrations en attente : démarrage refusé. Appliquez-les avant de déployer le code.');
  }
}
