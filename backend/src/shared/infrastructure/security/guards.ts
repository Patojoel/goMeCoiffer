import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { ACTOR_RIGHTS, type Actor, type ActorRights } from '../../application/ports.js';
import { CSRF_PROTECTION, type CsrfProtection } from './http-security.js';
import {
  type ActorRequest,
  IS_PUBLIC,
  REQUIRED_PERMISSION,
  REQUIRED_SYSTEM_ROLE,
  SKIP_CSRF,
} from './decorators.js';
import { CsrfInvalidError, ForbiddenError, UnauthenticatedError } from './security-errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const ACTOR_KEY = 'actor';

const flag = (reflector: Reflector, key: string, ctx: ExecutionContext) =>
  reflector.getAllAndOverride<unknown>(key, [ctx.getHandler(), ctx.getClass()]);

/** Toute écriture porte un jeton CSRF valide, routes publiques comprises (sauf webhooks signés). */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<ActorRequest>();
    if (SAFE_METHODS.has(req.method) || flag(this.reflector, SKIP_CSRF, ctx)) return true;
    if (!this.csrf.validateRequest(req)) throw new CsrfInvalidError();
    return true;
  }
}

/** Deny-by-default : sans @Public(), une session authentifiée est exigée et l'acteur est résolu côté serveur. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    @Inject(ACTOR_RIGHTS) private readonly rights: ActorRights,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (flag(this.reflector, IS_PUBLIC, ctx)) return true;
    const req = ctx.switchToHttp().getRequest<ActorRequest>();
    const userId = req.session?.userId;
    if (!userId) throw new UnauthenticatedError();
    const activeSalonId = req.session.activeSalonId ?? null;
    const { permissions, systemRoles } = await this.rights.resolve(userId, activeSalonId);
    const actor: Actor = {
      userId,
      activeSalonId,
      permissions: new Set(activeSalonId ? permissions : []),
      systemRoles: new Set(systemRoles),
    };
    req.actor = actor;
    this.cls.set(ACTOR_KEY, actor);
    return true;
  }
}

/** Permission salon sur le salon actif, rôle système pour l'administration : deux mondes séparés. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const permission = flag(this.reflector, REQUIRED_PERMISSION, ctx) as string | undefined;
    const systemRole = flag(this.reflector, REQUIRED_SYSTEM_ROLE, ctx) as string | undefined;
    if (!permission && !systemRole) return true;
    const actor = ctx.switchToHttp().getRequest<ActorRequest>().actor;
    if (!actor) throw new UnauthenticatedError();
    if (permission && !(actor.activeSalonId && actor.permissions.has(permission))) {
      throw new ForbiddenError(
        actor.activeSalonId
          ? 'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.'
          : 'Choisissez d’abord le salon sur lequel vous travaillez.',
      );
    }
    if (systemRole && !actor.systemRoles.has(systemRole))
      throw new ForbiddenError('Action réservée à l’équipe GoMeCoiffer.');
    return true;
  }
}

/** Remplacé par le module des comptes (lot 1) : d'ici là, aucun droit n'est accordé. */
@Injectable()
export class NoRightsYet implements ActorRights {
  async resolve() {
    return { permissions: [], systemRoles: [] };
  }
}
