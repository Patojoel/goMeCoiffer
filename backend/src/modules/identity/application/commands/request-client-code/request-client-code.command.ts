import { Command } from '@nestjs/cqrs';
import type { RequestClientCodeResponse } from './request-client-code.response.js';

export class RequestClientCode extends Command<RequestClientCodeResponse> {
  readonly phone: string;
  readonly termsAccepted: boolean;

  constructor(input: { phone: string; termsAccepted: boolean }) {
    super();
    this.phone = input.phone;
    this.termsAccepted = input.termsAccepted;
  }

  toJSON() {
    return { phone: '***', termsAccepted: this.termsAccepted };
  }
}
