import type { VerifyClientCode as VerifyClientCodeBody } from '@gomecoiffer/contracts';
import type { AppConfig } from '../../../../../shared/infrastructure/config/app-config.module.js';
import { VerifyClientCode } from '../../../application/commands/verify-client-code/verify-client-code.command.js';

export const toVerifyClientCode = (body: VerifyClientCodeBody, config: AppConfig): VerifyClientCode =>
  new VerifyClientCode({
    phone: body.phone,
    code: body.code,
    holderGapDays: config.PHONE_HOLDER_GAP_DAYS,
  });
