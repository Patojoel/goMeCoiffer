import type { Request } from 'express';
import type { AppConfig } from '../../../../../shared/infrastructure/config/app-config.module.js';
import { readPhoneProofToken } from '../../../../../shared/infrastructure/security/phone-proof-cookie.js';
import { SignOut } from '../../../application/commands/sign-out/sign-out.command.js';

/** Sans session ouverte, `null` : la déconnexion reste confirmée, il n'y a rien à tracer. */
export const toSignOut = (req: Request, config: AppConfig): SignOut =>
  new SignOut(req.session?.userId ?? null, readPhoneProofToken(req, config));
