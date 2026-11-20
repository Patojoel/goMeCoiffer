import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { PurgePhoneProofsHandler } from '../../application/commands/purge-phone-proofs/purge-phone-proofs.handler.js';
import { PhoneProof } from '../../domain/aggregates/phone-proof.js';
import { InMemoryPhoneProofRepository } from '../fakes/identity-fakes.js';

const PROVEN_AT = new Date('2026-11-20T10:00:00+01:00');

describe('Forgetting the proofs of a number once they have expired', () => {
  const aProof = (id: string, now: Date) =>
    PhoneProof.issue({ id, phone: PhoneNumber.parse('6 55 44 33 22'), purpose: 'INVITATION', tokenHash: `h:${id}`, now });

  it('removes the expired proofs, keeps the valid ones, and can run again', async () => {
    const proofs = new InMemoryPhoneProofRepository();
    await proofs.add(aProof('old', PROVEN_AT));
    await proofs.add(aProof('recent', new Date(PROVEN_AT.getTime() + 10 * 60_000)));
    const handler = new PurgePhoneProofsHandler(proofs, new FixedClock(new Date(PROVEN_AT.getTime() + 15 * 60_000)));

    expect(await handler.execute()).toEqual({ purged: 1 });
    expect(proofs.all().map((p) => p.id)).toEqual(['recent']);
    expect(await handler.execute()).toEqual({ purged: 0 });
  });
});
