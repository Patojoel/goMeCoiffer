import { describe, expect, it } from 'vitest';
import { isSystemRole, SYSTEM_ROLES, SystemRole } from '../../domain/enums/system-role.enum.js';

describe('SystemRole catalog (T1)', () => {
  it('exposes exactly the three closed platform roles', () => {
    expect(SYSTEM_ROLES).toEqual(['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN']);
    expect(SystemRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
    expect(SystemRole.OPERATIONS_ADMIN).toBe('OPERATIONS_ADMIN');
    expect(SystemRole.FINANCE_ADMIN).toBe('FINANCE_ADMIN');
  });

  it.each(['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'])(
    'accepts valid system role %s',
    (role) => {
      expect(isSystemRole(role)).toBe(true);
    },
  );

  it.each(['OWNER', 'SALON_ADMIN', 'HAIRDRESSER', 'MODERATOR', 'MOD', '', 'super_admin'])(
    'rejects salon role or unknown value %s',
    (role) => {
      expect(isSystemRole(role)).toBe(false);
    },
  );
});

