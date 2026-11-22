import type {
  ChangeCollaboratorRole,
  CollaboratorInvited,
  CollaboratorRemoved,
  CollaboratorRoleChanged,
  InvitationCancelled,
  InviteCollaborator,
  RemoveCollaborator,
  SalonInvitations,
  SalonTeam,
  SalonTeamMember,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { TeamGateway } from '../../models/gateway/TeamGateway.js';

export class InMemoryTeamGateway implements TeamGateway {
  public invitations: SalonInvitations;
  public members: SalonTeamMember[];
  public nextError: Error | null = null;
  private counter = 10;

  constructor(initial?: { invitations?: SalonInvitations; members?: SalonTeamMember[] }) {
    this.invitations = initial?.invitations ?? [
      {
        id: '0195f000-0000-7000-8000-000000000d01',
        name: 'Sandra Kouam',
        phone: '+237670000002',
        role: 'PRACTITIONER',
        sentAt: '2026-11-19T09:00:00.000Z',
        expiresAt: '2026-11-26T09:00:00.000Z',
        status: 'PENDING',
      },
    ];
    this.members = initial?.members ?? [
      {
        membershipId: '0195f000-0000-7000-8000-000000000e01',
        name: 'Mireille Ngono',
        role: 'OWNER',
        joinedAt: '2026-11-01T08:00:00.000Z',
        isCurrentUser: true,
        version: 1,
      },
      {
        membershipId: '0195f000-0000-7000-8000-000000000e02',
        name: 'Paul Mbarga',
        role: 'HAIRDRESSER',
        joinedAt: '2026-11-05T08:00:00.000Z',
        isCurrentUser: false,
        version: 2,
      },
    ];
  }

  private assertHealthy() {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
  }

  async listInvitations(): Promise<SalonInvitations> {
    this.assertHealthy();
    return [...this.invitations];
  }

  async inviteCollaborator(input: InviteCollaborator): Promise<CollaboratorInvited> {
    this.assertHealthy();
    this.counter += 1;
    const invitationId = `0195f000-0000-7000-8000-000000000d${this.counter}`;
    const now = '2026-11-20T10:00:00.000Z';
    const expiresAt = '2026-11-27T10:00:00.000Z';
    this.invitations = [
      { id: invitationId, name: input.name, phone: input.phone, role: input.role, sentAt: now, expiresAt, status: 'PENDING' },
      ...this.invitations,
    ];
    return { invitationId, name: input.name, phone: input.phone, role: input.role, expiresAt };
  }

  async cancelInvitation(invitationId: string): Promise<InvitationCancelled> {
    this.assertHealthy();
    const exists = this.invitations.some((item) => item.id === invitationId);
    if (!exists) throw new HttpError(404, 'NOT_FOUND', 'Invitation introuvable.');
    this.invitations = this.invitations.filter((item) => item.id !== invitationId);
    return { invitationId, status: 'CANCELLED' };
  }

  async listTeam(): Promise<SalonTeam> {
    this.assertHealthy();
    return { members: [...this.members] };
  }

  async changeCollaboratorRole(
    membershipId: string,
    input: ChangeCollaboratorRole,
  ): Promise<CollaboratorRoleChanged> {
    this.assertHealthy();
    const target = this.members.find((m) => m.membershipId === membershipId);
    if (!target) throw new HttpError(404, 'NOT_FOUND', 'Collaborateur introuvable.');
    if (target.version !== input.version) {
      throw new HttpError(409, 'CONCURRENCY_CONFLICT', 'Le rôle a été modifié entre-temps.');
    }
    const nextVersion = target.version + 1;
    this.members = this.members.map((m) =>
      m.membershipId === membershipId ? { ...m, role: input.role, version: nextVersion } : m,
    );
    return { membershipId, role: input.role, version: nextVersion };
  }

  async removeCollaborator(
    membershipId: string,
    input: RemoveCollaborator,
  ): Promise<CollaboratorRemoved> {
    this.assertHealthy();
    const target = this.members.find((m) => m.membershipId === membershipId);
    if (!target) throw new HttpError(404, 'NOT_FOUND', 'Collaborateur introuvable.');
    if (target.version !== input.version) {
      throw new HttpError(409, 'CONCURRENCY_CONFLICT', 'Le collaborateur a été modifié entre-temps.');
    }
    this.members = this.members.filter((m) => m.membershipId !== membershipId);
    return { membershipId, status: 'REVOKED', version: target.version + 1 };
  }
}
