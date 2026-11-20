import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { SseRealtimePublisher } from '../../infrastructure/realtime/sse-realtime.publisher.js';
import type { AfterCommit } from '../../application/after-commit.js';
import {
  openAuthenticatedSession,
  openClientSession,
  regenerateSessionOnSalon,
} from '../../infrastructure/security/authenticated-session.js';
import { RotationSafePgStore } from '../../infrastructure/security/rotation-safe-session-store.js';
import {
  StaffSignInRequiredError,
  UnauthenticatedError,
} from '../../infrastructure/security/security-errors.js';

/** Requête fabriquée à la main : `regenerate` vide la session, `save` ne fait rien ; le magasin dit si la ligne existait. */
const requestWith = (stillStored: boolean, data: Record<string, unknown> = {}) => {
  const store = Object.assign(Object.create(RotationSafePgStore.prototype), {
    consume: async () => stillStored,
  });
  const session: Record<string, unknown> = {
    ...data,
    regenerate(done: () => void) {
      for (const key of Object.keys(this)) if (typeof this[key] !== 'function') delete this[key];
      done();
    },
    save: (done: () => void) => done(),
  };
  return { session, sessionID: 'S1', sessionStore: store } as unknown as Request;
};
const SIGNED_IN = { userId: 'u1', credentialsVersion: 2, authenticatedAt: 1, lastActivityAt: 2 };

describe('Rotating the session of a signed-in user', () => {
  it('refuses to issue a new session when the old one was already destroyed', async () => {
    const req = requestWith(false, SIGNED_IN);

    await expect(regenerateSessionOnSalon(req, 'salon-1')).rejects.toThrow(UnauthenticatedError);
    expect([req.session.activeSalonId, req.session.freshlyIssued]).toEqual([undefined, undefined]);
  });

  it('issues the new session when the old one was still stored, keeping the sign-in facts', async () => {
    const req = requestWith(true, SIGNED_IN);

    await regenerateSessionOnSalon(req, 'salon-1');

    expect(req.session).toMatchObject({ ...SIGNED_IN, activeSalonId: 'salon-1' });
  });

  it('forgets the issuing mark once the session is saved, so a later write cannot create it again', async () => {
    const rotated = requestWith(true, SIGNED_IN);
    const signedIn = requestWith(false);

    await regenerateSessionOnSalon(rotated, 'salon-1');
    await openAuthenticatedSession(signedIn, { userId: 'u1', credentialsVersion: 1 }, new Date(0));

    expect(rotated.session.freshlyIssued).toBeUndefined();
    expect(signedIn.session.freshlyIssued).toBeUndefined();
    expect(signedIn.session.userId).toBe('u1');
    expect(signedIn.session.kind).toBe('STAFF');
  });

  it('opens a client session with kind CLIENT, no active salon, and refuses to rotate a client session onto a salon', async () => {
    const req = requestWith(true);

    await openClientSession(req, { userId: 'u-client', credentialsVersion: 1 }, new Date(1000), 168);

    expect(req.session).toMatchObject({
      kind: 'CLIENT',
      userId: 'u-client',
      credentialsVersion: 1,
      authenticatedAt: 1000,
      lastActivityAt: 1000,
      activeSalonId: null,
    });
    await expect(regenerateSessionOnSalon(req, 'salon-1')).rejects.toThrow(StaffSignInRequiredError);
  });
});

describe('Closing the streams of a session', () => {
  const publisher = () =>
    new SseRealtimePublisher({ register: (f: () => void) => f() } as unknown as AfterCommit);
  const closed = (p: SseRealtimePublisher, sid: string) => {
    let hit = false;
    p.closingOfSession(sid).subscribe(() => (hit = true));
    return hit;
  };

  it('closes a stream that subscribes just after the closing, having read the session before its destruction', () => {
    const p = publisher();
    p.closeStreamsOfSession('S1');

    expect(closed(p, 'S1')).toBe(true);
  });

  it('does not close the streams of another session', () => {
    const p = publisher();
    p.closeStreamsOfSession('S1');

    expect(closed(p, 'S2')).toBe(false);
  });
});
