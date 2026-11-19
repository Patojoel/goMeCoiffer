/** `EXPIRED` est écrit quand l'échéance passée est constatée ; avant cela, une `PENDING` échue se lit « expirée » (`isPendingAt`). */
export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];
