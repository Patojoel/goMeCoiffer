import type {
  AdjustRolePermissions,
  AdjustableSalonRole,
  RolePermissionsAdjusted,
  SalonRoles,
} from '@gomecoiffer/contracts';
import { appApi, fromGateway } from '../../../../store/api/appApi.js';

export const rolesApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    getSalonRoles: build.query<SalonRoles, void>({
      queryFn: fromGateway((deps) => deps.roles.getRoles()),
      providesTags: ['SalonRoles'],
    }),
    adjustRolePermissions: build.mutation<
      RolePermissionsAdjusted,
      { readonly role: AdjustableSalonRole; readonly body: AdjustRolePermissions }
    >({
      queryFn: fromGateway((deps, arg) => deps.roles.adjustRolePermissions(arg.role, arg.body)),
      invalidatesTags: ['SalonRoles', 'Session'],
    }),
  }),
});

export const { useGetSalonRolesQuery, useAdjustRolePermissionsMutation } = rolesApi;
