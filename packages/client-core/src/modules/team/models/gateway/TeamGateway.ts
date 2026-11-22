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
} from '@gomecoiffer/contracts';

export interface TeamGateway {
  listInvitations(): Promise<SalonInvitations>;
  inviteCollaborator(input: InviteCollaborator): Promise<CollaboratorInvited>;
  cancelInvitation(invitationId: string): Promise<InvitationCancelled>;
  listTeam(): Promise<SalonTeam>;
  changeCollaboratorRole(
    membershipId: string,
    input: ChangeCollaboratorRole,
  ): Promise<CollaboratorRoleChanged>;
  removeCollaborator(membershipId: string, input: RemoveCollaborator): Promise<CollaboratorRemoved>;
}
