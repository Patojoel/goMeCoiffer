// Outils communs aux hooks : lecture du JSON reçu sur stdin, refus motivé, racine du projet.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export async function readHookInput() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Code 2 : Claude Code bloque l'appel d'outil et transmet le message à l'agent.
export function block(reason) {
  process.stderr.write(`[garde-fou GoMeCoiffer] ${reason}\n`);
  process.exit(2);
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

export function toPosix(p) {
  return p.replace(/\\/g, '/');
}

export function relativeToProject(input, filePath) {
  const root = projectDir(input);
  const abs = path.isAbsolute(filePath) ? filePath : path.join(input.cwd || root, filePath);
  return toPosix(path.relative(root, abs));
}

export function isTrackedByGit(root, relPath) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', relPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// .env, .env.local, .env.production… sont des secrets ; .env.example / .env.sample sont des modèles commités.
export function isSecretEnvFile(p) {
  const base = path.basename(toPosix(p));
  return /^\.env(\..+)?$/.test(base) && !/^\.env\.(example|sample|template)$/.test(base);
}
