import { Socle1795000000000 } from './migrations/1795000000000-Socle.js';
import { IdentityAccounts1795000100000 } from './migrations/1795000100000-IdentityAccounts.js';
import { IdentitySignIn1795000200000 } from './migrations/1795000200000-IdentitySignIn.js';

/** Registre des migrations, dans l'ordre. `pnpm --filter api migration:create <Nom>` y ajoute la nouvelle. */
export const MIGRATIONS: Function[] = [
  Socle1795000000000,
  IdentityAccounts1795000100000,
  IdentitySignIn1795000200000,
];
