import type { RequestPasswordResetCode as RequestPasswordResetCodeBody } from '@gomecoiffer/contracts';
import { RequestPasswordResetCode } from '../../../application/commands/request-password-reset-code/request-password-reset-code.command.js';

export const toRequestPasswordResetCode = (body: RequestPasswordResetCodeBody): RequestPasswordResetCode =>
  new RequestPasswordResetCode(body.phone);
