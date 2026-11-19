import { Command } from '@nestjs/cqrs';
import type { SelectActiveSalonResponse } from './select-active-salon.response.js';

/** UC-005 : l'utilisateur de la session ouvre un salon (ou en change). Aucune écriture : la session change côté HTTP. */
export class SelectActiveSalon extends Command<SelectActiveSalonResponse> {
  constructor(
    readonly userId: string,
    readonly salonId: string,
  ) {
    super();
  }
}
