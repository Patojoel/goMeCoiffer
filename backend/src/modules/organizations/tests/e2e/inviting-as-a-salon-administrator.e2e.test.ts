import { describe, it } from 'vitest';

/** T28, à écrire avec UC-008 : les permissions par défaut des rôles n'existent pas encore (RG-006-04, D-042). */
describe('A salon administrator invites only to a role that has no more rights than his own', () => {
  it.todo('lets a salon administrator invite a hairdresser (@apres-UC-008)');
  it.todo('refuses a finance manager role to a salon administrator with ROLE_ABOVE_INVITER (@apres-UC-008)');
});
