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
import { appApi, fromGateway } from '../../../../store/api/appApi.js';

export const teamApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    listSalonInvitations: build.query<SalonInvitations, void>({
      queryFn: fromGateway((deps) => deps.team.listInvitations()),
      providesTags: ['Invitations'],
    }),
    inviteCollaborator: build.mutation<CollaboratorInvited, InviteCollaborator>({
      queryFn: fromGateway((deps, input) => deps.team.inviteCollaborator(input)),
      invalidatesTags: ['Invitations'],
    }),
    cancelInvitation: build.mutation<InvitationCancelled, string>({
      queryFn: fromGateway((deps, invitationId) => deps.team.cancelInvitation(invitationId)),
      invalidatesTags: ['Invitations'],
    }),
    listSalonTeam: build.query<SalonTeam, void>({
      queryFn: fromGateway((deps) => deps.team.listTeam()),
      providesTags: ['Team'],
    }),
    changeCollaboratorRole: build.mutation<
      CollaboratorRoleChanged,
      { readonly membershipId: string; readonly body: ChangeCollaboratorRole }
    >({
      queryFn: fromGateway((deps, arg) => deps.team.changeCollaboratorRole(arg.membershipId, arg.body)),
      invalidatesTags: ['Team'],
    }),
    removeCollaborator: build.mutation<
      CollaboratorRemoved,
      { readonly membershipId: string; readonly body: RemoveCollaborator }
    >({
      queryFn: fromGateway((deps, arg) => deps.team.removeCollaborator(arg.membershipId, arg.body)),
      invalidatesTags: ['Team'],
    }),
  }),
});

export const {
  useListSalonInvitationsQuery,
  useInviteCollaboratorMutation,
  useCancelInvitationMutation,
  useListSalonTeamQuery,
  useChangeCollaboratorRoleMutation,
  useRemoveCollaboratorMutation,
} = teamApi;
