/** Les trois rôles système GoMeCoiffer (PRD §4, D-058). Jamais mélangés aux rôles salon. */
export const SystemRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPERATIONS_ADMIN: 'OPERATIONS_ADMIN',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
} as const;

export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const SYSTEM_ROLES = [
  SystemRole.SUPER_ADMIN,
  SystemRole.OPERATIONS_ADMIN,
  SystemRole.FINANCE_ADMIN,
] as const;

const SYSTEM_ROLE_SET: ReadonlySet<string> = new Set(SYSTEM_ROLES);

export function isSystemRole(value: string): value is SystemRole {
  return SYSTEM_ROLE_SET.has(value);
}

