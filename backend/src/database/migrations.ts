import { Socle1795000000000 } from './migrations/1795000000000-Socle.js';
import { IdentityAccounts1795000100000 } from './migrations/1795000100000-IdentityAccounts.js';
import { IdentitySignIn1795000200000 } from './migrations/1795000200000-IdentitySignIn.js';
import { IdentityPasswordReset1795000300000 } from './migrations/1795000300000-IdentityPasswordReset.js';
import { OrganizationsFoundation1795085602204 } from './migrations/1795085602204-OrganizationsFoundation.js';
import { OrganizationsInvitations1795170000000 } from './migrations/1795170000000-OrganizationsInvitations.js';
import { OrganizationsInvitationAcceptance1795260000000 } from './migrations/1795260000000-OrganizationsInvitationAcceptance.js';
import { IdentityPhoneProofs1795260100000 } from './migrations/1795260100000-IdentityPhoneProofs.js';

/** Registre des migrations, dans l'ordre. `pnpm --filter api migration:create <Nom>` y ajoute la nouvelle. */
export const MIGRATIONS: Function[] = [
  Socle1795000000000,
  IdentityAccounts1795000100000,
  IdentitySignIn1795000200000,
  IdentityPasswordReset1795000300000,
  OrganizationsFoundation1795085602204,
  OrganizationsInvitations1795170000000,
  OrganizationsInvitationAcceptance1795260000000,
  IdentityPhoneProofs1795260100000,
];
