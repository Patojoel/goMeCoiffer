import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import type { NewPassword } from '../../domain/new-password.js';
import type { OtpCodeGenerator, PasswordHasher, SecretHasher } from '../../domain/ports.js';

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
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: NewPassword): Promise<string> {
    return hash(password.value, { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 });
  }
}
