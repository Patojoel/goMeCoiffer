import { Injectable, type PipeTransform } from '@nestjs/common';
import { type AdjustableSalonRole, AdjustableSalonRoleSchema } from '@gomecoiffer/contracts';
import { RequestValidationError } from '../../../../../shared/infrastructure/security/security-errors.js';

/** Valide le rôle de chemin `:role` de `/api/salon/roles/:role/permissions` (RG-008-03). */
@Injectable()
export class ParseAdjustableSalonRolePipe implements PipeTransform<string, AdjustableSalonRole> {
  transform(value: string): AdjustableSalonRole {
    const parsed = AdjustableSalonRoleSchema.safeParse(value);
    if (!parsed.success) {
      throw new RequestValidationError([
        { path: 'role', message: parsed.error.issues[0]?.message ?? 'Choisissez un des rôles proposés.' },
      ]);
    }
    return parsed.data;
  }
}

