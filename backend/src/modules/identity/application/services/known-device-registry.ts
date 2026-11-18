import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/ports.js';
import { KnownDevice } from '../../domain/aggregates/known-device.js';
import {
  DEVICE_TOKEN_GENERATOR,
  type DeviceTokenGenerator,
} from '../../domain/ports/device-token-generator.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import {
  KNOWN_DEVICE_REPOSITORY,
  type KnownDeviceRepository,
} from '../../domain/repositories/write/known-device.repository.js';

/** Un navigateur porte au plus un jeton par compte, et jamais plus de 5 jetons. */
export const MAX_DEVICE_TOKENS = 5;
/** Compte qui n'existe pas : la recherche se fait quand même, pour un temps de réponse identique. */
const NO_ACCOUNT = '00000000-0000-0000-0000-000000000000';
const PADDING_TOKEN = 'no-device';

export interface DeviceLookup {
  readonly device: KnownDevice | null;
  /** Jeton du cookie qui désigne `device`. */
  readonly matchedToken: string | null;
}

/**
 * Appareils reconnus. Les jetons sont toujours générés par le serveur (jamais repris d'un client) et renouvelés à
 * chaque réussite ; ils ne sont stockés que hachés.
 */
@Injectable()
export class KnownDeviceRegistry {
  constructor(
    @Inject(KNOWN_DEVICE_REPOSITORY) private readonly devices: KnownDeviceRepository,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(DEVICE_TOKEN_GENERATOR) private readonly tokens: DeviceTokenGenerator,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Même travail avec ou sans compte et avec ou sans cookie (5 empreintes, une requête) : la durée de la
   * recherche ne révèle pas qu'un compte existe. L'appareil est celui de ce compte seulement.
   */
  async find(cookieTokens: readonly string[], userId: string | null): Promise<DeviceLookup> {
    const tokens = cookieTokens.slice(0, MAX_DEVICE_TOKENS);
    const hashes = Array.from({ length: MAX_DEVICE_TOKENS }, (_, i) =>
      this.hasher.hash(tokens[i] ?? PADDING_TOKEN),
    );
    const device = await this.devices.findOf(hashes, userId ?? NO_ACCOUNT);
    const matchIndex = device ? hashes.indexOf(device.snapshot().tokenHash) : -1;
    return { device, matchedToken: matchIndex >= 0 ? (tokens[matchIndex] ?? null) : null };
  }

  async recordFailure(device: KnownDevice, now: Date): Promise<void> {
    device.recordFailure(now);
    await this.devices.save(device);
  }

  /**
   * Après une réussite : un jeton neuf pour ce compte, qui remplace son jeton précédent (un cookie copié ne vaut
   * plus rien). Renvoie le nouveau contenu du cookie : les jetons des autres comptes sont conservés, le plus
   * ancien sort au-delà de 5.
   */
  async recognizeAfterSuccess(
    found: DeviceLookup,
    cookieTokens: readonly string[],
    userId: string,
    now: Date,
  ): Promise<readonly string[]> {
    const fresh = this.tokens.next();
    const tokenHash = this.hasher.hash(fresh);
    const device = found.device ?? KnownDevice.recognize({ id: this.ids.next(), userId, tokenHash, now });
    if (found.device) {
      device.renewToken(tokenHash);
      device.recordSuccess(now);
    }
    await this.devices.save(device);

    const tokens = cookieTokens.slice(0, MAX_DEVICE_TOKENS);
    const replaced = found.matchedToken === null ? -1 : tokens.indexOf(found.matchedToken);
    if (replaced >= 0) return tokens.map((token, i) => (i === replaced ? fresh : token));
    return [...tokens, fresh].slice(-MAX_DEVICE_TOKENS);
  }
}
