import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import type { DeviceTokenGenerator } from '../../domain/ports/device-token-generator.port.js';
import type { OtpCodeGenerator } from '../../domain/ports/otp-code-generator.port.js';
import type { PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import type { PasswordVerifier } from '../../domain/ports/password-verifier.port.js';
import type { SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import type { NewPassword } from '../../domain/value-objects/new-password.js';

/** Empreinte HMAC-SHA256 des codes à usage unique, avec le poivre TOKEN_HASH_PEPPER ; comparaison à temps constant. */
@Injectable()
export class HmacSecretHasher implements SecretHasher {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  hash(secret: string): string {
    return createHmac('sha256', this.config.TOKEN_HASH_PEPPER).update(secret).digest('hex');
  }

  matches(candidate: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(candidate), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

@Injectable()
export class CryptoOtpCodeGenerator implements OtpCodeGenerator {
  next(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}

/** argon2id avec les paramètres minimaux recommandés par l'OWASP (19 Mio, 2 passes, 1 fil). */
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: NewPassword): Promise<string> {
    return hash(password.value, ARGON2_OPTIONS);
  }
}

/** Jeton de 32 octets aléatoires, en base64url (43 caractères), posé dans le cookie de l'appareil reconnu. */
@Injectable()
export class CryptoDeviceTokenGenerator implements DeviceTokenGenerator {
  next(): string {
    return randomBytes(32).toString('base64url');
  }
}

/**
 * Vérification argon2id à la connexion. L'empreinte factice est calculée au démarrage avec les réglages en
 * vigueur : un numéro sans compte coûte une vraie vérification, comme un mot de passe faux (D-019).
 */
@Injectable()
export class Argon2PasswordVerifier implements PasswordVerifier, OnModuleInit {
  private dummyHash: Promise<string> | undefined;

  /** Calculée avant la fin du démarrage de l'application (Nest attend `onModuleInit`) : aucun calcul natif en vol ensuite. */
  async onModuleInit(): Promise<void> {
    await this.dummy();
  }

  /** Empreinte factice : mot de passe aléatoire, réglages en vigueur. */
  dummy(): Promise<string> {
    return (this.dummyHash ??= hash(randomBytes(16).toString('hex'), ARGON2_OPTIONS));
  }

  async verify(password: string, storedHash: string | null): Promise<boolean> {
    const target = storedHash ?? (await this.dummy());
    let matches = false;
    try {
      matches = await verify(target, password);
    } catch {
      matches = false; // empreinte illisible : refus, jamais d'erreur qui distinguerait le cas
    }
    return storedHash !== null && matches;
  }

  /** Vrai si l'empreinte n'est pas de l'argon2id, ou a été calculée avec des réglages plus faibles que ceux en vigueur. */
  needsRehash(storedHash: string): boolean {
    const params = /^\$argon2id\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);
    if (!params) return true;
    const [, memory, time, parallelism] = params.map(Number);
    return (
      memory! < ARGON2_OPTIONS.memoryCost ||
      time! < ARGON2_OPTIONS.timeCost ||
      parallelism! < ARGON2_OPTIONS.parallelism
    );
  }

  rehash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }
}
