import { Command } from '@nestjs/cqrs';
import type { SignOutResponse } from './sign-out.response.js';

/** UC-002 : tracer la déconnexion de l'utilisateur dont la session existait (la couche HTTP détruit la session). */
export class SignOut extends Command<SignOutResponse> {
  constructor(readonly userId: string) {
    super();
  }
}
