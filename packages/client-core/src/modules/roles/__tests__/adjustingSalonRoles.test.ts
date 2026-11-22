import { describe, expect, it } from 'vitest';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { rolesApi } from '../infra/api/rolesApi.js';
import { applyPermissionToggleWithDependencies } from '../models/permissionDependencies.js';
import { InMemoryRolesGateway } from './fakes/InMemoryRolesGateway.js';

describe('Adjusting salon role permissions and dependency guidance (UC-008)', () => {
  it('auto-enables required view permission when granting an action, and drops dependent actions when removing view', () => {
    const withManage = applyPermissionToggleWithDependencies([], 'bookings:manage', true);
    expect(withManage.permissions).toEqual(['bookings:view-all', 'bookings:manage']);
    expect(withManage.autoChanged).toEqual(['bookings:view-all']);

    const withoutView = applyPermissionToggleWithDependencies(
      ['bookings:view-all', 'bookings:manage', 'dashboard:view'],
      'bookings:view-all',
      false,
    );
    expect(withoutView.permissions).toEqual(['dashboard:view']);
    expect(withoutView.autoChanged).toEqual(['bookings:manage']);
  });

  it('reads salon roles and saves updated or reset permissions with version bumping', async () => {
    const roles = new InMemoryRolesGateway();
    const store = createTestStore({ roles });

    const fetched = await store.dispatch(rolesApi.endpoints.getSalonRoles.initiate());
    const hairdresser = fetched.data!.roles.find((r) => r.role === 'HAIRDRESSER')!;
    expect(hairdresser.isDefault).toBe(true);

    const updated = await store.dispatch(
      rolesApi.endpoints.adjustRolePermissions.initiate({
        role: 'HAIRDRESSER',
        body: {
          permissions: ['bookings:view-own', 'availability:edit-own', 'services:view'],
          version: hairdresser.version,
        },
      }),
    );
    expect(updated.data?.version).toBe(2);
    expect(updated.data?.permissions).toContain('services:view');

    const reset = await store.dispatch(
      rolesApi.endpoints.adjustRolePermissions.initiate({
        role: 'HAIRDRESSER',
        body: {
          permissions: [],
          version: updated.data!.version,
          resetToDefault: true,
        },
      }),
    );
    expect(reset.data?.permissions).toEqual(['bookings:view-own', 'availability:edit-own']);
  });
});
