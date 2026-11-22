import {
  ClientSessionSummarySchema,
  ClientSignedInSchema,
  SignUpCodeSentSchema,
  type ClientSessionSummary,
  type ClientSignedIn,
  type RequestClientCode,
  type SignUpCodeSent,
  type VerifyClientCode,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { ClientSpaceGateway } from '../../models/gateway/ClientSpaceGateway.js';
import { CLIENT_SPACE_API_ROUTES } from '../api-routes/ClientSpaceApiRoutes.js';

export class ClientSpaceHttpGateway implements ClientSpaceGateway {
  constructor(private readonly http: HttpClient) {}

  requestCode(input: RequestClientCode): Promise<SignUpCodeSent> {
    return this.http.post(CLIENT_SPACE_API_ROUTES.requestCode, input, SignUpCodeSentSchema);
  }

  verifyCode(input: VerifyClientCode): Promise<ClientSignedIn> {
    return this.http.post(CLIENT_SPACE_API_ROUTES.verifyCode, input, ClientSignedInSchema);
  }

  getSession(): Promise<ClientSessionSummary> {
    return this.http.get(CLIENT_SPACE_API_ROUTES.session, ClientSessionSummarySchema);
  }
}
