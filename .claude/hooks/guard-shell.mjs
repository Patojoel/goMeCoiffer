#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) : refuse les commandes qui contournent les garde-fous du projet.
import { block, readHookInput } from './lib.mjs';

const input = await readHookInput();
const cmd = String(input.tool_input?.command ?? '');
if (!cmd) process.exit(0);

// Les options git se lisent hors des chaînes citées (un message de commit peut contenir « -n »).
const unquoted = cmd.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

const rules = [
  {
    test: /\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*(\s--force(-with-lease|-if-includes)?\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+\S+)/,
    on: unquoted,
    reason: "push forcé interdit : l'historique partagé ne se réécrit pas. Demander au user s'il le faut vraiment.",
  },
  {
    test: /--no-verify\b|\bgit\b[^\n;&|]*\bcommit\b[^\n;&|]*\s-[a-zA-Z]*n[a-zA-Z]*\b/,
    on: unquoted,
    reason: 'contournement des hooks git interdit (--no-verify / -n) : corriger la cause du refus.',
  },
  {
    test: /\bschema:(sync|drop)\b|\bschema:log\b.*--?sync/,
    reason: 'typeorm schema:sync / schema:drop interdits : tout changement de schéma passe par une migration relue.',
  },
  {
    test: /\b(DB_SYNCHRONIZE|TYPEORM_SYNCHRONIZE)\s*=\s*true\b/i,
    reason: 'synchronize TypeORM interdit dans tous les profils : utiliser les migrations.',
  },
  {
    test: /(^|[\s'"/\\=:])\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?(?=$|[\s'"|;&)>])/m,
    except: /--env-file[= ]/,
    reason:
      "accès shell à un fichier .env refusé : il contient des secrets. Travailler sur backend/.env.example ; le user édite .env lui-même.",
  },
];

for (const rule of rules) {
  const subject = rule.on ?? cmd;
  if (rule.test.test(subject) && !(rule.except && rule.except.test(cmd))) block(rule.reason);
}

process.exit(0);
