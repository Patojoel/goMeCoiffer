import { Logger } from '@nestjs/common';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { SmsSender } from '../../domain/ports/sms-sender.port.js';

const logger = new Logger('SMS (fake)');

/**
 * Faux fournisseur SMS, en attendant le vrai (refusé en prod par la config). Le code n'apparaît en clair
 * qu'en local et en test : ailleurs, lire les logs permettrait de s'inscrire sur n'importe quel numéro.
 */
export class LoggingSmsSender implements SmsSender {
  constructor(
    private readonly revealCodes: boolean,
    private readonly write: (line: string) => void = (line) => logger.log(line),
  ) {}

  async send(to: PhoneNumber, text: string): Promise<void> {
    const shown = this.revealCodes ? text : text.replace(/\b\d{6}\b/g, '••••••');
    this.write(`→ ${to.masked()} : ${shown}`);
  }
}
