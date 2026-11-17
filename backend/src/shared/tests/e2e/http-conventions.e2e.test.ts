import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ACTOR_RIGHTS, type Actor } from '../../application/ports.js';
import { BusinessRuleViolation, NotFoundError } from '../../domain/errors.js';
import {
  AuthenticatedOnly,
  CurrentActor,
  Public,
  RequiresPermission,
  RequiresSystemRole,
  SkipCsrf,
} from '../../infrastructure/security/decorators.js';
import { GrantedRights } from '../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

const SALON_AKWA = '0195f000-0000-7000-8000-0000000000a1';
const SALON_BASTOS = '0195f000-0000-7000-8000-0000000000b2';
const MANAGER = '0195f000-0000-7000-8000-000000000001';
const HAIRDRESSER = '0195f000-0000-7000-8000-000000000002';
const PLATFORM_ADMIN = '0195f000-0000-7000-8000-000000000003';
const DAY_MS = 86_400_000;

class SalonClosedError extends BusinessRuleViolation {
  readonly code = 'SALON_CLOSED';
  constructor() {
    super('Le salon est fermé ce jour-là : choisissez une autre date.');
  }
}

const SignInSchema = z
  .object({
    userId: z.uuid(),
    activeSalonId: z.uuid().nullable(),
    authenticatedAt: z.iso.datetime().optional(),
  })
  .strict();
const ServiceSchema = z
  .object({ name: z.string().min(2), priceXaf: z.number().int().nonnegative() })
  .strict();

/** Routes propres au test : la vraie connexion arrive avec le module des comptes (lot 1). */
@Controller('public/probe')
@Public()
class PublicProbeController {
  @Post('sign-in')
  signIn(@Body({ schema: SignInSchema }) body: z.infer<typeof SignInSchema>, @Req() req: Request) {
    req.session.userId = body.userId;
    req.session.activeSalonId = body.activeSalonId;
    req.session.authenticatedAt = body.authenticatedAt ? Date.parse(body.authenticatedAt) : Date.now();
    return null;
  }

  @Post('services')
  createService(@Body({ schema: ServiceSchema }) body: z.infer<typeof ServiceSchema>) {
    return body;
  }

  @Get('closed-salon')
  closedSalon() {
    throw new SalonClosedError();
  }

  @Get('missing')
  missing() {
    throw new NotFoundError('Réservation 42 du salon Bastos');
  }

  @Get('crash')
  crash() {
    throw new Error('connection to 10.0.0.5 failed for user gomecoiffer');
  }
}

@Controller('salon/probe')
class SalonProbeController {
  @Get('bookings')
  @RequiresPermission('bookings:read-all')
  bookings() {
    return { bookings: [] };
  }

  @Get('whoami')
  @AuthenticatedOnly()
  whoami(@CurrentActor() actor: Actor) {
    return { activeSalonId: actor.activeSalonId };
  }
}

@Controller('admin/probe')
class AdminProbeController {
  @Get('platform')
  @RequiresSystemRole('SUPER_ADMIN')
  platform() {
    return { ok: true };
  }
}

describe('HTTP conventions of the API', () => {
  let t: TestApp;

  beforeAll(async () => {
    const rights = new GrantedRights(
      {
        [MANAGER]: { [SALON_AKWA]: ['bookings:read-all'] },
        [HAIRDRESSER]: { [SALON_AKWA]: ['bookings:read-own'] },
      },
      { [PLATFORM_ADMIN]: ['SUPER_ADMIN'] },
    );
    t = await startTestApp({
      controllers: [PublicProbeController, SalonProbeController, AdminProbeController],
      overrides: [[ACTOR_RIGHTS, rights]],
    });
  });
  afterAll(() => t.close());

  const signedIn = async (userId: string, activeSalonId: string | null, authenticatedAt?: string) => {
    const browser = t.browser();
    expect(
      (await browser.post('/api/public/probe/sign-in', { userId, activeSalonId, authenticatedAt })).status,
    ).toBe(201);
    return browser;
  };

  it('answers the health check in the standard envelope, with security headers', async () => {
    const res = await t.browser().get('/api/public/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK', data: { status: 'ok', database: 'up' } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuses a protected route to a visitor without session', async () => {
    const res = await t.browser().get('/api/salon/probe/bookings');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('refuses a write without the CSRF token, even on a public route', async () => {
    const res = await t
      .browser()
      .agent.post('/api/public/probe/services')
      .send({ name: 'Coupe homme', priceXaf: 2000 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it('accepts a write that carries the CSRF token of its session', async () => {
    const res = await t.browser().post('/api/public/probe/services', { name: 'Coupe homme', priceXaf: 2000 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'OK', data: { name: 'Coupe homme', priceXaf: 2000 } });
  });

  it('lists every field to correct when the input breaks the contract, unknown fields included', async () => {
    const res = await t
      .browser()
      .post('/api/public/probe/services', { name: 'C', priceXaf: 10.5, salonId: SALON_BASTOS });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['', 'name', 'priceXaf']);
  });

  it('answers a refused business rule with its stable code and a readable message', async () => {
    const res = await t.browser().get('/api/public/probe/closed-salon');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      status: 'ERROR',
      code: 'SALON_CLOSED',
      message: 'Le salon est fermé ce jour-là : choisissez une autre date.',
    });
  });

  it('does not reveal what was looked for when a resource is missing or belongs to another salon', async () => {
    const res = await t.browser().get('/api/public/probe/missing');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Ressource introuvable.');
  });

  it('hides technical details of an unexpected failure', async () => {
    const res = await t.browser().get('/api/public/probe/crash');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it.each([
    [
      'a hairdresser without the permission in the active salon',
      HAIRDRESSER,
      SALON_AKWA,
      '/api/salon/probe/bookings',
      403,
    ],
    [
      'a manager working on a salon he does not belong to',
      MANAGER,
      SALON_BASTOS,
      '/api/salon/probe/bookings',
      403,
    ],
    ['a manager who has not chosen a salon yet', MANAGER, null, '/api/salon/probe/bookings', 403],
    ['a salon manager on the platform administration', MANAGER, SALON_AKWA, '/api/admin/probe/platform', 403],
    [
      'a manager with the permission in the active salon',
      MANAGER,
      SALON_AKWA,
      '/api/salon/probe/bookings',
      200,
    ],
    ['a GoMeCoiffer super administrator', PLATFORM_ADMIN, null, '/api/admin/probe/platform', 200],
  ])('%s gets %s → %s → %s', async (_who, userId, activeSalonId, path, expected) => {
    const browser = await signedIn(userId, activeSalonId);
    expect((await browser.get(path)).status).toBe(expected);
  });

  it('forgets an active salon the user no longer belongs to', async () => {
    const browser = await signedIn(MANAGER, SALON_BASTOS);
    expect((await browser.get('/api/salon/probe/whoami')).body.data).toEqual({ activeSalonId: null });
  });

  it('ends a session past its absolute lifetime, even if it was used recently', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * DAY_MS).toISOString();
    const browser = await signedIn(MANAGER, SALON_AKWA, fourDaysAgo);
    expect((await browser.get('/api/salon/probe/bookings')).status).toBe(401);
    expect((await browser.get('/api/salon/probe/whoami')).status).toBe(401);
  });
});

@Controller('admin/leaky')
class AdminRouteWithoutRole {
  @Get()
  list() {
    return [];
  }
}

@Controller('salon/leaky')
class SalonRouteWithoutPermission {
  @Get()
  list() {
    return [];
  }
}

@Controller('bookings')
@Public()
class PublicRouteOutsidePublicSpace {
  @Get()
  list() {
    return [];
  }
}

@Controller('public/leaky')
@Public()
class CsrfSkippedOutsideWebhooks {
  @Post()
  @SkipCsrf()
  write() {
    return null;
  }
}

describe('Routes declared with a missing protection', () => {
  it.each([
    ['an administration route without system role', AdminRouteWithoutRole, /admin\/leaky/],
    ['a salon route without permission', SalonRouteWithoutPermission, /salon\/leaky/],
    ['a public route outside /api/public', PublicRouteOutsidePublicSpace, /bookings/],
    ['a write without CSRF outside /api/webhooks', CsrfSkippedOutsideWebhooks, /public\/leaky/],
  ])('prevent the API from starting: %s', async (_why, controller, route) => {
    await expect(startTestApp({ controllers: [controller] })).rejects.toThrow(route);
  });
});
