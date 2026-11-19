import type { Request } from 'express';
import { SignOut } from '../../../application/commands/sign-out/sign-out.command.js';

/** Sans session ouverte, `null` : la déconnexion reste confirmée, il n'y a rien à tracer. */
export const toSignOut = (req: Request): SignOut => new SignOut(req.session?.userId ?? null);
