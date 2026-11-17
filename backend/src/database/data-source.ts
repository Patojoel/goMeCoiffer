import { DataSource } from 'typeorm';
import { loadConfig } from '../shared/infrastructure/config/app-config.module.js';
import { dataSourceOptions } from '../shared/infrastructure/database/typeorm-options.js';
import { loadLocalEnvFile } from './load-env.js';

/** DataSource de la CLI TypeORM (`migration:generate`) et du script `cli.ts`. */
loadLocalEnvFile();
export default new DataSource(dataSourceOptions(loadConfig()));
