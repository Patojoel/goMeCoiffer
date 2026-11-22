import { encodePathSegment } from '../../../../http/envelope.js';

export const PLATFORM_API_ROUTES = {
  roles: '/api/admin/platform-roles',
  revokeRole: (userId: string, role: string) =>
    `/api/admin/platform-roles/${encodePathSegment(userId)}/${encodePathSegment(role)}`,
} as const;
