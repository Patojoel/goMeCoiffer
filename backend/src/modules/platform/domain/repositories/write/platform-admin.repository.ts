import type { PlatformAdmin } from '../../aggregates/platform-admin.js';

export const PLATFORM_ADMIN_REPOSITORY = Symbol('PLATFORM_ADMIN_REPOSITORY');

export interface PlatformAdminRepository {
  loadForUser(userId: string): Promise<PlatformAdmin>;
  /** Verrou transactionnel PostgreSQL dédié aux retraits de `SUPER_ADMIN` (RG-012-06, RG-012-11). */
  lockSuperAdminChanges(): Promise<void>;
  countSuperAdmins(): Promise<number>;
  save(admin: PlatformAdmin): Promise<void>;
}

