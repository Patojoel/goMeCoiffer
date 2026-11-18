import { Command } from '@nestjs/cqrs';
import type { SignUpCodeSent } from '@gomecoiffer/contracts';

/** UC-001, intention 1 : recevoir un code pour prouver que l'on possède ce numéro. */
export class RequestSignUpCode extends Command<SignUpCodeSent> {
  constructor(readonly phone: string) {
    super();
  }
}
