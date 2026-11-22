import { describe, expect, it } from 'vitest';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { teamApi } from '../infra/api/teamApi.js';
import { InMemoryTeamGateway } from './fakes/InMemoryTeamGateway.js';

describe('Salon team roster and invitations management (UC-006, UC-011)', () => {
  it('lists invitations, sends an invite and cancels an invitation with cache refresh', async () => {
    const team = new InMemoryTeamGateway();
    const store = createTestStore({ team });

    const initial = await store.dispatch(teamApi.endpoints.listSalonInvitations.initiate());
    expect(initial.data).toHaveLength(1);

    const invited = await store.dispatch(
      teamApi.endpoints.inviteCollaborator.initiate({
        name: 'Aline Mvondo',
        phone: '6 77 22 33 44',
        role: 'HAIRDRESSER',
      }),
    );
    expect(invited.data?.role).toBe('HAIRDRESSER');

    const refreshed = await store.dispatch(
      teamApi.endpoints.listSalonInvitations.initiate(undefined, { forceRefetch: true }),
    );
    expect(refreshed.data).toHaveLength(2);

    await store.dispatch(teamApi.endpoints.cancelInvitation.initiate(invited.data!.invitationId));
    const afterCancel = await store.dispatch(
      teamApi.endpoints.listSalonInvitations.initiate(undefined, { forceRefetch: true }),
    );
    expect(afterCancel.data).toHaveLength(1);
  });

  it('lists active members, updates role with version concurrency and removes a collaborator', async () => {
    const team = new InMemoryTeamGateway();
    const store = createTestStore({ team });

    const roster = await store.dispatch(teamApi.endpoints.listSalonTeam.initiate());
    const paul = roster.data!.members.find((m) => m.name === 'Paul Mbarga')!;
    expect(paul.role).toBe('HAIRDRESSER');

    const roleRes = await store.dispatch(
      teamApi.endpoints.changeCollaboratorRole.initiate({
        membershipId: paul.membershipId,
        body: { role: 'SALON_ADMIN', version: paul.version },
      }),
    );
    expect(roleRes.data?.role).toBe('SALON_ADMIN');

    await store.dispatch(
      teamApi.endpoints.removeCollaborator.initiate({
        membershipId: paul.membershipId,
        body: { version: roleRes.data!.version },
      }),
    );
    const updatedRoster = await store.dispatch(
      teamApi.endpoints.listSalonTeam.initiate(undefined, { forceRefetch: true }),
    );
    expect(updatedRoster.data?.members).toHaveLength(1);
  });
});
