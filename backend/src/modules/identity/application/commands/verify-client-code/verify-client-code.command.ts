import { Command } from '@nestjs/cqrs';
import { PHONE_HOLDER_GAP_DAYS } from '../../../domain/aggregates/user.js';
import type { VerifyClientCodeResponse } from './verify-client-code.response.js';

export class VerifyClientCode extends Command<VerifyClientCodeResponse> {
  readonly phone: string;
  readonly code: string;
  readonly holderGapDays: number;

  constructor(input: { phone: string; code: string; holderGapDays?: number }) {
    super();
    this.phone = input.phone;
    this.code = input.code;
    this.holderGapDays = input.holderGapDays ?? PHONE_HOLDER_GAP_DAYS;
  }

  toJSON() {
    return { phone: '***', code: '***' };
  }
}
