import type {
  ClientSessionSummary,
  ClientSignedIn,
  RequestClientCode,
  SignUpCodeSent,
  VerifyClientCode,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { ClientSpaceGateway } from '../../models/gateway/ClientSpaceGateway.js';

export class InMemoryClientSpaceGateway implements ClientSpaceGateway {
  public currentSession: ClientSessionSummary | null;
  public nextError: Error | null = null;

  constructor(initialSession: ClientSessionSummary | null = null) {
    this.currentSession = initialSession;
  }

  private assertHealthy() {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
  }

  async requestCode(_input: RequestClientCode): Promise<SignUpCodeSent> {
    this.assertHealthy();
    return { maskedPhone: '6 55 •• •• 22', expiresInSeconds: 300, resendInSeconds: 60 };
  }

  async verifyCode(input: VerifyClientCode): Promise<ClientSignedIn> {
    this.assertHealthy();
    if (input.code !== '123456') {
      throw new HttpError(422, 'INVALID_VERIFICATION_CODE', 'Code SMS incorrect ou expiré.');
    }
    this.currentSession = { kind: 'CLIENT', maskedPhone: '6 55 •• •• 22' };
    return {
      csrfToken: 'csrf-client-session',
      session: { kind: 'CLIENT', maskedPhone: '6 55 •• •• 22' },
    };
  }

  async getSession(): Promise<ClientSessionSummary> {
    this.assertHealthy();
    if (!this.currentSession) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Session client expirée.');
    }
    return this.currentSession;
  }
}
