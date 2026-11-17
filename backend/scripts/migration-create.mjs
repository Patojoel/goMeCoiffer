#!/usr/bin/env node
// Crée une migration écrite à la main et l'ajoute au registre src/database/migrations.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const name = process.argv[2]?.split(/[\\/]/).pop();
if (!name || !/^[A-Z][A-Za-z0-9]+$/.test(name)) {
  console.error('Usage : pnpm --filter api migration:create <NomEnPascalCase>');
  process.exit(1);
}

const ts = Date.now();
const className = `${name}${ts}`;
const file = `${ts}-${name}`;
const root = path.resolve(import.meta.dirname, '..', 'src', 'database');

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
const source = readFileSync(registry, 'utf8')
  .replace(/(\nexport const MIGRATIONS)/, `import { ${className} } from './migrations/${file}.js';\n$1`)
  .replace(/\];\s*$/, `, ${className}];\n`);
writeFileSync(registry, source);
console.log(
  `Créée : src/database/migrations/${file}.ts (ajoutée au registre). Ajoutez une ligne à docs/migrations-history.md.`,
);
