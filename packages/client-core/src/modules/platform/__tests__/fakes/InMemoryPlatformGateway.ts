import type {
  GrantSystemRole,
  PlatformAdminSummary,
  PlatformAdmins,
  SystemRole,
  SystemRoleGranted,
  SystemRoleRevoked,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { PlatformGateway } from '../../models/gateway/PlatformGateway.js';

export class InMemoryPlatformGateway implements PlatformGateway {
  public admins: PlatformAdminSummary[];
  public nextError: Error | null = null;

  constructor(initialAdmins?: PlatformAdminSummary[]) {
    this.admins = initialAdmins ?? [
      {
        userId: '0195f000-0000-7000-8000-000000000f01',
        name: 'Jean-Paul Kouam',
        maskedPhone: '6 99 •• •• 01',
        roles: [{ role: 'SUPER_ADMIN', grantedAt: '2026-11-01T08:00:00.000Z' }],
      },
    ];
  }

  private assertHealthy() {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
  }

  async listAdmins(): Promise<PlatformAdmins> {
    this.assertHealthy();
    const superAdminCount = this.admins.filter((a) =>
      a.roles.some((r) => r.role === 'SUPER_ADMIN'),
    ).length;
    return {
      superAdminCount,
      admins: this.admins.map((a) => ({ ...a, roles: [...a.roles] })),
    };
  }

  async grantRole(input: GrantSystemRole): Promise<SystemRoleGranted> {
    this.assertHealthy();
    const grantedAt = '2026-11-21T12:00:00.000Z';
    const userId = '0195f000-0000-7000-8000-000000000f02';
    const existing = this.admins.find((a) => a.userId === userId);
    if (existing) {
      if (existing.roles.some((r) => r.role === input.role)) {
        throw new HttpError(409, 'SYSTEM_ROLE_ALREADY_GRANTED', 'Cet utilisateur détient déjà ce rôle.');
      }
      this.admins = this.admins.map((a) =>
        a.userId === userId ? { ...a, roles: [...a.roles, { role: input.role, grantedAt }] } : a,
      );
    } else {
      this.admins = [
        ...this.admins,
        {
          userId,
          name: 'Clarisse Fotso',
          maskedPhone: input.phone,
          roles: [{ role: input.role, grantedAt }],
        },
      ];
    }
    return { userId, role: input.role, grantedAt };
  }

  async revokeRole(userId: string, role: SystemRole): Promise<SystemRoleRevoked> {
    this.assertHealthy();
    const target = this.admins.find((a) => a.userId === userId);
    if (!target) throw new HttpError(404, 'NOT_FOUND', 'Administrateur introuvable.');
    if (
      role === 'SUPER_ADMIN' &&
      this.admins.filter((a) => a.roles.some((r) => r.role === 'SUPER_ADMIN')).length <= 1
    ) {
      throw new HttpError(409, 'LAST_SUPER_ADMIN', 'Impossible de retirer le dernier Super Administrateur.');
    }
    this.admins = this.admins
      .map((a) => (a.userId === userId ? { ...a, roles: a.roles.filter((r) => r.role !== role) } : a))
      .filter((a) => a.roles.length > 0);
    return { userId, role, revokedAt: '2026-11-21T12:05:00.000Z' };
  }
}
