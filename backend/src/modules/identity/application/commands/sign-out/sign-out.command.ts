import { Command } from '@nestjs/cqrs';
import type { SignOutResponse } from './sign-out.response.js';

/** UC-002 : tracer la déconnexion de l'utilisateur dont la session existait (`null` : pas de session, rien à tracer). */
export class SignOut extends Command<SignOutResponse> {
  constructor(readonly userId: string | null) {
    super();
  }
}
