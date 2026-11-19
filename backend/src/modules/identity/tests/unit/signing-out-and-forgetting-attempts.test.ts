import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../../test-support/fakes.js';
import { PurgeSignInAttemptsHandler } from '../../application/commands/purge-sign-in-attempts/purge-sign-in-attempts.handler.js';
import { SignOut } from '../../application/commands/sign-out/sign-out.command.js';
import { SignOutHandler } from '../../application/commands/sign-out/sign-out.handler.js';
import { InMemoryAuditTrail, InMemorySignInAttemptRepository } from '../fakes/identity-fakes.js';

const at = (time: string, day = '18') => new Date(`2026-11-${day}T${time}+01:00`);
const PAUL_ID = '0195f000-0000-7000-8000-00000000a001';

describe('Signing out', () => {
  it('traces the sign-out of the user whose session was open, without any phone number', async () => {
    const audit = new InMemoryAuditTrail();

    const result = await new SignOutHandler(audit, new FixedClock(at('10:30:00'))).execute(
      new SignOut(PAUL_ID),
    );

    expect(result).toEqual({ signedOut: true });
    expect(audit.entries).toEqual([
      {
        action: 'USER_SIGNED_OUT',
        subjectType: 'user',
        subjectId: PAUL_ID,
        actorUserId: PAUL_ID,
        occurredAt: at('10:30:00'),
      },
    ]);
  });

  it('confirms a sign-out without any open session and traces nothing', async () => {
    const audit = new InMemoryAuditTrail();

    const result = await new SignOutHandler(audit, new FixedClock(at('10:30:00'))).execute(new SignOut(null));

    expect(result).toEqual({ signedOut: true });
    expect(audit.entries).toEqual([]);
  });
});

describe('Forgetting the sign-in attempts', () => {
  const attempt = (time: string, day: string) => ({
    phone: '+237699001122',
    networkAddress: '41.202.10.1',
    at: at(time, day),
    succeeded: false,
    fromKnownDevice: false,
  });

  it('keeps the attempts of the last 48 hours and forgets older ones, to the second', async () => {
    const attempts = new InMemorySignInAttemptRepository();
    await attempts.add(attempt('09:59:59', '16'));
    await attempts.add(attempt('10:00:00', '16'));
    await attempts.add(attempt('08:00:00', '18'));
    const handler = new PurgeSignInAttemptsHandler(attempts, new FixedClock(at('10:00:00', '18')));

    const result = await handler.execute();

    expect(result).toEqual({ purged: 1 });
    expect(attempts.all().map((a) => a.at)).toEqual([at('10:00:00', '16'), at('08:00:00', '18')]);
  });

  it('can run again with nothing left to forget', async () => {
    const handler = new PurgeSignInAttemptsHandler(
      new InMemorySignInAttemptRepository(),
      new FixedClock(at('10:00:00')),
    );

    expect(await handler.execute()).toEqual({ purged: 0 });
  });
});
