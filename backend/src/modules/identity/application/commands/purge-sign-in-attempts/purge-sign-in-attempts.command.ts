import { Command } from '@nestjs/cqrs';
import type { PurgeSignInAttemptsResponse } from './purge-sign-in-attempts.response.js';

/** D-028 : oublier l'historique des essais de connexion de plus de 48 h ; tâche planifiée, rejouable. */
export class PurgeSignInAttempts extends Command<PurgeSignInAttemptsResponse> {}
