import type { ResetPassword as ResetPasswordBody } from '@gomecoiffer/contracts';
import type { Request } from 'express';
import type { AppConfig } from '../../../../../shared/infrastructure/config/app-config.module.js';
import { ResetPassword } from '../../../application/commands/reset-password/reset-password.command.js';
import { readDeviceTokens } from '../device-cookie.js';

export const toResetPassword = (body: ResetPasswordBody, req: Request, config: AppConfig): ResetPassword =>
  new ResetPassword({
    phone: body.phone,
    code: body.code,
    newPassword: body.newPassword,
    deviceTokens: readDeviceTokens(req, config),
  });
