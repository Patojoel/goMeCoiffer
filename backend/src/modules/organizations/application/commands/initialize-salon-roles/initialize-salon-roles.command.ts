import { Command } from '@nestjs/cqrs';
import type { InitializeSalonRolesResponse } from './initialize-salon-roles.response.js';

export class InitializeSalonRoles extends Command<InitializeSalonRolesResponse> {
  constructor(
    readonly salonId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

