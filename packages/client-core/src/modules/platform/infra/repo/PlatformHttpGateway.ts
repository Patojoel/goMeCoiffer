import {
  PlatformAdminsSchema,
  SystemRoleGrantedSchema,
  SystemRoleRevokedSchema,
  type GrantSystemRole,
  type PlatformAdmins,
  type SystemRole,
  type SystemRoleGranted,
  type SystemRoleRevoked,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { PlatformGateway } from '../../models/gateway/PlatformGateway.js';
import { PLATFORM_API_ROUTES } from '../api-routes/PlatformApiRoutes.js';

export class PlatformHttpGateway implements PlatformGateway {
  constructor(private readonly http: HttpClient) {}

  listAdmins(): Promise<PlatformAdmins> {
    return this.http.get(PLATFORM_API_ROUTES.roles, PlatformAdminsSchema);
  }

  grantRole(input: GrantSystemRole): Promise<SystemRoleGranted> {
    return this.http.post(PLATFORM_API_ROUTES.roles, input, SystemRoleGrantedSchema);
  }

  revokeRole(userId: string, role: SystemRole): Promise<SystemRoleRevoked> {
    return this.http.delete(PLATFORM_API_ROUTES.revokeRole(userId, role), SystemRoleRevokedSchema);
  }
}
