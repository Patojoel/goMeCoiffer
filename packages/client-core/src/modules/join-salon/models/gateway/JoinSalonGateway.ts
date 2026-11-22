import type {
  InvitationAccepted,
  InvitationPhoneProven,
  InvitationsForProvenPhone,
  ProveInvitationPhone,
  RequestInvitationCode,
  SignUpCodeSent,
} from '@gomecoiffer/contracts';

export type AcceptInvitationWire =
  | Record<string, never>
  | { readonly name: string; readonly password: string; readonly termsAccepted: true };

export interface JoinSalonGateway {
  requestCode(input: RequestInvitationCode): Promise<SignUpCodeSent>;
  provePhone(input: ProveInvitationPhone): Promise<InvitationPhoneProven>;
  listProvenInvitations(): Promise<InvitationsForProvenPhone>;
  acceptInvitation(invitationId: string, input: AcceptInvitationWire): Promise<InvitationAccepted>;
}
