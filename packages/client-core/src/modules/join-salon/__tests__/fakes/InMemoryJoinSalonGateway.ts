import type {
  InvitationAccepted,
  InvitationPhoneProven,
  InvitationsForProvenPhone,
  ProveInvitationPhone,
  RequestInvitationCode,
  SignUpCodeSent,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { AcceptInvitationWire, JoinSalonGateway } from '../../models/gateway/JoinSalonGateway.js';

export class InMemoryJoinSalonGateway implements JoinSalonGateway {
  public proven = false;
  public account: InvitationsForProvenPhone['account'];
  public invitations: InvitationsForProvenPhone['invitations'];
  public nextError: Error | null = null;

  constructor(initial?: Partial<InvitationsForProvenPhone>) {
    this.account = initial?.account ?? 'NEW';
    this.invitations = initial?.invitations ?? [
      {
        invitationId: '0195f000-0000-7000-8000-000000000d10',
        salonName: 'Go Beauty Bastos',
        city: 'Yaoundé',
        district: 'Bastos',
        role: 'HAIRDRESSER',
        expiresAt: '2026-11-27T10:00:00.000Z',
        suggestedName: 'Paul Mbarga',
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

  async requestCode(_input: RequestInvitationCode): Promise<SignUpCodeSent> {
    this.assertHealthy();
    return { maskedPhone: '6 70 •• •• 02', expiresInSeconds: 300, resendInSeconds: 60 };
  }

  async provePhone(input: ProveInvitationPhone): Promise<InvitationPhoneProven> {
    this.assertHealthy();
    if (input.code !== '123456') {
      throw new HttpError(422, 'INVALID_VERIFICATION_CODE', 'Code incorrect ou expiré.');
    }
    this.proven = true;
    return { provenUntil: '2026-11-21T15:00:00.000Z' };
  }

  async listProvenInvitations(): Promise<InvitationsForProvenPhone> {
    this.assertHealthy();
    if (!this.proven) {
      throw new HttpError(403, 'PHONE_PROOF_REQUIRED', 'Confirmez d’abord votre numéro par code SMS.');
    }
    return { account: this.account, invitations: [...this.invitations] };
  }

  async acceptInvitation(invitationId: string, input: AcceptInvitationWire): Promise<InvitationAccepted> {
    this.assertHealthy();
    const target = this.invitations.find((inv) => inv.invitationId === invitationId);
    if (!target) {
      throw new HttpError(404, 'NOT_FOUND', 'Invitation introuvable.');
    }
    this.invitations = this.invitations.filter((inv) => inv.invitationId !== invitationId);
    if (this.account === 'EXISTING' && !('name' in input)) {
      return { outcome: 'SIGN_IN_REQUIRED', salonName: target.salonName };
    }
    const name = 'name' in input ? input.name : target.suggestedName;
    return {
      outcome: 'SIGNED_IN',
      salonName: target.salonName,
      csrfToken: 'csrf-invitation-accepted',
      session: {
        user: { id: '0195f000-0000-7000-8000-000000000a20', name },
        activeSalonId: '0195f000-0000-7000-8000-000000000b01',
        salons: [
          {
            id: '0195f000-0000-7000-8000-000000000b01',
            name: target.salonName,
            role: target.role,
            city: target.city,
            district: target.district,
          },
        ],
        permissions: ['bookings:view-own', 'availability:edit-own'],
        systemRoles: [],
        nextStep: 'OPEN_SALON',
      },
    };
  }
}
