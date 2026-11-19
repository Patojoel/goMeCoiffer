import type { SignIn as SignInBody } from '@gomecoiffer/contracts';
import type { Request } from 'express';
import type { AppConfig } from '../../../../../shared/infrastructure/config/app-config.module.js';
import { SignIn } from '../../../application/commands/sign-in/sign-in.command.js';
import { readDeviceTokens } from '../device-cookie.js';

export const toSignIn = (body: SignInBody, req: Request, config: AppConfig): SignIn =>
  new SignIn({
    phone: body.phone,
    password: body.password,
    deviceTokens: readDeviceTokens(req, config),
    networkAddress: req.ip ?? 'unknown',
  });
