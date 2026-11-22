import {
  CollaboratorInvitedSchema,
  CollaboratorRemovedSchema,
  CollaboratorRoleChangedSchema,
  InvitationCancelledSchema,
  SalonInvitationsSchema,
  SalonTeamSchema,
  type ChangeCollaboratorRole,
  type CollaboratorInvited,
  type CollaboratorRemoved,
  type CollaboratorRoleChanged,
  type InvitationCancelled,
  type InviteCollaborator,
  type RemoveCollaborator,
  type SalonInvitations,
  type SalonTeam,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { TeamGateway } from '../../models/gateway/TeamGateway.js';
import { TEAM_API_ROUTES } from '../api-routes/TeamApiRoutes.js';

export class TeamHttpGateway implements TeamGateway {
  constructor(private readonly http: HttpClient) {}

  listInvitations(): Promise<SalonInvitations> {
    return this.http.get(TEAM_API_ROUTES.invitations, SalonInvitationsSchema);
  }

  inviteCollaborator(input: InviteCollaborator): Promise<CollaboratorInvited> {
    return this.http.post(TEAM_API_ROUTES.invitations, input, CollaboratorInvitedSchema);
  }

  cancelInvitation(invitationId: string): Promise<InvitationCancelled> {
    return this.http.post(TEAM_API_ROUTES.cancelInvitation(invitationId), undefined, InvitationCancelledSchema);
  }

  listTeam(): Promise<SalonTeam> {
    return this.http.get(TEAM_API_ROUTES.team, SalonTeamSchema);
  }

  changeCollaboratorRole(
    membershipId: string,
    input: ChangeCollaboratorRole,
  ): Promise<CollaboratorRoleChanged> {
    return this.http.put(TEAM_API_ROUTES.changeRole(membershipId), input, CollaboratorRoleChangedSchema);
  }

  removeCollaborator(membershipId: string, input: RemoveCollaborator): Promise<CollaboratorRemoved> {
    return this.http.post(TEAM_API_ROUTES.removeMember(membershipId), input, CollaboratorRemovedSchema);
  }
}
