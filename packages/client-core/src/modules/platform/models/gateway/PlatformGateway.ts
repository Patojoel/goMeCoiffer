import type {
  GrantSystemRole,
  PlatformAdmins,
  SystemRole,
  SystemRoleGranted,
  SystemRoleRevoked,
} from '@gomecoiffer/contracts';

export interface PlatformGateway {
  listAdmins(): Promise<PlatformAdmins>;
  grantRole(input: GrantSystemRole): Promise<SystemRoleGranted>;
  revokeRole(userId: string, role: SystemRole): Promise<SystemRoleRevoked>;
}
