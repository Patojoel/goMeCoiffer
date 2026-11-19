import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import {
  ACTOR_RIGHTS,
  type Actor,
  type ActorRights,
  CLOCK,
  type Clock,
  READ_DB,
  type SqlReader,
} from '../../application/ports.js';
import { sql } from '../../application/sql.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.module.js';
import { CSRF_PROTECTION, type CsrfProtection } from './http-security.js';
import {
  type ActorRequest,
  IS_PUBLIC,
  REQUIRED_PERMISSION,
  REQUIRED_SYSTEM_ROLE,
  SKIP_CSRF,
} from './decorators.js';
import { CsrfInvalidError, ForbiddenError, UnauthenticatedError } from './security-errors.js';

const HOUR_MS = 3_600_000;
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
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (flag(this.reflector, IS_PUBLIC, ctx)) return true;
    const req = ctx.switchToHttp().getRequest<ActorRequest>();
    const userId = req.session?.userId;
    if (!userId) throw new UnauthenticatedError();

    // Durée absolue depuis la connexion : l'expiration glissante seule laisserait vivre un cookie volé.
    const now = this.clock.now().getTime();
    const authenticatedAt = req.session.authenticatedAt ?? 0;
    if (now - authenticatedAt > this.config.SESSION_MAX_AGE_HOURS * HOUR_MS) await this.endSession(req);

    let activeSalonId = req.session.activeSalonId ?? null;
    const { isMember, permissions, systemRoles, credentialsVersion } = await this.rights.resolve(
      userId,
      activeSalonId,
    );
    // Réinitialisation du mot de passe : toute session ouverte avec d'anciens identifiants est refusée, même une
    // session réécrite en fin de requête après sa suppression.
    if (credentialsVersion === null || credentialsVersion !== (req.session.credentialsVersion ?? 1))
      await this.endSession(req);
    if (systemRoles.length > 0) await this.enforceSystemRoleDurations(req, now, authenticatedAt);
    if (activeSalonId && !isMember) {
      req.session.activeSalonId = null;
      activeSalonId = null;
    }
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

  /** Session d'un utilisateur portant un rôle système : 2 h sans activité et 12 h après la connexion (D-026). */
  private async enforceSystemRoleDurations(
    req: ActorRequest,
    now: number,
    authenticatedAt: number,
  ): Promise<void> {
    const lastActivityAt = req.session.lastActivityAt ?? authenticatedAt;
    if (
      now - authenticatedAt > this.config.SYSTEM_SESSION_MAX_AGE_HOURS * HOUR_MS ||
      now - lastActivityAt > this.config.SYSTEM_SESSION_TTL_HOURS * HOUR_MS
    )
      await this.endSession(req);
    req.session.lastActivityAt = now;
  }

  private async endSession(req: ActorRequest): Promise<never> {
    await new Promise<void>((done) => req.session.destroy(() => done()));
    throw new UnauthenticatedError();
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

/** Remplacé par le module des comptes (lot 1) : d'ici là, aucun droit n'est accordé, mais la version des identifiants est lue. */
@Injectable()
export class NoRightsYet implements ActorRights {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async resolve(userId: string) {
    const account = await this.db.maybeOne<{ credentialsVersion: number }>(sql`
      SELECT u.credentials_version AS "credentialsVersion" FROM users u WHERE u.id = ${userId}`);
    return {
      isMember: false,
      permissions: [],
      systemRoles: [],
      credentialsVersion: account?.credentialsVersion ?? null,
    };
  }
}
