import { Injectable } from '@nestjs/common';
import type { DomainEventSubscriber } from '../../../../shared/application/domain-event-subscriber.js';
import { SalonRegistered } from '../../domain/events/salon-registered.js';
import { InitializeSalonRoles } from '../commands/initialize-salon-roles/initialize-salon-roles.command.js';
import { InitializeSalonRolesHandler } from '../commands/initialize-salon-roles/initialize-salon-roles.handler.js';

@Injectable()
export class WhenSalonRegistered implements DomainEventSubscriber<SalonRegistered> {
  readonly subscribesTo = SalonRegistered;

  constructor(private readonly initializeRoles: InitializeSalonRolesHandler) {}

  async handle(event: SalonRegistered): Promise<void> {
    await this.initializeRoles.execute(new InitializeSalonRoles(event.salonId, event.occurredAt));
  }
}

