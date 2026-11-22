import type { NextStep } from '@gomecoiffer/contracts';
import type { SessionState } from './sessionSlice.js';

export type HomeTarget = 'admin' | 'salon-home' | 'choose-salon' | 'create-organization';

export const canAccessSalonSpace = (session: SessionState): boolean =>
  session.userId !== null && session.kind === 'STAFF';

export const can = (session: SessionState, permissionCode: string): boolean =>
  canAccessSalonSpace(session) && session.permissions.includes(permissionCode);

export const hasSystemRole = (session: SessionState, role: string): boolean =>
  canAccessSalonSpace(session) && session.systemRoles.includes(role);

export function resolveHomeTarget(nextStep: NextStep): HomeTarget {
  switch (nextStep) {
    case 'PLATFORM_ADMIN':
      return 'admin';
    case 'OPEN_SALON':
      return 'salon-home';
    case 'CHOOSE_SALON':
      return 'choose-salon';
    case 'CREATE_ORGANIZATION':
      return 'create-organization';
    default: {
      nextStep satisfies never;
      throw new Error(`Unhandled nextStep: ${String(nextStep)}`);
    }
  }
}
