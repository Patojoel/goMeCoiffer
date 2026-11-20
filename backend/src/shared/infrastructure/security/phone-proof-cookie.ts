import type { Request, Response } from 'express';
import type { AppConfig } from '../config/app-config.module.js';
import { cookieName } from './http-security.js';

const PHONE_PROOF_COOKIE_BASE = 'gmc.join';
/** 32 octets en base64url : tout autre contenu est ignoré. */
const PROOF_TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** `__Host-` (chemin `/`, `Secure`, sans domaine) quand les cookies sont sécurisés ; `SameSite=Strict` : jamais envoyé depuis un autre site. */
const proofCookieName = (config: AppConfig) => cookieName(config, PHONE_PROOF_COOKIE_BASE);

const proofCookieOptions = (config: AppConfig) =>
  ({ httpOnly: true, sameSite: 'strict', secure: config.COOKIE_SECURE, path: '/' }) as const;

/** Jeton de preuve du numéro porté par ce navigateur, s'il est bien formé. */
export function readPhoneProofToken(req: Request, config: AppConfig): string | null {
  const raw: unknown = req.cookies?.[proofCookieName(config)];
  return typeof raw === 'string' && PROOF_TOKEN_FORMAT.test(raw) ? raw : null;
}

export function setPhoneProofCookie(res: Response, token: string, expires: Date, config: AppConfig): void {
  res.cookie(proofCookieName(config), token, { ...proofCookieOptions(config), expires });
}

/** Mêmes attributs qu'à la pose : sinon le navigateur ne l'efface pas. */
export function clearPhoneProofCookie(res: Response, config: AppConfig): void {
  res.clearCookie(proofCookieName(config), proofCookieOptions(config));
}
