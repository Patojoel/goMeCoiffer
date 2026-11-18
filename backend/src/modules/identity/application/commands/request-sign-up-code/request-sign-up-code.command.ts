import { Command } from '@nestjs/cqrs';
import type { RequestSignUpCodeResponse } from './request-sign-up-code.response.js';

/** UC-001, intention 1 : recevoir un code pour prouver que l'on possède ce numéro. */
export class RequestSignUpCode extends Command<RequestSignUpCodeResponse> {
  constructor(readonly phone: string) {
    super();
  }
}
