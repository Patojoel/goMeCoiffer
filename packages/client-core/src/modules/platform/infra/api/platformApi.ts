import type {
  GrantSystemRole,
  PlatformAdmins,
  SystemRole,
  SystemRoleGranted,
  SystemRoleRevoked,
} from '@gomecoiffer/contracts';
import { appApi, fromGateway } from '../../../../store/api/appApi.js';

export const platformApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    listPlatformAdmins: build.query<PlatformAdmins, void>({
      queryFn: fromGateway((deps) => deps.platform.listAdmins()),
      providesTags: ['PlatformAdmins'],
    }),
    grantSystemRole: build.mutation<SystemRoleGranted, GrantSystemRole>({
      queryFn: fromGateway((deps, input) => deps.platform.grantRole(input)),
      invalidatesTags: ['PlatformAdmins'],
    }),
    revokeSystemRole: build.mutation<
      SystemRoleRevoked,
      { readonly userId: string; readonly role: SystemRole }
    >({
      queryFn: fromGateway((deps, arg) => deps.platform.revokeRole(arg.userId, arg.role)),
      invalidatesTags: ['PlatformAdmins'],
    }),
  }),
});

export const {
  useListPlatformAdminsQuery,
  useGrantSystemRoleMutation,
  useRevokeSystemRoleMutation,
} = platformApi;
