import type { Request, Response } from 'express';
import type { AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import {
  cookieName,
  securityCookieOptions,
} from '../../../../shared/infrastructure/security/http-security.js';
import { MAX_DEVICE_TOKENS } from '../../application/services/known-device-registry.js';
import { KNOWN_DEVICE_LIFETIME_DAYS } from '../../domain/aggregates/known-device.js';

const DEVICE_COOKIE_BASE = 'gmc.device';
/** 32 octets en base64url : tout autre morceau est ignoré (un jeton choisi par un tiers n'est jamais repris). */
const DEVICE_TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** Cookie de l'appareil : un jeton par compte, séparés par des points (le point n'existe pas en base64url). */
export function parseDeviceCookie(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split('.')
    .filter((piece) => DEVICE_TOKEN_FORMAT.test(piece))
    .slice(-MAX_DEVICE_TOKENS);
}

export function readDeviceTokens(req: Request, config: AppConfig): string[] {
  return parseDeviceCookie(req.cookies?.[cookieName(config, DEVICE_COOKIE_BASE)]);
}

/**
 * Identifiant de limitation de débit : un navigateur qui porte un cookie d'appareil bien formé a son propre
 * compteur, pour qu'un tiers de même adresse (NAT d'opérateur, Wi-Fi du salon) ne le prive pas de connexion.
 * Un cookie forgé n'y gagne rien : sans appareil reconnu, la politique d'essais par numéro et par adresse s'applique.
 */
export function rateLimitTracker(req: Request): string {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const raw = cookies?.[`__Host-${DEVICE_COOKIE_BASE}`] ?? cookies?.[DEVICE_COOKIE_BASE];
  const [first] = parseDeviceCookie(raw);
  return first ? `device:${first}` : `ip:${req.ip ?? 'unknown'}`;
}

export function setDeviceCookie(res: Response, tokens: readonly string[], config: AppConfig): void {
  res.cookie(cookieName(config, DEVICE_COOKIE_BASE), tokens.join('.'), {
    ...securityCookieOptions(config),
    maxAge: KNOWN_DEVICE_LIFETIME_DAYS * 24 * 3_600_000,
  });
}
