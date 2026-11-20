import { Injectable, type PipeTransform } from '@nestjs/common';
import { type SystemRole, SystemRoleSchema } from '@gomecoiffer/contracts';
import { RequestValidationError } from '../../../../../shared/infrastructure/security/security-errors.js';

/** Valide le rôle de chemin `:role` de `/api/admin/platform-roles/:userId/:role` (RG-012-02). */
@Injectable()
export class ParseSystemRolePipe implements PipeTransform<string, SystemRole> {
  transform(value: string): SystemRole {
    const parsed = SystemRoleSchema.safeParse(value);
    if (!parsed.success) {
      throw new RequestValidationError([
        { path: 'role', message: parsed.error.issues[0]?.message ?? 'Choisissez un rôle système valide.' },
      ]);
    }
    return parsed.data;
  }
}

