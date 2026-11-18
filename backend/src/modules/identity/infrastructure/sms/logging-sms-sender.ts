import { Injectable, Logger } from '@nestjs/common';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { SmsSender } from '../../domain/ports.js';

/**
 * Faux fournisseur SMS (local, test, preprod) : le message apparaît dans les logs de développement.
 * Interdit en prod par la validation de la config (SMS_PROVIDER=fake refusé).
 */
@Injectable()
export class LoggingSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS (fake)');

  async send(to: PhoneNumber, text: string): Promise<void> {
    this.logger.log(`→ ${to.masked()} : ${text}`);
  }
}
