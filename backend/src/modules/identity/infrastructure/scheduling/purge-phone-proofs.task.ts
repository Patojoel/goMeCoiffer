import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PurgePhoneProofs } from '../../application/commands/purge-phone-proofs/purge-phone-proofs.command.js';

const HOUR_MS = 3_600_000;

/** Une preuve de numéro échue ne sert plus à rien : elle ne se garde pas. Idempotente, rejouable. */
@Injectable()
export class PurgePhoneProofsTask {
  private readonly logger = new Logger(PurgePhoneProofsTask.name);

  constructor(private readonly commands: TransactionalCommandBus) {}

  @Interval('purge-phone-proofs', HOUR_MS)
  async run(): Promise<void> {
    try {
      const { purged } = await this.commands.execute(new PurgePhoneProofs());
      if (purged > 0) this.logger.log(`Preuves de numéro échues : ${purged} oubliée(s).`);
    } catch (error) {
      this.logger.error(`Purge des preuves de numéro échouée (${error instanceof Error ? error.name : 'erreur'}).`);
    }
  }
}
