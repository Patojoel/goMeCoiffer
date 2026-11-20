import { describe, expect, it } from 'vitest';
import { BootstrapSuperAdmin } from '../../application/commands/bootstrap-super-admin/bootstrap-super-admin.command.js';
import { GrantSystemRole } from '../../application/commands/grant-system-role/grant-system-role.command.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';

describe('Serializing the commands that carry a phone number', () => {
  it('leaves the phone number out of a serialized role grant', () => {
    const command = new GrantSystemRole('actor-1', '6 93 44 55 66', SystemRole.FINANCE_ADMIN);

    const serialized = JSON.stringify(command);

    expect(serialized).not.toContain('6 93 44 55 66');
    expect(JSON.parse(serialized)).toEqual({ actorUserId: 'actor-1', role: 'FINANCE_ADMIN' });
  });

  it('leaves the phone number out of a serialized bootstrap', () => {
    const command = new BootstrapSuperAdmin('6 90 11 22 33', 'deploy', true);

    const serialized = JSON.stringify(command);

    expect(serialized).not.toContain('6 90 11 22 33');
    expect(JSON.parse(serialized)).toEqual({ systemUser: 'deploy', recovery: true });
  });
});
