/** Catalogue provisoire des permissions du salon (`module:action`, PRD §6), figé par UC-008. */
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

/** Droits protégés du propriétaire (PRD §5.1, §5.2) : aucun autre rôle ne les reçoit. */
export const ProtectedOwnerRight = {
  MANAGE_SALONS: 'organization:manage-salons',
  MANAGE_SUBSCRIPTION: 'subscription:manage',
  MANAGE_PAYOUT_ACCOUNTS: 'payout-accounts:manage',
} as const;
export type ProtectedOwnerRight = (typeof ProtectedOwnerRight)[keyof typeof ProtectedOwnerRight];
