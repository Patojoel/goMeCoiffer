export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];
