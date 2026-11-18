import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { type AuditEntry, type AuditTrail, ID_GENERATOR, type IdGenerator } from '../../application/ports.js';

/** Écrit dans `audit_log`, dans la transaction de la commande : la trace et l'effet réussissent ou échouent ensemble. */
@Injectable()
export class TypeOrmAuditTrail implements AuditTrail {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.txHost.tx.query(
      `INSERT INTO audit_log (id, salon_id, actor_user_id, action, subject_type, subject_id, details, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        this.ids.next(),
        entry.salonId ?? null,
        entry.actorUserId,
        entry.action,
        entry.subjectType,
        entry.subjectId,
        JSON.stringify(entry.details ?? {}),
        entry.occurredAt,
      ],
    );
  }
}
