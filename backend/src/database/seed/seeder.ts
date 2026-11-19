import type { DataSource } from 'typeorm';

/** Un seeder par module, idempotent (rejouable sans doublon). Ajouté avec chaque donnée affichée. */
export interface Seeder {
  readonly name: string;
  run(dataSource: DataSource): Promise<void>;
}
