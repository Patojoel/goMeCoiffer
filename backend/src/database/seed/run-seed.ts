import type { DataSource } from 'typeorm';
import dataSource from '../data-source.js';

/** Un seeder par module, idempotent (rejouable sans doublon). Ajouté avec chaque donnée affichée. */
export interface Seeder {
  readonly name: string;
  run(dataSource: DataSource): Promise<void>;
}

const SEEDERS: Seeder[] = [];

await dataSource.initialize();
try {
  if (await dataSource.showMigrations())
    throw new Error('Migrations en attente : lancez migration:run avant le seed.');
  for (const seeder of SEEDERS) {
    await seeder.run(dataSource);
    console.log(`seed : ${seeder.name}`);
  }
  if (!SEEDERS.length) console.log('Aucune donnée de démo à semer pour l’instant.');
} finally {
  await dataSource.destroy();
}
