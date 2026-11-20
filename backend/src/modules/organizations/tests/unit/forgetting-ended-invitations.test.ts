import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../../test-support/fakes.js';
import { PurgeEndedInvitationsHandler } from '../../application/commands/purge-ended-invitations/purge-ended-invitations.handler.js';
import { anInvitation, BRICE_PHONE, DAY_MS } from '../builders/invitation-builders.js';
import { InMemoryInvitationRepository } from '../fakes/invitation-fakes.js';

const TODAY = new Date('2026-11-19T10:00:00+01:00');
const ONE_SECOND = 1000;

describe('Forgetting the name and number of an invitation that was not accepted', () => {
  const setup = async (sentDaysAgo: number) => {
    const invitations = new InMemoryInvitationRepository();
    await invitations.add(anInvitation({ now: new Date(TODAY.getTime() - sentDaysAgo * DAY_MS) }));
    const purge = new PurgeEndedInvitationsHandler(invitations, new FixedClock(TODAY));
    return { invitations, purge };
  };

  it('erases name and number 30 days after the invitation expired, and keeps its role and dates', async () => {
    const { invitations, purge } = await setup(37);

    await expect(purge.execute()).resolves.toEqual({ purged: 1 });

    expect(invitations.all()[0]).toMatchObject({
      name: null,
      phone: null,
      status: 'EXPIRED',
      role: 'HAIRDRESSER',
    });
  });

  it('keeps an invitation that expired one second less than 30 days ago', async () => {
    const { invitations } = await setup(37);
    const kept = new FixedClock(new Date(TODAY.getTime() - ONE_SECOND));

    await expect(new PurgeEndedInvitationsHandler(invitations, kept).execute()).resolves.toEqual({
      purged: 0,
    });

    expect(invitations.all()[0]).toMatchObject({ name: 'Brice Nana', phone: BRICE_PHONE });
  });

  it('never touches an invitation that is still pending', async () => {
    const { invitations, purge } = await setup(1);

    await expect(purge.execute()).resolves.toEqual({ purged: 0 });

    expect(invitations.all()[0]).toMatchObject({ name: 'Brice Nana', status: 'PENDING' });
  });

  it('can be replayed without erasing twice', async () => {
    const { purge } = await setup(40);
    await purge.execute();

    await expect(purge.execute()).resolves.toEqual({ purged: 0 });
  });
});
