import { encodePathSegment } from '../../../../http/envelope.js';

export const TEAM_API_ROUTES = {
  invitations: '/api/salon/invitations',
  cancelInvitation: (invitationId: string) =>
    `/api/salon/invitations/${encodePathSegment(invitationId)}/cancellation`,
  team: '/api/salon/team',
  changeRole: (membershipId: string) => `/api/salon/team/${encodePathSegment(membershipId)}/role`,
  removeMember: (membershipId: string) => `/api/salon/team/${encodePathSegment(membershipId)}/removal`,
} as const;
