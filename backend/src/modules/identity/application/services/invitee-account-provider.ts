import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../shared/application/ports.js';
import { PhoneProofRequiredError } from '../../../organizations/domain/exceptions/phone-proof-required.error.js';
import { AccountStateChangedError } from '../../../organizations/domain/exceptions/account-state-changed.error.js';
import type { ProvenPhone as ProvenPhonePort } from '../../../organizations/domain/ports/phone-proofs.port.js';
import type {
  InviteeAccount,
  InviteeAccounts,
  NewAccountDetails,
} from '../../../organizations/domain/ports/invitee-accounts.port.js';
import { ProvenPhone } from './proven-phone.js';
import { User } from '../../domain/aggregates/user.js';
import { COMMON_PASSWORDS, type CommonPasswords } from '../../domain/ports/common-passwords.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/repositories/write/user.repository.js';
import { CollaboratorDetails } from '../../domain/value-objects/collaborator-details.js';

/**
 * Le compte de la personne qui accepte une invitation, dans la transaction de `AcceptInvitation` (organizations).
 * Un compte du personnel est rendu tel quel ; sinon il est créé, ou complété s'il n'était qu'un compte client léger.
 * Les détails sont vérifiés avant toute écriture.
 */
@Injectable()
export class InviteeAccountProvider implements InviteeAccounts {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(COMMON_PASSWORDS) private readonly commonPasswords: CommonPasswords,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async provide(input: {
    proven: ProvenPhonePort;
    details: NewAccountDetails | null;
    now: Date;
  }): Promise<InviteeAccount> {
    if (!(input.proven instanceof ProvenPhone)) throw new PhoneProofRequiredError();
    const { phone, provenAt } = input.proven;
    const { details, now } = input;
    const existing = await this.users.findByPhone(phone);
    if (existing?.isStaffAccount) {
      if (details) throw new AccountStateChangedError();
      return { userId: existing.id, credentialsVersion: existing.credentialsVersion, created: false };
    }
    if (!details) throw new AccountStateChangedError();

    const checked = CollaboratorDetails.create(details, phone, this.commonPasswords);
    const account = {
      name: checked.name,
      passwordHash: await this.passwords.hash(checked.password),
      provenAt,
      now,
    };
    existing?.completeAsCollaborator(account);
    const user = existing ?? User.registerCollaborator({ id: this.ids.next(), phone, ...account });
    await this.users.save(user);
    await this.audit.record({
      action: existing ? 'CLIENT_ACCOUNT_COMPLETED_AS_COLLABORATOR' : 'COLLABORATOR_ACCOUNT_CREATED',
      subjectType: 'user',
      subjectId: user.id,
      actorUserId: user.id,
      occurredAt: now,
    });
    return { userId: user.id, credentialsVersion: user.credentialsVersion, created: true };
  }
}
