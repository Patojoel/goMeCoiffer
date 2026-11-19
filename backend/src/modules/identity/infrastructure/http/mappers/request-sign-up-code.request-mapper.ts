import type { RequestSignUpCode as RequestSignUpCodeBody } from '@gomecoiffer/contracts';
import { RequestSignUpCode } from '../../../application/commands/request-sign-up-code/request-sign-up-code.command.js';

export const toRequestSignUpCode = (body: RequestSignUpCodeBody): RequestSignUpCode =>
  new RequestSignUpCode(body.phone);
