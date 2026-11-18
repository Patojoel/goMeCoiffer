export const DEVICE_TOKEN_GENERATOR = Symbol('DEVICE_TOKEN_GENERATOR');
/** Jeton aléatoire non devinable posé dans le cookie de l'appareil reconnu. */
export interface DeviceTokenGenerator {
  next(): string;
}
