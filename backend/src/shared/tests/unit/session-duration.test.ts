import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ClsService } from 'nestjs-cls';
import { describe, expect, it } from 'vitest';
import { FixedClock, GrantedRights } from '../../../test-support/fakes.js';
import type { AppConfig } from '../../infrastructure/config/app-config.module.js';
import {
  AuthenticatedOnly,
  ClientArea,
  RequiresPermission,
  RequiresSystemRole,
} from '../../infrastructure/security/decorators.js';
import { AuthGuard } from '../../infrastructure/security/guards.js';
import {
  StaffSignInRequiredError,
  UnauthenticatedError,
} from '../../infrastructure/security/security-errors.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const NOW = new Date('2026-11-20T10:00:00+01:00');
const USER = '0195f000-0000-7000-8000-00000000a001';
const config = {
  SESSION_MAX_AGE_HOURS: 168,
  SYSTEM_SESSION_TTL_HOURS: 2,
  SYSTEM_SESSION_MAX_AGE_HOURS: 12,
  CLIENT_SESSION_TTL_HOURS: 168,
  CLIENT_SESSION_MAX_AGE_HOURS: 720,
} as AppConfig;

interface FakeSession {
  kind?: 'STAFF' | 'CLIENT';
  userId: string;
  credentialsVersion?: number;
  authenticatedAt: number;
  lastActivityAt?: number;
  activeSalonId: string | null;
  destroyed: boolean;
  destroy(done: () => void): void;
}

/** Une session ouverte à `signedInAgo` du maintenant, dont la dernière activité date de `idleFor`. */
function sessionOf(
  signedInAgoMs: number,
  idleForMs?: number,
  kind?: 'STAFF' | 'CLIENT',
  credentialsVersion = 1,
): FakeSession {
  return {
    ...(kind === undefined ? {} : { kind }),
    userId: USER,
    credentialsVersion,
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

class ProbeController {
  @AuthenticatedOnly()
  salonAuthenticated() {}

  @RequiresPermission('bookings:manage')
  salonPermission() {}

  @RequiresSystemRole('SUPER_ADMIN')
  adminRoute() {}

  @ClientArea()
  clientArea() {}
}

async function enter(
  session: FakeSession,
  systemRoles: string[] = [],
  handler: keyof ProbeController = 'salonAuthenticated',
  accountCredentialsVersion: number | null = 1,
) {
  const request = { method: 'GET', session };
  const context = {
    getHandler: () => ProbeController.prototype[handler],
    getClass: () => ProbeController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const rights = new GrantedRights({}, { [USER]: systemRoles });
  if (accountCredentialsVersion === null) rights.forgetAccount(USER);
  else rights.setCredentialsVersion(USER, accountCredentialsVersion);
  const guard = new AuthGuard(
    new Reflector(),
    { set() {} } as unknown as ClsService,
    rights,
    new FixedClock(NOW),
    config,
  );
  return guard.canActivate(context);
}

describe('Separation between the client area and the salon or platform spaces (D-055)', () => {
  it.each([
    ['an @AuthenticatedOnly() salon route', 'salonAuthenticated'],
    ['a @RequiresPermission() salon route', 'salonPermission'],
    ['a @RequiresSystemRole() administration route', 'adminRoute'],
  ] as const)('refuses a CLIENT session on %s with STAFF_SIGN_IN_REQUIRED', async (_label, route) => {
    const session = sessionOf(MINUTE_MS, MINUTE_MS, 'CLIENT');

    await expect(enter(session, [], route)).rejects.toThrow(StaffSignInRequiredError);
    expect(session.destroyed).toBe(false);
  });

  it('grants a CLIENT session access to a @ClientArea() route and records its activity', async () => {
    const session = sessionOf(2 * HOUR_MS, HOUR_MS, 'CLIENT');

    expect(await enter(session, [], 'clientArea')).toBe(true);
    expect(session.lastActivityAt).toBe(NOW.getTime());
  });

  it('grants a STAFF session access to a @ClientArea() route without requiring an SMS code (RG-009-09)', async () => {
    const session = sessionOf(HOUR_MS, undefined, 'STAFF');

    expect(await enter(session, [], 'clientArea')).toBe(true);
  });

  it('ends a CLIENT session when the account password was reset (credentialsVersion incremented, RG-009-13)', async () => {
    const session = sessionOf(MINUTE_MS, MINUTE_MS, 'CLIENT', 1);

    await expect(enter(session, [], 'clientArea', 2)).rejects.toThrow(UnauthenticatedError);
    expect(session.destroyed).toBe(true);
  });
});

describe('Session duration of a marketplace client (RG-009-11)', () => {
  it.each([
    ['6 days 23 h 59 min idle (27/11 at 09:59)', 7 * DAY_MS - MINUTE_MS, undefined, true],
    ['7 days 1 min idle (27/11 at 10:01)', 7 * DAY_MS + MINUTE_MS, undefined, false],
    ['29 days 23 h 59 min after verification when active daily (20/12 at 09:59)', 30 * DAY_MS - MINUTE_MS, HOUR_MS, true],
    ['30 days 1 min after verification even when active daily (20/12 at 10:01)', 30 * DAY_MS + MINUTE_MS, HOUR_MS, false],
  ])('%s → access granted: %s', async (_case, verifiedAgo, idleFor, granted) => {
    const session = sessionOf(verifiedAgo, idleFor, 'CLIENT');

    if (granted) expect(await enter(session, [], 'clientArea')).toBe(true);
    else {
      await expect(enter(session, [], 'clientArea')).rejects.toThrow(UnauthenticatedError);
      expect(session.destroyed).toBe(true);
    }
  });
});

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
