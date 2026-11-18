import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PurgeSignInAttempts } from '../../application/commands/purge-sign-in-attempts/purge-sign-in-attempts.command.js';

const HOUR_MS = 3_600_000;

/** D-028 : l'historique des essais (adresse réseau comprise) ne se garde pas au-delà de 48 h. Idempotente, rejouable. */
@Injectable()
export class PurgeSignInAttemptsTask {
  private readonly logger = new Logger(PurgeSignInAttemptsTask.name);

  constructor(private readonly commands: TransactionalCommandBus) {}

  @Interval('purge-sign-in-attempts', HOUR_MS)
  async run(): Promise<void> {
    try {
      const { purged } = await this.commands.execute(new PurgeSignInAttempts());
      if (purged > 0) this.logger.log(`Historique des essais de connexion : ${purged} ligne(s) oubliée(s).`);
    } catch (error) {
      // Rejouée à la prochaine échéance ; jamais de détail SQL dans les logs.
      this.logger.error(
        `Purge des essais de connexion échouée (${error instanceof Error ? error.name : 'erreur'}).`,
      );
    }
  }
}
