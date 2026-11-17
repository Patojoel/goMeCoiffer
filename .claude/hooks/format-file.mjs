#!/usr/bin/env node
// PostToolUse (Write|Edit|MultiEdit) : formate le fichier écrit avec le Prettier du projet, s'il est installé.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isSecretEnvFile, projectDir, readHookInput } from './lib.mjs';

const input = await readHookInput();
const file = input.tool_input?.file_path;
if (!file || isSecretEnvFile(file) || /[\\/]node_modules[\\/]/.test(file)) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|html|ya?ml)$/.test(file)) process.exit(0);

const root = projectDir(input);
const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
if (!existsSync(bin)) process.exit(0);

try {
  execFileSync(bin, ['--write', '--log-level', 'warn', file], {
    cwd: root,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    timeout: 20_000,
  });
} catch {
  // Un échec de formatage ne bloque jamais l'écriture ; le lint le signalera.
}
process.exit(0);
