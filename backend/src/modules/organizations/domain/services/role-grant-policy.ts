import type { SalonRole } from '../enums/salon-role.enum.js';
import { RoleAboveInviterError } from '../exceptions/role-above-inviter.error.js';
import { permissionsOfRole } from './permissions-of-role.js';

/**
 * Pas d'élévation de droits (D-042, RG-006-04) : on ne donne qu'un rôle dont toutes les permissions sont aussi les
 * siennes dans ce salon. Les permissions des rôles prédéfinis seront fixées par UC-008.
 */
export class RoleGrantPolicy {
  constructor(
    private readonly permissionsOf: (role: SalonRole) => readonly string[] = (role) =>
      permissionsOfRole(role, false),
  ) {}

  assertCanGrant(authorPermissions: readonly string[], role: SalonRole): void {
    const held = new Set(authorPermissions);
    if (this.permissionsOf(role).some((permission) => !held.has(permission)))
      throw new RoleAboveInviterError();
  }
}
