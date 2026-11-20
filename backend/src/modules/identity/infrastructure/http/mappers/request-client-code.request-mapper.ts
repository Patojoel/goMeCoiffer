import type { RequestClientCode as RequestClientCodeBody } from '@gomecoiffer/contracts';
import { RequestClientCode } from '../../../application/commands/request-client-code/request-client-code.command.js';

export const toRequestClientCode = (body: RequestClientCodeBody): RequestClientCode =>
  new RequestClientCode({ phone: body.phone, termsAccepted: body.termsAccepted });
