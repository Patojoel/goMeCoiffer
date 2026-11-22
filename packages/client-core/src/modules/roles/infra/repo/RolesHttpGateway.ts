import {
  RolePermissionsAdjustedSchema,
  SalonRolesSchema,
  type AdjustRolePermissions,
  type AdjustableSalonRole,
  type RolePermissionsAdjusted,
  type SalonRoles,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { RolesGateway } from '../../models/gateway/RolesGateway.js';
import { ROLES_API_ROUTES } from '../api-routes/RolesApiRoutes.js';

export class RolesHttpGateway implements RolesGateway {
  constructor(private readonly http: HttpClient) {}

  getRoles(): Promise<SalonRoles> {
    return this.http.get(ROLES_API_ROUTES.roles, SalonRolesSchema);
  }

  adjustRolePermissions(
    role: AdjustableSalonRole,
    input: AdjustRolePermissions,
  ): Promise<RolePermissionsAdjusted> {
    return this.http.put(ROLES_API_ROUTES.adjustPermissions(role), input, RolePermissionsAdjustedSchema);
  }
}
