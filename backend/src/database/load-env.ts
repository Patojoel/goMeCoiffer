import { existsSync } from 'node:fs';

/** En local, charge backend/.env ; les variables déjà posées (serveur, CI) ne sont jamais écrasées. */
export function loadLocalEnvFile(path = '.env'): void {
  if (existsSync(path)) process.loadEnvFile(path);
}
