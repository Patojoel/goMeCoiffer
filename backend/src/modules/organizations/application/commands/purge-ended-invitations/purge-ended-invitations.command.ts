import { Command } from '@nestjs/cqrs';
import type { PurgeEndedInvitationsResponse } from './purge-ended-invitations.response.js';

/** RG-006-17 : effacer nom et numéro des invitations non acceptées, 30 jours après leur fin ; tâche planifiée, rejouable. */
export class PurgeEndedInvitations extends Command<PurgeEndedInvitationsResponse> {}
