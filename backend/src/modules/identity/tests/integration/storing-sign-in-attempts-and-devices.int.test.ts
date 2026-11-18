import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { ConcurrencyConflictError, ConflictError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SignIn } from '../../application/commands/sign-in/sign-in.command.js';
import { KnownDevice } from '../../domain/aggregates/known-device.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import {
  SIGN_IN_ATTEMPT_HISTORY,
  type SignInAttemptHistory,
} from '../../domain/repositories/read/sign-in-attempt-history.read-repository.js';
import {
  KNOWN_DEVICE_REPOSITORY,
  type KnownDeviceRepository,
} from '../../domain/repositories/write/known-device.repository.js';
import {
  SIGN_IN_ATTEMPT_REPOSITORY,
  type SignInAttemptRepository,
} from '../../domain/repositories/write/sign-in-attempt.repository.js';
import { Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';

const PAUL = PhoneNumber.parse('6 99 00 11 22');
const NOW = new Date('2026-11-18T10:00:00+01:00');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const hoursAgo = (n: number) => minutesAgo(n * 60);

describe('Storing sign-in attempts and recognised devices in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let attempts: SignInAttemptRepository;
  let history: SignInAttemptHistory;
  let devices: KnownDeviceRepository;
  let hasher: SecretHasher;

  const insertUser = async (phone: string, passwordHash: string | null) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version) VALUES ($1, $2, 'Paul Ebode', $3, now(), 1)`,
      [id, phone, passwordHash],
    );
    return id;
  };
  const add = (
    phone: string,
    address: string,
    at: Date,
    over: { succeeded?: boolean; known?: boolean } = {},
  ) =>
    attempts.add({
      phone,
      networkAddress: address,
      at,
      succeeded: over.succeeded ?? false,
      fromKnownDevice: over.known ?? false,
    });

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    attempts = t.moduleRef.get(SIGN_IN_ATTEMPT_REPOSITORY);
    history = t.moduleRef.get(SIGN_IN_ATTEMPT_HISTORY);
    devices = t.moduleRef.get(KNOWN_DEVICE_REPOSITORY);
    hasher = t.moduleRef.get(SECRET_HASHER);
  });
  afterAll(() => t.close());

  it('reads the attempts of the number over 24 hours and only the counted failures of the address over one hour', async () => {
    const A = '41.202.20.1';
    await add(PAUL.value, '10.0.0.1', hoursAgo(25)); // trop ancien
    await add(PAUL.value, '10.0.0.1', hoursAgo(23)); // numéro, 23 h
    await add(PAUL.value, '10.0.0.1', minutesAgo(5), { succeeded: true }); // numéro, réussite
    await add('+237655443322', A, minutesAgo(30)); // adresse, échec compté
    await add('+237655443322', A, minutesAgo(30), { known: true }); // adresse, appareil reconnu : ignoré
    await add('+237655443322', A, minutesAgo(30), { succeeded: true }); // adresse, réussite : ignorée
    await add('+237655443322', A, minutesAgo(61)); // adresse, trop ancien
    await add('+237655443322', '10.9.9.9', minutesAgo(30)); // autre adresse, autre numéro : ignoré

    const rows = await history.recentAttempts(PAUL, A, NOW);

    expect(
      rows.map((r) => [r.phone, r.networkAddress, r.at.toISOString(), r.succeeded, r.fromKnownDevice]).sort(),
    ).toEqual(
      [
        [PAUL.value, '10.0.0.1', hoursAgo(23).toISOString(), false, false],
        [PAUL.value, '10.0.0.1', minutesAgo(5).toISOString(), true, false],
        ['+237655443322', A, minutesAgo(30).toISOString(), false, false],
      ].sort(),
    );
  });

  it('forgets the attempts older than the given instant, and only those', async () => {
    const phone = '+237677000001';
    await add(phone, '10.1.1.1', hoursAgo(49));
    await add(phone, '10.1.1.1', hoursAgo(47));

    const purged = await attempts.purgeBefore(hoursAgo(48));

    expect(purged).toBeGreaterThanOrEqual(1);
    const left = await db.query(`SELECT attempted_at FROM sign_in_attempts WHERE phone = $1`, [phone]);
    expect(left.map((r: { attempted_at: Date }) => r.attempted_at)).toEqual([hoursAgo(47)]);
    expect(await attempts.purgeBefore(hoursAgo(48))).toBe(0);
  });

  it('stores only a fingerprint of the device token, one device per token and account', async () => {
    const paulId = await insertUser('+237699001122', null);
    const mireilleId = await insertUser('+237677123456', null);
    const token = 'plain-device-token-never-stored';
    const tokenHash = hasher.hash(token);

    await devices.save(KnownDevice.recognize({ id: randomUUID(), userId: paulId, tokenHash, now: NOW }));
    await devices.save(KnownDevice.recognize({ id: randomUUID(), userId: mireilleId, tokenHash, now: NOW }));

    const rows = await db.query(`SELECT * FROM known_devices WHERE user_id = $1`, [paulId]);
    expect(Object.values(rows[0]).map(String).join('|')).not.toContain(token);
    expect((await devices.findOf([tokenHash], paulId))?.snapshot().userId).toBe(paulId);
    expect((await devices.findOf([tokenHash], mireilleId))?.snapshot().userId).toBe(mireilleId);
    expect(await devices.findOf(['unknown-hash', tokenHash, 'other-hash'], paulId)).not.toBeNull();
    expect(await devices.findOf(['unknown-hash'], paulId)).toBeNull();
    expect(await devices.findOf([tokenHash], randomUUID())).toBeNull();
    await expect(
      devices.save(KnownDevice.recognize({ id: randomUUID(), userId: paulId, tokenHash, now: NOW })),
    ).rejects.toThrow(ConflictError);
  });

  it('reads back a revoked device and refuses a stale write', async () => {
    const userId = await insertUser('+237677000002', null);
    const tokenHash = hasher.hash('another-token');
    await devices.save(KnownDevice.recognize({ id: randomUUID(), userId, tokenHash, now: NOW }));
    const device = (await devices.findOf([tokenHash], userId))!;
    const stale = (await devices.findOf([tokenHash], userId))!;
    for (let i = 0; i < 5; i++) device.recordFailure(NOW);
    await devices.save(device);

    const reloaded = (await devices.findOf([tokenHash], userId))!;

    expect(reloaded.snapshot()).toMatchObject({ failedAttempts: 5, revokedAt: NOW, version: 2 });
    expect(reloaded.isRecognizedAt(NOW)).toBe(false);
    stale.recordSuccess(NOW);
    await expect(devices.save(stale)).rejects.toThrow(ConcurrencyConflictError);
  });

  it('counts simultaneous wrong passwords one by one: only one is verified, the others are refused for too many attempts', async () => {
    const hash = await new Argon2PasswordVerifier().rehash('Bastos-Fade-2026');
    const phone = '+237699004444';
    await insertUser(phone, hash);
    const now = new Date();
    for (const minutes of [4, 3, 2, 1])
      await add(phone, '10.2.2.2', new Date(now.getTime() - minutes * 60_000));
    const bus = t.moduleRef.get(TransactionalCommandBus);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        bus.execute(
          new SignIn({
            phone: '6 99 00 44 44',
            password: `Wrong-guess-${i}-ok`,
            deviceTokens: [],
            networkAddress: '10.2.2.2',
          }),
        ),
      ),
    );

    const refusals = results.map((r) => (r.status === 'REFUSED' ? r.refusal.code : r.status));
    expect(refusals.filter((c) => c === 'INVALID_CREDENTIALS')).toHaveLength(1);
    expect(refusals.filter((c) => c === 'SIGN_IN_TEMPORARILY_BLOCKED')).toHaveLength(9);
    const stored = await db.query(`SELECT count(*) AS n FROM sign_in_attempts WHERE phone = $1`, [phone]);
    expect(Number(stored[0].n)).toBe(5);
  });
});
