#!/usr/bin/env node
// Crée une migration écrite à la main et l'ajoute à la fin du registre src/database/migrations.ts.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const name = process.argv[2]?.split(/[\\/]/).pop();
if (!name || !/^[A-Z][A-Za-z0-9]+$/.test(name)) {
  console.error('Usage : pnpm --filter api migration:create <NomEnPascalCase>');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..', 'src', 'database');
// Toujours après la dernière migration existante : TypeORM les exécute dans l'ordre de leur horodatage.
const latest = Math.max(
  0,
  ...readdirSync(path.join(root, 'migrations'))
    .map((f) => Number(f.split('-')[0]))
    .filter(Number.isFinite),
);
const ts = Math.max(Date.now(), latest + 1);
const className = `${name}${ts}`;
const file = `${ts}-${name}`;

writeFileSync(
  path.join(root, 'migrations', `${file}.ts`),
  `import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
  name = '${className}';

  async up(q: QueryRunner): Promise<void> {
    await q.query(\`\`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(\`\`);
  }
}
`,
);

const registry = path.join(root, 'migrations.ts');
const lines = readFileSync(registry, 'utf8').split('\n');
const lastImport = lines.findLastIndex((l) => l.startsWith('import '));
lines.splice(lastImport + 1, 0, `import { ${className} } from './migrations/${file}.js';`);
const source = lines.join('\n').replace(/\];\s*$/, `, ${className}];\n`);
writeFileSync(registry, source);
console.log(
  `Créée : src/database/migrations/${file}.ts (ajoutée au registre). Ajoutez une ligne à docs/migrations-history.md.`,
);
