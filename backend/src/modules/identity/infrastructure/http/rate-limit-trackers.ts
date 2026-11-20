import { normalizeNetworkAddress } from '../../domain/value-objects/network-address.js';
import { rateLimitTracker } from './device-cookie.js';

/** Compteur par appareil (cookie d'appareil bien formé), sinon par adresse. */
export const signInDeviceTracker = rateLimitTracker;

/** Compteur par adresse seule (/64 en IPv6) : des cookies forgés n'ouvrent pas de compteur neuf. */
export const signInAddressTracker = (req: { readonly ip?: unknown }): string =>
  `address:${normalizeNetworkAddress(String(req.ip ?? 'unknown'))}`;

export const trackByNetworkAddress = signInAddressTracker;
