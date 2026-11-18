import { hash, verify } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';
import { ARGON2_OPTIONS, Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';

const PASSWORD = 'Bastos-Fade-2026';

describe('Verifying passwords with argon2id', () => {
  const verifier = new Argon2PasswordVerifier();

  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await verifier.rehash(PASSWORD);

    expect(await verifier.verify(PASSWORD, stored)).toBe(true);
    expect(await verifier.verify('Akwa-Fade-2026', stored)).toBe(false);
  });

  it('refuses any password when there is no hash to compare with', async () => {
    expect(await verifier.verify(PASSWORD, null)).toBe(false);
  });

  it('refuses an unreadable stored hash instead of failing', async () => {
    expect(await verifier.verify(PASSWORD, '$argon2id$test')).toBe(false);
  });

  it('refuses a number without account against a dummy hash computed with exactly the current argon2id settings', async () => {
    const dummy = await verifier.dummy();
    const current = await verifier.rehash(PASSWORD);
    const settingsOf = (stored: string) =>
      /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored)?.slice(1, 4).map(Number);

    expect(settingsOf(dummy)).toEqual([
      ARGON2_OPTIONS.memoryCost,
      ARGON2_OPTIONS.timeCost,
      ARGON2_OPTIONS.parallelism,
    ]);
    expect(settingsOf(dummy)).toEqual(settingsOf(current));
    expect(verifier.needsRehash(dummy)).toBe(false);
  });

  it('really runs argon2id when there is no hash to compare with, and still refuses', async () => {
    const start = performance.now();
    const accepted = await verifier.verify(PASSWORD, null);
    const elapsedMs = performance.now() - start;

    expect(accepted).toBe(false);
    // Borne basse seulement (jamais haute) : une machine chargée ne peut que la dépasser. Un court-circuit prend < 1 ms.
    expect(elapsedMs).toBeGreaterThan(3);
    expect(await verify(await verifier.dummy(), PASSWORD)).toBe(false);
  });

  it('keeps a hash computed with the current settings', async () => {
    expect(verifier.needsRehash(await verifier.rehash(PASSWORD))).toBe(false);
  });

  it('asks to recompute a hash computed with weaker settings, which still verifies until then', async () => {
    const weak = await hash(PASSWORD, { memoryCost: 8_192, timeCost: 2, parallelism: 1, outputLen: 32 });

    expect(verifier.needsRehash(weak)).toBe(true);
    expect(await verifier.verify(PASSWORD, weak)).toBe(true);
  });

  it('keeps a hash computed with stronger settings than the current ones', async () => {
    const strong = await hash(PASSWORD, { memoryCost: 46_080, timeCost: 2, parallelism: 1, outputLen: 32 });

    expect(verifier.needsRehash(strong)).toBe(false);
  });

  it('asks to recompute a hash that is not argon2id', () => {
    expect(verifier.needsRehash('$2b$12$abcdefghijklmnopqrstuv')).toBe(true);
  });
});
