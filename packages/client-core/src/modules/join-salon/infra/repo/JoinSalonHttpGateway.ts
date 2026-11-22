import {
  InvitationAcceptedSchema,
  InvitationPhoneProvenSchema,
  InvitationsForProvenPhoneSchema,
  SignUpCodeSentSchema,
  type InvitationAccepted,
  type InvitationPhoneProven,
  type InvitationsForProvenPhone,
  type ProveInvitationPhone,
  type RequestInvitationCode,
  type SignUpCodeSent,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { AcceptInvitationWire, JoinSalonGateway } from '../../models/gateway/JoinSalonGateway.js';
import { JOIN_SALON_API_ROUTES } from '../api-routes/JoinSalonApiRoutes.js';

export class JoinSalonHttpGateway implements JoinSalonGateway {
  constructor(private readonly http: HttpClient) {}

  requestCode(input: RequestInvitationCode): Promise<SignUpCodeSent> {
    return this.http.post(JOIN_SALON_API_ROUTES.requestCode, input, SignUpCodeSentSchema);
  }

  provePhone(input: ProveInvitationPhone): Promise<InvitationPhoneProven> {
    return this.http.post(JOIN_SALON_API_ROUTES.provePhone, input, InvitationPhoneProvenSchema);
  }

  listProvenInvitations(): Promise<InvitationsForProvenPhone> {
    return this.http.get(JOIN_SALON_API_ROUTES.invitations, InvitationsForProvenPhoneSchema);
  }

  acceptInvitation(invitationId: string, input: AcceptInvitationWire): Promise<InvitationAccepted> {
    return this.http.post(JOIN_SALON_API_ROUTES.accept(invitationId), input, InvitationAcceptedSchema);
  }
}
