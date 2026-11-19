import { Logger } from '@nestjs/common';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { InvitationNotifier } from '../../domain/ports/invitation-notifier.port.js';

const logger = new Logger('SMS invitation (fake)');

/** Faux fournisseur en attendant le vrai (`SMS_PROVIDER=fake`, refusé en prod par la config) : le numéro est masqué. */
export class LoggingInvitationNotifier implements InvitationNotifier {
  constructor(private readonly write: (line: string) => void = (line) => logger.log(line)) {}

  async send(to: PhoneNumber, text: string): Promise<void> {
    this.write(`→ ${to.masked()} : ${text}`);
  }
}
