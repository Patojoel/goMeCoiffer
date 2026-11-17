#!/usr/bin/env node
// SessionStart : rappelle le mode de travail et injecte la section URGENT du backlog.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { projectDir, readHookInput } from './lib.mjs';

const input = await readHookInput();
const root = projectDir(input);

function section(file, heading) {
  const p = path.join(root, file);
  if (!existsSync(p)) return '';
  const text = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const start = text.search(new RegExp(`^## ${heading}`, 'm'));
  if (start < 0) return '';
  const rest = text.slice(start);
  const end = rest.slice(3).search(/^## /m);
  return (end < 0 ? rest : rest.slice(0, end + 3)).trim();
}

function lastEvolution() {
  const p = path.join(root, 'docs/EVOLUTIONS.md');
  if (!existsSync(p)) return '';
  const m = readFileSync(p, 'utf8').match(/^### \d{4}-\d{2}-\d{2} .+$/m);
  return m ? m[0].replace(/^### /, '') : '';
}

function branch() {
  try {
    return execFileSync('git', ['-C', root, 'branch', '--show-current'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const lines = [
  'GoMeCoiffer — rappels de session (CLAUDE.md) :',
  "- Avant toute tâche de code, demander au user le mode de la session : full (revues complètes) ou light (revue sécurité seulement sur le périmètre critique).",
  '- En fin d\'évolution : entrée dans docs/EVOLUTIONS.md, mise à jour de docs/BACKLOG.md et des docs de référence touchées.',
];
const b = branch();
if (b) lines.push(`- Branche git : ${b}`);
const last = lastEvolution();
if (last) lines.push(`- Dernière évolution journalisée : ${last}`);
const urgent = section('docs/BACKLOG.md', 'URGENT');
if (urgent) lines.push('', 'Extrait de docs/BACKLOG.md, à traiter avant tout nouveau chantier :', urgent);

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } }),
);
process.exit(0);
