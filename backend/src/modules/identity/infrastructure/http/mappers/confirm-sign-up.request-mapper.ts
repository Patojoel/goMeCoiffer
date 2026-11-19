import type { ConfirmSignUp as ConfirmSignUpBody } from '@gomecoiffer/contracts';
import { ConfirmSignUp } from '../../../application/commands/confirm-sign-up/confirm-sign-up.command.js';

export const toConfirmSignUp = (body: ConfirmSignUpBody): ConfirmSignUp =>
  new ConfirmSignUp({ ...body, email: body.email ?? null });
