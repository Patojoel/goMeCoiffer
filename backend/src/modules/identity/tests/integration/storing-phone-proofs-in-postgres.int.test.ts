import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { PhoneProof, proofTokenSecret } from '../../domain/aggregates/phone-proof.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import {
  PENDING_INVITATIONS_OF_PHONE,
  type PendingInvitationsOfPhone,
} from '../../domain/repositories/read/pending-invitations-of-phone.read-repository.js';
import {
  PHONE_PROOF_REPOSITORY,
  type PhoneProofRepository,
} from '../../domain/repositories/write/phone-proof.repository.js';
import { SalonWorld } from '../../../organizations/tests/builders/salon-world.js';
import { StaffAccounts } from '../../../organizations/tests/builders/staff-accounts.js';

const PROVEN_AT = new Date('2026-11-20T09:00:00Z');
const NOW = PROVEN_AT;
const BRICE = PhoneNumber.parse('6 55 44 33 22');
const minutes = (n: number) => new Date(PROVEN_AT.getTime() + n * 60_000);

describe('Storing the proofs of a phone number in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let proofs: PhoneProofRepository;
  let hasher: SecretHasher;
  let pending: PendingInvitationsOfPhone;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    proofs = t.moduleRef.get(PHONE_PROOF_REPOSITORY);
    hasher = t.moduleRef.get(SECRET_HASHER);
    pending = t.moduleRef.get(PENDING_INVITATIONS_OF_PHONE);
  });
  afterAll(() => t.close());

  const proof = (token: string, now = PROVEN_AT) =>
    PhoneProof.issue({
      id: randomUUID(),
      phone: BRICE,
      purpose: 'INVITATION',
      tokenHash: hasher.hash(proofTokenSecret(token)),
      now,
    });
  const store = (p: PhoneProof) => bus.inTransaction(() => proofs.add(p));

  it('finds a proof by the fingerprint of its token and never stores the token itself', async () => {
    await store(proof('a-secret-token'));

    const found = await proofs.findByTokenHash(hasher.hash(proofTokenSecret('a-secret-token')));

    expect(found?.snapshot()).toMatchObject({
      phone: '+237655443322',
      purpose: 'INVITATION',
      provenAt: PROVEN_AT,
    });
    expect(await proofs.findByTokenHash(hasher.hash(proofTokenSecret('another-token')))).toBeNull();
    expect(JSON.stringify(await db.query(`SELECT * FROM phone_proofs`))).not.toContain('a-secret-token');
  });

  it('refuses two proofs with the same token fingerprint', async () => {
    await store(proof('same-token'));

    await expect(store(proof('same-token'))).rejects.toThrow();
  });

  it('forgets the proofs that have expired and keeps the others, counting them once', async () => {
    await db.query(`DELETE FROM phone_proofs`);
    await store(proof('old-token', minutes(-30)));
    await store(proof('recent-token', minutes(-5)));

    expect(await bus.inTransaction(() => proofs.purgeExpiredAt(NOW))).toBe(1);
    expect(await bus.inTransaction(() => proofs.purgeExpiredAt(NOW))).toBe(0);
    expect(await proofs.findByTokenHash(hasher.hash(proofTokenSecret('recent-token')))).not.toBeNull();
  });

  it('tells whether a number has a pending invitation, ignoring the expired and the other numbers', async () => {
    const accounts = new StaffAccounts(db);
    const mireille = await accounts.create('Mireille Ndongo');
    const [akwa] = await new SalonWorld(db).organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
    ]);
    const invite = (phone: string, status: string, expiresAt: Date) =>
      db.query(
        `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, notified_by_sms, version)
         VALUES ($1, $2, 'Brice Nana', $3, 'HAIRDRESSER', $4, $5, $6, $7, false, 1)`,
        [randomUUID(), akwa!.id, phone, mireille.id, minutes(-60), expiresAt, status],
      );
    await invite('+237655443322', 'PENDING', minutes(60));
    await invite('+237670112233', 'PENDING', minutes(-1));
    await invite('+237670000002', 'CANCELLED', minutes(60));

    expect(await pending.existsFor(BRICE, NOW)).toBe(true);
    expect(await pending.existsFor(PhoneNumber.parse('6 70 11 22 33'), NOW)).toBe(false);
    expect(await pending.existsFor(PhoneNumber.parse('6 70 00 00 02'), NOW)).toBe(false);
    expect(await pending.existsFor(PhoneNumber.parse('6 70 00 00 01'), NOW)).toBe(false);
  });
});
