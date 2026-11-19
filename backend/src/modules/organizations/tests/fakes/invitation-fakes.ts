import { ConcurrencyConflictError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { AfterCommit } from '../../../../shared/application/after-commit.js';
import { Invitation } from '../../domain/aggregates/invitation.js';
import { InvitationAlreadyPendingError } from '../../domain/exceptions/invitation-already-pending.error.js';
import { InvitationNotFoundError } from '../../domain/exceptions/invitation-not-found.error.js';
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
