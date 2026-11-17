#!/usr/bin/env node
// PreToolUse (Read|Write|Edit|MultiEdit|NotebookEdit|Grep) : protège les secrets et les migrations commitées.
import { block, isSecretEnvFile, isTrackedByGit, projectDir, readHookInput, relativeToProject } from './lib.mjs';

const input = await readHookInput();
const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};
const target = args.file_path ?? args.notebook_path ?? args.path ?? '';

if (!target) process.exit(0);

if (isSecretEnvFile(target)) {
  block(
    `${target} contient des secrets : aucun agent ne le lit ni ne l'écrit. ` +
      `Modifier backend/.env.example (placeholders) et le schéma Zod de config ; le user reporte la valeur réelle lui-même.`,
  );
}

const rel = relativeToProject(input, target);
const isMigration = /^backend\/src\/database\/migrations\/[^/]+\.ts$/.test(rel);
const writes = ['Write', 'Edit', 'MultiEdit'].includes(tool);

if (writes && isMigration && isTrackedByGit(projectDir(input), rel)) {
  block(
    `${rel} est une migration déjà commitée : elle ne se modifie jamais. ` +
      `Créer une nouvelle migration (pnpm --filter api migration:create|generate) et l'ajouter à docs/migrations-history.md.`,
  );
}

process.exit(0);
