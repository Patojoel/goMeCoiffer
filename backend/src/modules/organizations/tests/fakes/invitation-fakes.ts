import { ConcurrencyConflictError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { AfterCommit } from '../../../../shared/application/after-commit.js';
import { Invitation } from '../../domain/aggregates/invitation.js';
import { InvitationAlreadyPendingError } from '../../domain/exceptions/invitation-already-pending.error.js';
import { AccountStateChangedError } from '../../domain/exceptions/account-state-changed.error.js';
import { InvitationNotFoundError } from '../../domain/exceptions/invitation-not-found.error.js';
import type {
  InviteeAccount,
  InviteeAccounts,
  NewAccountDetails,
} from '../../domain/ports/invitee-accounts.port.js';
import type { PhoneProofs, ProvenPhone } from '../../domain/ports/phone-proofs.port.js';
import type { InvitationNotifier } from '../../domain/ports/invitation-notifier.port.js';
import type { InvitationChecks } from '../../domain/repositories/read/invitation-checks.read-repository.js';
import type { InvitationRepository } from '../../domain/repositories/write/invitation.repository.js';

type Row = ReturnType<Invitation['snapshot']>;

/** Comme la base : une seule invitation en attente par (salon, numéro), verrou optimiste, périmètre salon. */
export class InMemoryInvitationRepository implements InvitationRepository {
  readonly rows = new Map<string, Row>();

  async add(invitation: Invitation): Promise<void> {
    const row = invitation.snapshot();
    const clash = this.all().some(
      (r) =>
        r.status === 'PENDING' &&
        row.status === 'PENDING' &&
        r.salonId === row.salonId &&
        r.phone === row.phone,
    );
    if (clash) throw new InvitationAlreadyPendingError();
    this.rows.set(row.id, { ...row, version: 1 });
  }

  async save(invitation: Invitation): Promise<void> {
    const row = invitation.snapshot();
    if (this.rows.get(row.id)?.version !== row.version)
      throw new ConcurrencyConflictError('Invitation', row.id);
    this.rows.set(row.id, { ...row, version: row.version + 1 });
  }

  async getOfSalon(salonId: string, id: string): Promise<Invitation> {
    const row = this.rows.get(id);
    if (!row || row.salonId !== salonId) throw new InvitationNotFoundError();
    return Invitation.restore(row);
  }

  /** Comme la requête : le numéro de l'invitation, ou le compte de ce numéro qui l'a déjà acceptée. */
  async getOfInvitee(phone: PhoneNumber, id: string): Promise<Invitation> {
    const row = this.rows.get(id);
    const acceptedBy = row?.acceptedByUserId ?? null;
    const mine =
      row?.phone === phone.value ||
      (acceptedBy !== null && this.accountPhones.get(acceptedBy) === phone.value);
    if (!row || !mine) throw new InvitationNotFoundError();
    return Invitation.restore(row);
  }

  /** Les comptes dont le test a besoin pour retrouver une invitation acceptée (son numéro est effacé). */
  readonly accountPhones = new Map<string, string>();

  async findPendingOfPhone(salonId: string, phone: PhoneNumber): Promise<Invitation | null> {
    const row = this.all().find(
      (r) => r.status === 'PENDING' && r.salonId === salonId && r.phone === phone.value,
    );
    return row ? Invitation.restore(row) : null;
  }

  async purgePersonalDataEndedBefore(before: Date): Promise<number> {
    const due = this.all().filter(
      (r) => r.status !== 'ACCEPTED' && r.name !== null && (r.endedAt ?? r.expiresAt) <= before,
    );
    for (const row of due)
      this.rows.set(row.id, {
        ...row,
        name: null,
        phone: null,
        status: row.status === 'PENDING' ? 'EXPIRED' : row.status,
        endedAt: row.endedAt ?? row.expiresAt,
        version: row.version + 1,
      });
    return due.length;
  }

  all(): Row[] {
    return [...this.rows.values()];
  }

  ofSalon(salonId: string): Row[] {
    return this.all().filter((r) => r.salonId === salonId);
  }
}

/** Preuves de numéro déclarées par le test : jeton → numéro et échéance. */
export class InMemoryPhoneProofs implements PhoneProofs {
  private readonly proofs = new Map<string, { phone: string; provenAt: Date; expiresAt: Date }>();

  prove(token: string, phone: string, provenAt: Date, validMinutes = 15): this {
    this.proofs.set(token, {
      phone,
      provenAt,
      expiresAt: new Date(provenAt.getTime() + validMinutes * 60_000),
    });
    return this;
  }

  /** Numéros dont les preuves ont été oubliées après la dernière acceptation. */
  readonly forgotten: string[] = [];

  async forgetProofsOf(proven: ProvenPhone) {
    this.forgotten.push(proven.phone.value);
    for (const [token, proof] of this.proofs) if (proof.phone === proven.phone.value) this.proofs.delete(token);
  }

  async phoneProvenBy(token: string | null, now: Date) {
    const proof = token === null ? undefined : this.proofs.get(token);
    if (!proof || now >= proof.expiresAt) return null;
    return { phone: PhoneNumber.parse(proof.phone), provenAt: proof.provenAt };
  }
}

/** Comptes connus, un par numéro ; sans détails le compte doit exister, avec détails il ne doit pas exister. */
export class InMemoryInviteeAccounts implements InviteeAccounts {
  readonly provided: Array<{ phone: string; details: NewAccountDetails | null; provenAt: Date }> = [];
  private readonly accounts = new Map<string, { userId: string; credentialsVersion: number }>();
  private created = 0;

  withStaffAccount(phone: string, userId: string, credentialsVersion = 1): this {
    this.accounts.set(phone, { userId, credentialsVersion });
    return this;
  }

  idOf(phone: string): string | undefined {
    return this.accounts.get(phone)?.userId;
  }

  async provide(input: { proven: ProvenPhone; details: NewAccountDetails | null }): Promise<InviteeAccount> {
    const input2 = { phone: input.proven.phone, details: input.details, provenAt: input.proven.provenAt };
    this.provided.push({ phone: input2.phone.value, details: input2.details, provenAt: input2.provenAt });
    const existing = this.accounts.get(input2.phone.value);
    if (existing && input.details) throw new AccountStateChangedError();
    if (existing) return { ...existing, created: false };
    if (!input.details) throw new AccountStateChangedError();
    this.created += 1;
    const userId = `0195f000-0000-7000-8000-0000000a${String(this.created).padStart(4, '0')}`;
    const account = { userId, credentialsVersion: 1 };
    this.accounts.set(input2.phone.value, account);
    return { ...account, created: true };
  }
}

/** Lectures calculées sur le repository d'invitations ; les membres et les salons sont déclarés par le test. */
export class InMemoryInvitationChecks implements InvitationChecks {
  readonly locks: string[] = [];
  private readonly members = new Set<string>();
  private readonly salons = new Map<string, { name: string; timezone: string }>();

  constructor(private readonly invitations: InMemoryInvitationRepository) {}

  async lockSalon(salonId: string) {
    this.locks.push(`salon:${salonId}`);
  }

  async lockPhone(phone: PhoneNumber) {
    this.locks.push(`phone:${phone.value}`);
  }

  withSalon(salonId: string, name: string): this {
    this.salons.set(salonId, { name, timezone: 'Africa/Douala' });
    return this;
  }

  withMember(salonId: string, phone: string): this {
    this.members.add(`${salonId}|${phone}`);
    return this;
  }

  async isActiveMember(salonId: string, phone: PhoneNumber) {
    return this.members.has(`${salonId}|${phone.value}`);
  }

  async invitationsSentSince(salonId: string, since: Date) {
    return this.invitations.ofSalon(salonId).filter((r) => r.sentAt >= since).length;
  }

  async hasPendingInvitation(phone: PhoneNumber, now: Date) {
    return this.invitations
      .all()
      .some((r) => r.phone === phone.value && r.status === 'PENDING' && r.expiresAt > now);
  }

  async pendingCount(salonId: string, now: Date) {
    return this.invitations.ofSalon(salonId).filter((r) => r.status === 'PENDING' && r.expiresAt > now)
      .length;
  }

  async textMessagesSentSince(phone: PhoneNumber, since: Date) {
    return new Set(
      this.invitations
        .all()
        .filter((r) => r.notifiedBySms && r.phone === phone.value && r.sentAt >= since)
        .map((r) => r.salonId),
    ).size;
  }

  async salonOf(salonId: string) {
    const salon = this.salons.get(salonId);
    if (!salon) throw new Error(`Salon inconnu du test : ${salonId}`);
    return salon;
  }
}

export class InMemoryInvitationNotifier implements InvitationNotifier {
  readonly sent: { to: string; text: string }[] = [];
  outage = false;

  async send(to: PhoneNumber, text: string): Promise<void> {
    if (this.outage) throw new Error(`Fournisseur SMS indisponible pour ${to.value}`);
    this.sent.push({ to: to.value, text });
  }
}

/** Le « commit » est déclenché par le test : `commit()` exécute les actions enregistrées, comme le bus après le commit. */
export class FakeAfterCommit {
  private readonly pending: Array<() => unknown> = [];

  register(callback: () => unknown) {
    this.pending.push(callback);
  }

  registerDetached(callback: () => unknown) {
    this.pending.push(callback);
  }

  async commit() {
    await Promise.all(this.pending.splice(0).map((callback) => callback()));
  }

  asAfterCommit() {
    return this as unknown as AfterCommit;
  }
}
