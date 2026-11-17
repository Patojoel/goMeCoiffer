import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  AUTHENTICATED_ONLY,
  IS_PUBLIC,
  REQUIRED_PERMISSION,
  REQUIRED_SYSTEM_ROLE,
  SKIP_CSRF,
} from './decorators.js';

const segments = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value ?? '']).map((p) => String(p).replace(/^\/+|\/+$/g, ''));

/**
 * Un oubli de décorateur ne doit jamais ouvrir une route : l'API refuse de démarrer si une route
 * /admin n'exige pas de rôle système, une route /salon ni permission ni @AuthenticatedOnly(),
 * un @Public() sort de /public ou /webhooks, un @SkipCsrf() sort de /webhooks, ou une route n'est dans aucun espace.
 */
@Injectable()
export class RouteProtectionCheck implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    const problems: string[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const controller = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!controller) continue;
      for (const name of this.scanner.getAllMethodNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name] as () => unknown;
        const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
        if (methodPath === undefined) continue;
        for (const base of segments(Reflect.getMetadata(PATH_METADATA, controller)))
          for (const sub of segments(methodPath)) {
            const route = [base, sub].filter(Boolean).join('/');
            const problem = this.check(route, (key) =>
              this.reflector.getAllAndOverride(key, [handler, controller]),
            );
            if (problem) problems.push(`  - /api/${route} : ${problem}`);
          }
      }
    }
    if (problems.length) throw new Error(`Routes mal protégées, démarrage refusé :\n${problems.join('\n')}`);
  }

  private check(route: string, meta: (key: string) => unknown): string | null {
    const space = route.split('/')[0];
    if (meta(SKIP_CSRF) && space !== 'webhooks') return '@SkipCsrf() réservé à /api/webhooks (webhook signé)';
    if (meta(IS_PUBLIC))
      return space === 'public' || space === 'webhooks'
        ? null
        : '@Public() hors de /api/public et /api/webhooks';
    if (space === 'admin') return meta(REQUIRED_SYSTEM_ROLE) ? null : '@RequiresSystemRole() manquant';
    if (space === 'salon')
      return meta(REQUIRED_PERMISSION) || meta(AUTHENTICATED_ONLY)
        ? null
        : '@RequiresPermission() ou @AuthenticatedOnly() manquant';
    return 'route hors des espaces /api/public, /api/salon, /api/admin, /api/webhooks';
  }
}
