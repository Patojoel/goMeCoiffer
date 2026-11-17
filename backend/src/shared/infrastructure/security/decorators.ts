import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Actor } from '../../application/ports.js';
import { UnauthenticatedError } from './security-errors.js';

export const IS_PUBLIC = 'gmc:is-public';
export const REQUIRED_PERMISSION = 'gmc:required-permission';
export const REQUIRED_SYSTEM_ROLE = 'gmc:required-system-role';
export const SKIP_CSRF = 'gmc:skip-csrf';

/** Route accessible sans session. À justifier ; sous /api/public/* ou /api/webhooks/*. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Permission salon (`module:action`), évaluée sur le salon actif de la session. */
export const RequiresPermission = (code: string) => SetMetadata(REQUIRED_PERMISSION, code);

/** Rôle système GoMeCoiffer (SUPER_ADMIN, OPERATIONS_ADMIN, FINANCE_ADMIN), pour /api/admin/*. */
export const RequiresSystemRole = (role: string) => SetMetadata(REQUIRED_SYSTEM_ROLE, role);

/** Webhooks signés uniquement : la signature remplace le CSRF. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

export type ActorRequest = Request & { actor?: Actor };

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const actor = ctx.switchToHttp().getRequest<ActorRequest>().actor;
  if (!actor) throw new UnauthenticatedError();
  return actor;
});
