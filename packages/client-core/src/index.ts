export { codeToMessage, resolveApiErrorMessage } from './http/codeToMessage.js';
export { assertSafeApiPath, parseApiEnvelope } from './http/envelope.js';
export type { HttpClient } from './http/HttpClient.js';
export { HttpError, toApiFailure, type ApiFailure } from './http/HttpError.js';

export type { TokenStorage } from './storage/TokenStorage.js';

export {
  createRealtimeClient,
  type RealtimeClient,
  type RealtimeClientOptions,
  type RealtimeSource,
  type RealtimeSourceCallbacks,
} from './realtime/RealtimeSource.js';

export {
  can,
  canAccessSalonSpace,
  hasSystemRole,
  resolveHomeTarget,
  type HomeTarget,
} from './rbac/can.js';
export {
  activeSalonChanged,
  clientSessionStateFrom,
  selectActiveSalon,
  selectActiveSalonId,
  selectExpiredSessionKind,
  selectHasPermission,
  selectHasSystemRole,
  selectIsAuthenticated,
  selectNextStep,
  selectSalons,
  selectSession,
  selectSessionKind,
  selectUserName,
  sessionCleared,
  sessionExpired,
  sessionSlice,
  sessionStarted,
  sessionStateFromSummary,
  type SessionKind,
  type SessionSalon,
  type SessionState,
} from './rbac/sessionSlice.js';

export {
  formatCameroonPhone,
  formatDateFr,
  formatDateTimeInZone,
  formatIsoDateToDisplayFr,
  formatTimeInZone,
  formatXaf,
  normalizeCameroonPhone,
  parseIsoDateParts,
  toIsoDateString,
  type IsoDateParts,
} from './format/format.js';

export {
  getLocale,
  setLocale,
  t,
  type Dictionary,
  type Locale,
  type MessageKey,
} from './i18n/i18n.js';

export {
  API_TAGS,
  appApi,
  fromGateway,
  invalidateAllReads,
  purgeApiCache,
} from './store/api/appApi.js';
export { createAppAsyncThunk } from './store/createAppAsyncThunk.js';
export type { AppDependencies } from './store/dependencies/AppDependencies.js';
export { reducer, type RootState } from './store/reducer.js';
export {
  createCoreStore,
  setupListeners,
  type CoreDispatch,
  type CoreStore,
} from './store/store.js';

export { HEALTH_API_ROUTES } from './modules/health/infra/api-routes/HealthApiRoutes.js';
export { healthApi, useGetHealthQuery } from './modules/health/infra/api/healthApi.js';
export type { HealthGateway } from './modules/health/models/gateway/HealthGateway.js';

export { AUTH_API_ROUTES } from './modules/auth/infra/api-routes/AuthApiRoutes.js';
export {
  authApi,
  useConfirmSignUpMutation,
  useGetStaffSessionQuery,
  useRequestPasswordResetCodeMutation,
  useRequestSignUpCodeMutation,
  useResetPasswordMutation,
  useSignInMutation,
  useSignOutMutation,
} from './modules/auth/infra/api/authApi.js';
export type { AuthGateway } from './modules/auth/models/gateway/AuthGateway.js';

export { SALONS_API_ROUTES } from './modules/salons/infra/api-routes/SalonsApiRoutes.js';
export {
  salonsApi,
  useAddSalonMutation,
  useCreateOrganizationMutation,
  useSelectActiveSalonMutation,
} from './modules/salons/infra/api/salonsApi.js';
export type { SalonsGateway } from './modules/salons/models/gateway/SalonsGateway.js';
export {
  TIME_SLOTS_30MIN,
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  applyHoursToWeekdays,
  createDefaultWeeklySchedule,
  formatWeeklyScheduleSummary,
  isValidTimeString,
  parseMinutes,
  updateDaySchedule,
  validateDaySchedule,
  validateWeeklySchedule,
  type DaySchedule,
  type ScheduleValidationError,
  type WeekDayKey,
  type WeeklySchedule,
} from './modules/salons/models/schedule/weeklySchedule.js';

export { TEAM_API_ROUTES } from './modules/team/infra/api-routes/TeamApiRoutes.js';
export {
  teamApi,
  useCancelInvitationMutation,
  useChangeCollaboratorRoleMutation,
  useInviteCollaboratorMutation,
  useListSalonInvitationsQuery,
  useListSalonTeamQuery,
  useRemoveCollaboratorMutation,
} from './modules/team/infra/api/teamApi.js';
export type { TeamGateway } from './modules/team/models/gateway/TeamGateway.js';

export { JOIN_SALON_API_ROUTES } from './modules/join-salon/infra/api-routes/JoinSalonApiRoutes.js';
export {
  joinSalonApi,
  useAcceptInvitationMutation,
  useListProvenInvitationsQuery,
  useProveInvitationPhoneMutation,
  useRequestInvitationCodeMutation,
} from './modules/join-salon/infra/api/joinSalonApi.js';
export type {
  AcceptInvitationWire,
  JoinSalonGateway,
} from './modules/join-salon/models/gateway/JoinSalonGateway.js';

export { ROLES_API_ROUTES } from './modules/roles/infra/api-routes/RolesApiRoutes.js';
export {
  rolesApi,
  useAdjustRolePermissionsMutation,
  useGetSalonRolesQuery,
} from './modules/roles/infra/api/rolesApi.js';
export type { RolesGateway } from './modules/roles/models/gateway/RolesGateway.js';
export {
  REQUIRED_VIEW_BY_ACTION,
  applyPermissionToggleWithDependencies,
} from './modules/roles/models/permissionDependencies.js';

export { CLIENT_SPACE_API_ROUTES } from './modules/client-space/infra/api-routes/ClientSpaceApiRoutes.js';
export {
  clientSpaceApi,
  useGetClientSessionQuery,
  useRequestClientCodeMutation,
  useVerifyClientCodeMutation,
} from './modules/client-space/infra/api/clientSpaceApi.js';
export type { ClientSpaceGateway } from './modules/client-space/models/gateway/ClientSpaceGateway.js';

export { PLATFORM_API_ROUTES } from './modules/platform/infra/api-routes/PlatformApiRoutes.js';
export {
  platformApi,
  useGrantSystemRoleMutation,
  useListPlatformAdminsQuery,
  useRevokeSystemRoleMutation,
} from './modules/platform/infra/api/platformApi.js';
export type { PlatformGateway } from './modules/platform/models/gateway/PlatformGateway.js';
