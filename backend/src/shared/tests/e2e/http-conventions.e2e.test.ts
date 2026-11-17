import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ACTOR_RIGHTS } from '../../application/ports.js';
import { BusinessRuleViolation, NotFoundError } from '../../domain/errors.js';
import { Public, RequiresPermission, RequiresSystemRole } from '../../infrastructure/security/decorators.js';
import { GrantedRights } from '../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

const SALON_AKWA = '0195f000-0000-7000-8000-0000000000a1';
const SALON_BASTOS = '0195f000-0000-7000-8000-0000000000b2';
const MANAGER = '0195f000-0000-7000-8000-000000000001';
const HAIRDRESSER = '0195f000-0000-7000-8000-000000000002';
const PLATFORM_ADMIN = '0195f000-0000-7000-8000-000000000003';

class SalonClosedError extends BusinessRuleViolation {
  readonly code = 'SALON_CLOSED';
  constructor() {
    super('Le salon est fermé ce jour-là : choisissez une autre date.');
  }
}

const SignInSchema = z.object({ userId: z.uuid(), activeSalonId: z.uuid().nullable() }).strict();
const ServiceSchema = z
  .object({ name: z.string().min(2), priceXaf: z.number().int().nonnegative() })
  .strict();

/** Routes de démonstration propres au test : la connexion réelle arrive avec le module des comptes. */
@Controller('probe')
class ProbeController {
  @Public()
  @Post('sign-in')
  signIn(@Body({ schema: SignInSchema }) body: z.infer<typeof SignInSchema>, @Req() req: Request) {
    req.session.userId = body.userId;
    req.session.activeSalonId = body.activeSalonId;
    return null;
  }

  @Public()
  @Post('services')
  createService(@Body({ schema: ServiceSchema }) body: z.infer<typeof ServiceSchema>) {
    return body;
  }

  @Public()
  @Get('closed-salon')
  closedSalon() {
    throw new SalonClosedError();
  }

  @Public()
  @Get('missing')
  missing() {
    throw new NotFoundError('Réservation 42 du salon Bastos');
  }

  @Public()
  @Get('crash')
  crash() {
    throw new Error('connection to 10.0.0.5 failed for user gomecoiffer');
  }

  @Get('bookings')
  @RequiresPermission('bookings:read-all')
  bookings() {
    return { bookings: [] };
  }

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
    t = await startTestApp({ controllers: [ProbeController], overrides: [[ACTOR_RIGHTS, rights]] });
  });
  afterAll(() => t.close());

  it('answers the health check in the standard envelope, with security headers', async () => {
    const res = await t.browser().get('/api/public/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK', data: { status: 'ok', database: 'up' } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuses a protected route to a visitor without session', async () => {
    const res = await t.browser().get('/api/probe/bookings');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('refuses a write without the CSRF token, even on a public route', async () => {
    const res = await t
      .browser()
      .agent.post('/api/probe/services')
      .send({ name: 'Coupe homme', priceXaf: 2000 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it('accepts a write that carries the CSRF token of its session', async () => {
    const res = await t.browser().post('/api/probe/services', { name: 'Coupe homme', priceXaf: 2000 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'OK', data: { name: 'Coupe homme', priceXaf: 2000 } });
  });

  it('lists every field to correct when the input breaks the contract, unknown fields included', async () => {
    const res = await t
      .browser()
      .post('/api/probe/services', { name: 'C', priceXaf: 10.5, salonId: SALON_BASTOS });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['', 'name', 'priceXaf']);
  });

  it('answers a refused business rule with its stable code and a readable message', async () => {
    const res = await t.browser().get('/api/probe/closed-salon');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      status: 'ERROR',
      code: 'SALON_CLOSED',
      message: 'Le salon est fermé ce jour-là : choisissez une autre date.',
    });
  });

  it('does not reveal what was looked for when a resource is missing or belongs to another salon', async () => {
    const res = await t.browser().get('/api/probe/missing');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Ressource introuvable.');
  });

  it('hides technical details of an unexpected failure', async () => {
    const res = await t.browser().get('/api/probe/crash');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it.each([
    [
      'a hairdresser without the permission in the active salon',
      HAIRDRESSER,
      SALON_AKWA,
      '/api/probe/bookings',
      403,
    ],
    ['a manager working on another salon', MANAGER, SALON_BASTOS, '/api/probe/bookings', 403],
    ['a manager who has not chosen a salon yet', MANAGER, null, '/api/probe/bookings', 403],
    ['a salon manager on the platform administration', MANAGER, SALON_AKWA, '/api/probe/platform', 403],
    ['a manager with the permission in the active salon', MANAGER, SALON_AKWA, '/api/probe/bookings', 200],
    ['a GoMeCoiffer super administrator', PLATFORM_ADMIN, null, '/api/probe/platform', 200],
  ])('%s gets %s → %s → %s', async (_who, userId, activeSalonId, path, expected) => {
    const browser = t.browser();
    expect((await browser.post('/api/probe/sign-in', { userId, activeSalonId })).status).toBe(201);
    const res = await browser.get(path);
    expect(res.status).toBe(expected);
  });
});
