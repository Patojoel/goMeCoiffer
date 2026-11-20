import { beforeEach, describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { InviteeAccountProvider } from '../../application/services/invitee-account-provider.js';
import { ProvenPhone } from '../../application/services/proven-phone.js';
import { PhoneProofReader } from '../../application/services/phone-proof-reader.js';
import { PhoneProof, proofTokenSecret } from '../../domain/aggregates/phone-proof.js';
import {
  commonPasswords,
  fakePasswordHasher,
  fakeSecretHasher,
  InMemoryAuditTrail,
  InMemoryPhoneProofRepository,
  InMemoryUserRepository,
} from '../fakes/identity-fakes.js';

const PROVEN_AT = new Date('2026-11-20T10:02:00+01:00');
const NOW = new Date('2026-11-20T10:05:00+01:00');
const BRICE = PhoneNumber.parse('6 55 44 33 22');
const PAUL = PhoneNumber.parse('6 99 00 11 22');
const AICHA = PhoneNumber.parse('6 91 23 45 67');
const PAUL_ID = '0195f000-0000-7000-8000-00000000a001';
const AICHA_ID = '0195f000-0000-7000-8000-00000000a003';
const provenNumber = (phone: PhoneNumber) =>
  ProvenPhone.fromProof(
    PhoneProof.issue({ id: 'p', phone, purpose: 'INVITATION', tokenHash: 'x', now: PROVEN_AT }),
    NOW,
  )!;
const DETAILS = { name: 'Brice Nana', password: 'Wouri-Barber-2027', termsAccepted: true };

describe('Providing the account of a person who accepts an invitation', () => {
  let users: InMemoryUserRepository;
  let audit: InMemoryAuditTrail;
  let provider: InviteeAccountProvider;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    users.seedStaff(PAUL_ID, PAUL);
    users.seedLightClient(AICHA_ID, AICHA);
    audit = new InMemoryAuditTrail();
    provider = new InviteeAccountProvider(
      users,
      fakePasswordHasher,
      commonPasswords,
      audit,
      new SequentialIdGenerator(),
    );
  });

  const provide = (phone: PhoneNumber, details: typeof DETAILS | null) =>
    provider.provide({ proven: provenNumber(phone), details, now: NOW });

  it('creates the account of a number that has none, verified at the instant of the proof', async () => {
    const account = await provide(BRICE, DETAILS);

    expect(account).toMatchObject({ created: true, credentialsVersion: 1 });
    expect(users.all().find((u) => u.phone === BRICE.value)).toMatchObject({
      id: account.userId,
      name: 'Brice Nana',
      passwordHash: 'argon:Wouri-Barber-2027',
      phoneVerifiedAt: PROVEN_AT,
      termsAcceptedAt: NOW,
    });
  });

  it('traces the account creation without name, number or password', async () => {
    const account = await provide(BRICE, DETAILS);

    expect(audit.entries).toEqual([
      {
        action: 'COLLABORATOR_ACCOUNT_CREATED',
        subjectType: 'user',
        subjectId: account.userId,
        actorUserId: account.userId,
        occurredAt: NOW,
      },
    ]);
  });

  it.each([
    ['a name of one character', { ...DETAILS, name: 'B' }, 'INVALID_VALUE'],
    ['terms not accepted', { ...DETAILS, termsAccepted: false }, 'TERMS_NOT_ACCEPTED'],
    ['a password of 9 characters', { ...DETAILS, password: 'salon2026' }, 'PASSWORD_TOO_SHORT'],
    ['a password with the number inside', { ...DETAILS, password: '655443322ab' }, 'PASSWORD_CONTAINS_PHONE'],
  ])('creates nothing when it gets %s', async (_label, details, code) => {
    await expect(provide(BRICE, details)).rejects.toMatchObject({ code });

    expect(users.all().some((u) => u.phone === BRICE.value)).toBe(false);
    expect(audit.entries).toEqual([]);
  });

  it('returns a staff account without asking anything, and dates the phone proof at the instant the number was proven', async () => {
    const before = users.all().find((u) => u.id === PAUL_ID)!;

    const account = await provide(PAUL, null);

    expect(account).toEqual({ userId: PAUL_ID, credentialsVersion: 1, created: false });
    expect(users.all().find((u) => u.id === PAUL_ID)).toEqual({
      ...before,
      phoneVerifiedAt: PROVEN_AT,
      version: before.version + 1,
    });
    expect(audit.entries).toEqual([]);
  });

  it('refuses details sent for a staff account, and no details for a number without account', async () => {
    await expect(provide(PAUL, DETAILS)).rejects.toMatchObject({ code: 'ACCOUNT_STATE_CHANGED' });
    await expect(provide(BRICE, null)).rejects.toMatchObject({ code: 'ACCOUNT_STATE_CHANGED' });
  });

  it('refuses a proven phone forged by the caller: only identity can say a number was proven', async () => {
    const forged = { phone: BRICE, provenAt: PROVEN_AT };

    await expect(provider.provide({ proven: forged, details: DETAILS, now: NOW })).rejects.toMatchObject({
      code: 'PHONE_PROOF_REQUIRED',
    });

    expect(users.all().some((u) => u.phone === BRICE.value)).toBe(false);
  });

  it('completes a light client account instead of duplicating it', async () => {
    const account = await provide(AICHA, { ...DETAILS, name: 'Aïcha Bello' });

    expect(account).toEqual({ userId: AICHA_ID, credentialsVersion: 1, created: true });
    expect(users.all().filter((u) => u.phone === AICHA.value)).toHaveLength(1);
    expect(users.all().find((u) => u.id === AICHA_ID)).toMatchObject({
      name: 'Aïcha Bello',
      passwordHash: 'argon:Wouri-Barber-2027',
    });
    expect(audit.entries[0]).toMatchObject({ action: 'CLIENT_ACCOUNT_COMPLETED_AS_COLLABORATOR' });
  });
});

describe('Reading the proof of a number carried by a browser', () => {
  let proofs: InMemoryPhoneProofRepository;
  let reader: PhoneProofReader;

  beforeEach(async () => {
    proofs = new InMemoryPhoneProofRepository();
    reader = new PhoneProofReader(proofs, fakeSecretHasher);
    await proofs.add(
      PhoneProof.issue({
        id: 'p1',
        phone: BRICE,
        purpose: 'INVITATION',
        tokenHash: fakeSecretHasher.hash(proofTokenSecret('token-1')),
        now: PROVEN_AT,
      }),
    );
  });

  const at = (seconds: number) => new Date(PROVEN_AT.getTime() + seconds * 1000);

  it('gives the number and the instant of the proof to the browser that holds the token', async () => {
    const proof = await reader.phoneProvenBy('token-1', at(60));

    expect(proof?.phone.value).toBe(BRICE.value);
    expect(proof?.provenAt).toEqual(PROVEN_AT);
  });

  it.each([
    ['no token', null, 60],
    ['a token nobody was given', 'token-2', 60],
    ['an expired proof', 'token-1', 15 * 60],
  ])('gives nothing for %s', async (_label, token, seconds) => {
    expect(await reader.phoneProvenBy(token, at(seconds))).toBeNull();
  });

  it('forgets every proof of the number, and only of that number', async () => {
    await proofs.add(
      PhoneProof.issue({
        id: 'p3',
        phone: PAUL,
        purpose: 'INVITATION',
        tokenHash: fakeSecretHasher.hash(proofTokenSecret('token-paul')),
        now: PROVEN_AT,
      }),
    );
    const proven = (await reader.phoneProvenBy('token-1', at(60)))!;

    await reader.forgetProofsOf(proven);

    expect(await reader.phoneProvenBy('token-1', at(60))).toBeNull();
    expect(await reader.phoneProvenBy('token-paul', at(60))).not.toBeNull();
  });

  it('gives nothing for a proof issued for another purpose', async () => {
    await proofs.add(
      PhoneProof.issue({
        id: 'p2',
        phone: BRICE,
        purpose: 'PASSWORD_RESET',
        tokenHash: fakeSecretHasher.hash(proofTokenSecret('token-3')),
        now: PROVEN_AT,
      }),
    );

    expect(await reader.phoneProvenBy('token-3', at(60))).toBeNull();
  });
});
