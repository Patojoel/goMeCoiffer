import { encodePathSegment } from '../../../../http/envelope.js';

export const JOIN_SALON_API_ROUTES = {
  requestCode: '/api/public/invitations/code',
  provePhone: '/api/public/invitations/phone-proof',
  invitations: '/api/public/invitations',
  accept: (invitationId: string) => `/api/public/invitations/${encodePathSegment(invitationId)}/acceptance`,
} as const;
