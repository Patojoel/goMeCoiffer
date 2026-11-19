import type { KnownDevice } from '../../aggregates/known-device.js';

export const KNOWN_DEVICE_REPOSITORY = Symbol('KNOWN_DEVICE_REPOSITORY');
export interface KnownDeviceRepository {
  /**
   * L'appareil de ce compte porté par l'un de ces jetons (le cookie en porte plusieurs, un par compte) :
   * une seule requête, quel que soit le nombre de jetons.
   */
  findOf(tokenHashes: readonly string[], userId: string): Promise<KnownDevice | null>;
  /** Les appareils de ce compte encore reconnus (non révoqués). */
  findNotRevokedOf(userId: string): Promise<KnownDevice[]>;
  save(device: KnownDevice): Promise<void>;
}
