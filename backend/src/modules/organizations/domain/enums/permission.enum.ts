export const ADJUSTABLE_SALON_ROLES = [
  'SALON_ADMIN',
  'HAIRDRESSER',
  'FINANCE_MANAGER',
  'PRACTITIONER',
] as const;
export type AdjustableSalonRole = (typeof ADJUSTABLE_SALON_ROLES)[number];

/** Catalogue des 17 permissions du salon (`module:action`, PRD §6, RG-008-02). */
export const Permission = {
  DASHBOARD_VIEW: 'dashboard:view',
  BOOKINGS_VIEW_OWN: 'bookings:view-own',
  BOOKINGS_VIEW_ALL: 'bookings:view-all',
  BOOKINGS_MANAGE: 'bookings:manage',
  AVAILABILITY_EDIT_OWN: 'availability:edit-own',
  AVAILABILITY_MANAGE_TEAM: 'availability:manage-team',
  SERVICES_VIEW: 'services:view',
  SERVICES_MANAGE: 'services:manage',
  STAFF_VIEW: 'staff:view',
  STAFF_INVITE: 'staff:invite',
  STAFF_MANAGE: 'staff:manage',
  FINANCES_VIEW: 'finances:view',
  FINANCES_RECORD_PAYMENT: 'finances:record-payment',
  FINANCES_EXPORT: 'finances:export',
  SALON_SETTINGS_VIEW: 'salon-settings:view',
  SALON_SETTINGS_EDIT: 'salon-settings:edit',
  ROLES_ADMINISTER: 'roles:administer',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/** Les 16 permissions ajustables du salon (RG-008-02). `roles:administer` reste réservé au propriétaire. */
export const ADJUSTABLE_PERMISSIONS = [
  Permission.DASHBOARD_VIEW,
  Permission.BOOKINGS_VIEW_OWN,
  Permission.BOOKINGS_VIEW_ALL,
  Permission.BOOKINGS_MANAGE,
  Permission.AVAILABILITY_EDIT_OWN,
  Permission.AVAILABILITY_MANAGE_TEAM,
  Permission.SERVICES_VIEW,
  Permission.SERVICES_MANAGE,
  Permission.STAFF_VIEW,
  Permission.STAFF_INVITE,
  Permission.STAFF_MANAGE,
  Permission.FINANCES_VIEW,
  Permission.FINANCES_RECORD_PAYMENT,
  Permission.FINANCES_EXPORT,
  Permission.SALON_SETTINGS_VIEW,
  Permission.SALON_SETTINGS_EDIT,
] as const;
export type AdjustablePermission = (typeof ADJUSTABLE_PERMISSIONS)[number];

/** Les 17 permissions du salon dans l'ordre canonique du catalogue. */
export const SALON_PERMISSIONS = [...ADJUSTABLE_PERMISSIONS, Permission.ROLES_ADMINISTER] as const;

/** Droits protégés du propriétaire de l'organisation (PRD §5.1, §5.2). */
export const ProtectedOwnerRight = {
  MANAGE_SALONS: 'organization:manage-salons',
  MANAGE_SUBSCRIPTION: 'subscription:manage',
  MANAGE_PAYOUT_ACCOUNTS: 'payout-accounts:manage',
} as const;
export type ProtectedOwnerRight = (typeof ProtectedOwnerRight)[keyof typeof ProtectedOwnerRight];

export const PROTECTED_OWNER_RIGHTS = [
  ProtectedOwnerRight.MANAGE_SALONS,
  ProtectedOwnerRight.MANAGE_SUBSCRIPTION,
  ProtectedOwnerRight.MANAGE_PAYOUT_ACCOUNTS,
] as const;

/** Droits réservés au propriétaire, jamais donnés à un autre rôle (RG-008-04). */
export const ReservedOwnerRight = {
  ROLES_ADMINISTER: Permission.ROLES_ADMINISTER,
  ...ProtectedOwnerRight,
} as const;
export type ReservedOwnerRight = (typeof ReservedOwnerRight)[keyof typeof ReservedOwnerRight];

export const RESERVED_OWNER_RIGHTS = [
  Permission.ROLES_ADMINISTER,
  ...PROTECTED_OWNER_RIGHTS,
] as const;
