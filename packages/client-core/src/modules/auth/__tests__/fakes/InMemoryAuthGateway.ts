import type {
  ConfirmSignUp,
  RequestPasswordResetCode,
  RequestSignUpCode,
  ResetPassword,
  SessionSummary,
  SignIn,
  SignUpCodeSent,
  SignedIn,
  SignedOut,
  SignedUp,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { AuthGateway } from '../../models/gateway/AuthGateway.js';

export class InMemoryAuthGateway implements AuthGateway {
  public session: SessionSummary | null;
  public nextError: Error | null = null;
  public lastRequestedPhone: string | null = null;
  public signInCalls = 0;

  constructor(initialSession: SessionSummary | null = null) {
    this.session = initialSession;
  }

  private assertHealthy() {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
  }

  async getSession(): Promise<SessionSummary> {
    this.assertHealthy();
    if (!this.session) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Votre session a expiré.');
    }
    return this.session;
  }

  async signIn(input: SignIn): Promise<SignedIn> {
    this.signInCalls += 1;
    this.assertHealthy();
    if (input.password === 'wrong-password') {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Numéro ou mot de passe incorrect.');
    }
    const session: SessionSummary = this.session ?? {
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
      activeSalonId: '0195f000-0000-7000-8000-000000000b01',
      salons: [
        {
          id: '0195f000-0000-7000-8000-000000000b01',
          name: 'Go Beauty Bastos',
          role: 'OWNER',
          city: 'Yaoundé',
          district: 'Bastos',
        },
      ],
      permissions: ['dashboard:view', 'staff:view', 'staff:invite', 'staff:manage', 'roles:administer'],
      systemRoles: [],
      nextStep: 'OPEN_SALON',
    };
    this.session = session;
    return { csrfToken: 'csrf-signed-in', session };
  }

  async signOut(): Promise<SignedOut> {
    this.assertHealthy();
    this.session = null;
    return { signedOut: true };
  }

  async requestSignUpCode(input: RequestSignUpCode): Promise<SignUpCodeSent> {
    this.assertHealthy();
    this.lastRequestedPhone = input.phone;
    return {
      maskedPhone: '6 77 •• •• 56',
      expiresInSeconds: 300,
      resendInSeconds: 60,
    };
  }

  async confirmSignUp(input: ConfirmSignUp): Promise<SignedUp> {
    this.assertHealthy();
    if (input.code !== '123456') {
      throw new HttpError(422, 'INVALID_VERIFICATION_CODE', 'Code incorrect ou expiré.');
    }
    const userId = '0195f000-0000-7000-8000-000000000a99';
    this.session = {
      user: { id: userId, name: input.name },
      activeSalonId: null,
      salons: [],
      permissions: [],
      systemRoles: [],
      nextStep: 'CREATE_ORGANIZATION',
    };
    return { userId, nextStep: 'CREATE_ORGANIZATION', csrfToken: 'csrf-signed-up' };
  }

  async requestPasswordResetCode(input: RequestPasswordResetCode): Promise<SignUpCodeSent> {
    this.assertHealthy();
    this.lastRequestedPhone = input.phone;
    return {
      maskedPhone: '6 77 •• •• 56',
      expiresInSeconds: 300,
      resendInSeconds: 60,
    };
  }

  async resetPassword(input: ResetPassword): Promise<SignedIn> {
    this.assertHealthy();
    if (input.code !== '123456') {
      throw new HttpError(422, 'INVALID_VERIFICATION_CODE', 'Code incorrect ou expiré.');
    }
    const session: SessionSummary = this.session ?? {
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
      activeSalonId: '0195f000-0000-7000-8000-000000000b01',
      salons: [
        {
          id: '0195f000-0000-7000-8000-000000000b01',
          name: 'Go Beauty Bastos',
          role: 'OWNER',
          city: 'Yaoundé',
          district: 'Bastos',
        },
      ],
      permissions: ['dashboard:view', 'roles:administer'],
      systemRoles: [],
      nextStep: 'OPEN_SALON',
    };
    this.session = session;
    return { csrfToken: 'csrf-password-reset', session };
  }
}
