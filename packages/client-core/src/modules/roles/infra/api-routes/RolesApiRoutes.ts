import { encodePathSegment } from '../../../../http/envelope.js';

export const ROLES_API_ROUTES = {
  roles: '/api/salon/roles',
  adjustPermissions: (role: string) => `/api/salon/roles/${encodePathSegment(role)}/permissions`,
} as const;
