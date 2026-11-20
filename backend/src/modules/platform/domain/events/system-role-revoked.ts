import type { DomainEvent } from '../../../../shared/domain/domain-event.js';
import type { SystemRole } from '../enums/system-role.enum.js';

/** Identifiants et code rôle seulement : jamais de nom ni de téléphone (RG-012-12, D-028). */
export class SystemRoleRevoked implements DomainEvent {
  constructor(
    readonly userId: string,
    readonly role: SystemRole,
    readonly actorUserId: string,
    readonly occurredAt: Date,
  ) {}
}

