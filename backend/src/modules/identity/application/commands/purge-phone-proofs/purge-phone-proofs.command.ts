import { Command } from '@nestjs/cqrs';
import type { PurgePhoneProofsResponse } from './purge-phone-proofs.response.js';

/** UC-007 : oublier les preuves de numéro échues ; tâche planifiée, rejouable. */
export class PurgePhoneProofs extends Command<PurgePhoneProofsResponse> {}
