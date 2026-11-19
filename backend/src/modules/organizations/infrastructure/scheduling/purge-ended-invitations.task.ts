import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PurgeEndedInvitations } from '../../application/commands/purge-ended-invitations/purge-ended-invitations.command.js';

const HOUR_MS = 3_600_000;

/** RG-006-17 : nom et numéro d'une invitation non acceptée ne se gardent pas au-delà de 30 jours après sa fin. Idempotente. */
@Injectable()
export class PurgeEndedInvitationsTask {
  private readonly logger = new Logger(PurgeEndedInvitationsTask.name);

  constructor(private readonly commands: TransactionalCommandBus) {}

  @Interval('purge-ended-invitations', HOUR_MS)
  async run(): Promise<void> {
    try {
      const { purged } = await this.commands.execute(new PurgeEndedInvitations());
      if (purged > 0)
        this.logger.log(`Invitations terminées : nom et numéro effacés sur ${purged} ligne(s).`);
    } catch (error) {
      // Rejouée à la prochaine échéance ; jamais de détail SQL dans les logs.
      this.logger.error(
        `Effacement des invitations terminées échoué (${error instanceof Error ? error.name : 'erreur'}).`,
      );
    }
  }
}
