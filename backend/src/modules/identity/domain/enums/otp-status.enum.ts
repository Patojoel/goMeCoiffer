/** Un défi actif est consommé par le bon code, ou remplacé par un défi plus récent. */
export const OtpStatus = {
  ACTIVE: 'ACTIVE',
  CONSUMED: 'CONSUMED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type OtpStatus = (typeof OtpStatus)[keyof typeof OtpStatus];
