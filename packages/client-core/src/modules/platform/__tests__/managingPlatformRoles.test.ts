import { describe, expect, it } from 'vitest';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { platformApi } from '../infra/api/platformApi.js';
import { InMemoryPlatformGateway } from './fakes/InMemoryPlatformGateway.js';

describe('Platform system roles management (UC-012)', () => {
  it('lists platform admins, grants a system role and revokes safely', async () => {
    const platform = new InMemoryPlatformGateway();
    const store = createTestStore({ platform });

    const initial = await store.dispatch(platformApi.endpoints.listPlatformAdmins.initiate());
    expect(initial.data?.superAdminCount).toBe(1);

    const granted = await store.dispatch(
      platformApi.endpoints.grantSystemRole.initiate({ phone: '6 55 44 33 22', role: 'OPERATIONS_ADMIN' }),
    );
    expect(granted.data?.role).toBe('OPERATIONS_ADMIN');

    const afterGrant = await store.dispatch(
      platformApi.endpoints.listPlatformAdmins.initiate(undefined, { forceRefetch: true }),
    );
    expect(afterGrant.data?.admins).toHaveLength(2);

    await store.dispatch(
      platformApi.endpoints.revokeSystemRole.initiate({
        userId: granted.data!.userId,
        role: 'OPERATIONS_ADMIN',
      }),
    );
    const afterRevoke = await store.dispatch(
      platformApi.endpoints.listPlatformAdmins.initiate(undefined, { forceRefetch: true }),
    );
    expect(afterRevoke.data?.admins).toHaveLength(1);
  });
});
