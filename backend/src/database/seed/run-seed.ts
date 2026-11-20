import { loadConfig } from '../../shared/infrastructure/config/app-config.module.js';
import dataSource from '../data-source.js';
import { identitySeeder } from './identity.seed.js';
import { organizationsSeeder } from './organizations.seed.js';
import { platformSeeder } from './platform.seed.js';
import { seedRefusal } from './seed-guard.js';
import type { Seeder } from './seeder.js';

/** Dans l'ordre des dépendances : les comptes avant les organisations. */
const SEEDERS: Seeder[] = [identitySeeder, organizationsSeeder, platformSeeder];

const refusedBy = seedRefusal(loadConfig());
if (refusedBy)
  throw new Error(
    `Seed de démonstration refusé (condition : ${refusedBy}) : il crée des comptes au mot de passe connu.`,
  );

await dataSource.initialize();
try {
  if (await dataSource.showMigrations())
    throw new Error('Migrations en attente : lancez migration:run avant le seed.');
  for (const seeder of SEEDERS) {
    await seeder.run(dataSource);
    console.log(`seed : ${seeder.name}`);
  }
} finally {
  await dataSource.destroy();
}
