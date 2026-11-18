import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ClsService } from 'nestjs-cls';
import { describe, expect, it } from 'vitest';
import { FixedClock, GrantedRights } from '../../../test-support/fakes.js';
import type { AppConfig } from '../../infrastructure/config/app-config.module.js';
import { AuthGuard } from '../../infrastructure/security/guards.js';
import { UnauthenticatedError } from '../../infrastructure/security/security-errors.js';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const NOW = new Date('2026-11-18T10:00:00+01:00');
const USER = '0195f000-0000-7000-8000-00000000a001';
const config = {
  SESSION_MAX_AGE_HOURS: 168,
  SYSTEM_SESSION_TTL_HOURS: 2,
  SYSTEM_SESSION_MAX_AGE_HOURS: 12,
} as AppConfig;

interface FakeSession {
  userId: string;
  authenticatedAt: number;
  lastActivityAt?: number;
  activeSalonId: string | null;
  destroyed: boolean;
  destroy(done: () => void): void;
}

/** Une session ouverte à `signedInAgo` du maintenant, dont la dernière activité date de `idleFor`. */
function sessionOf(signedInAgoMs: number, idleForMs?: number): FakeSession {
  return {
    userId: USER,
    authenticatedAt: NOW.getTime() - signedInAgoMs,
    ...(idleForMs === undefined ? {} : { lastActivityAt: NOW.getTime() - idleForMs }),
    activeSalonId: null,
    destroyed: false,
    destroy(done) {
      this.destroyed = true;
      done();
    },
  };
}

async function enter(session: FakeSession, systemRoles: string[] = []) {
  const request = { method: 'GET', session };
  const context = {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new AuthGuard(
    new Reflector(),
    { set() {} } as unknown as ClsService,
    new GrantedRights({}, { [USER]: systemRoles }),
    new FixedClock(NOW),
    config,
  );
  return guard.canActivate(context);
}

describe('Session duration of a staff member', () => {
  it.each([
    [167 * HOUR_MS + 59 * MINUTE_MS, true],
    [168 * HOUR_MS + MINUTE_MS, false],
  ])('after a sign-in %d ms ago, access is granted: %s', async (signedInAgo, granted) => {
    const session = sessionOf(signedInAgo);

    if (granted) expect(await enter(session)).toBe(true);
    else await expect(enter(session)).rejects.toThrow(UnauthenticatedError);
  });

  it('is not shortened by the system-role limits when the user has no system role', async () => {
    expect(await enter(sessionOf(13 * HOUR_MS, 3 * HOUR_MS))).toBe(true);
  });
});

describe('Session duration of a GoMeCoiffer administrator', () => {
  const ADMIN = ['OPERATIONS_ADMIN'];

  it.each([
    [1 * HOUR_MS + 59 * MINUTE_MS, true],
    [2 * HOUR_MS + MINUTE_MS, false],
  ])('after %d ms without activity, access is granted: %s', async (idleFor, granted) => {
    const session = sessionOf(3 * HOUR_MS, idleFor);

    if (granted) expect(await enter(session, ADMIN)).toBe(true);
    else {
      await expect(enter(session, ADMIN)).rejects.toThrow(UnauthenticatedError);
      expect(session.destroyed).toBe(true);
    }
  });

  it('counts the idle time from the sign-in when nothing was done since', async () => {
    await expect(enter(sessionOf(2 * HOUR_MS + MINUTE_MS), ADMIN)).rejects.toThrow(UnauthenticatedError);
    expect(await enter(sessionOf(1 * HOUR_MS + 59 * MINUTE_MS), ADMIN)).toBe(true);
  });

  it.each([
    [11 * HOUR_MS + 59 * MINUTE_MS, true],
    [12 * HOUR_MS + MINUTE_MS, false],
  ])(
    'ends 12 hours after the sign-in, even when active: signed in %d ms ago, granted: %s',
    async (signedInAgo, granted) => {
      const session = sessionOf(signedInAgo, MINUTE_MS);

      if (granted) expect(await enter(session, ADMIN)).toBe(true);
      else await expect(enter(session, ADMIN)).rejects.toThrow(UnauthenticatedError);
    },
  );

  it('records the activity, so that the next idle period starts from now', async () => {
    const session = sessionOf(3 * HOUR_MS, 1 * HOUR_MS);

    await enter(session, ADMIN);

    expect(session.lastActivityAt).toBe(NOW.getTime());
  });
});
