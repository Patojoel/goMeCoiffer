import { describe, expect, it } from 'vitest';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { joinSalonApi } from '../infra/api/joinSalonApi.js';
import { InMemoryJoinSalonGateway } from './fakes/InMemoryJoinSalonGateway.js';

describe('Joining a salon with SMS phone proof and invitation acceptance (UC-007)', () => {
  it('requests SMS proof code, proves phone, lists invitations and opens staff session on accept', async () => {
    const joinSalon = new InMemoryJoinSalonGateway();
    const store = createTestStore({ joinSalon });

    const sent = await store.dispatch(
      joinSalonApi.endpoints.requestInvitationCode.initiate({ phone: '6 70 00 00 02' }),
    );
    expect(sent.data?.maskedPhone).toBe('6 70 •• •• 02');

    await store.dispatch(
      joinSalonApi.endpoints.proveInvitationPhone.initiate({ phone: '6 70 00 00 02', code: '123456' }),
    );

    const listed = await store.dispatch(joinSalonApi.endpoints.listProvenInvitations.initiate());
    expect(listed.data?.account).toBe('NEW');
    expect(listed.data?.invitations).toHaveLength(1);

    const accepted = await store.dispatch(
      joinSalonApi.endpoints.acceptInvitation.initiate({
        invitationId: listed.data!.invitations[0]!.invitationId,
        body: { name: 'Paul Mbarga', password: 'MonMotDePasse2026!', termsAccepted: true },
      }),
    );
    expect(accepted.data?.outcome).toBe('SIGNED_IN');
    expect(store.getState().session.kind).toBe('STAFF');
    expect(store.getState().session.activeSalonId).toBe('0195f000-0000-7000-8000-000000000b01');
  });

  it('handles SIGN_IN_REQUIRED gracefully when an existing account joins without opening session yet', async () => {
    const joinSalon = new InMemoryJoinSalonGateway({ account: 'EXISTING' });
    joinSalon.proven = true;
    const store = createTestStore({ joinSalon });

    const listed = await store.dispatch(joinSalonApi.endpoints.listProvenInvitations.initiate());
    const accepted = await store.dispatch(
      joinSalonApi.endpoints.acceptInvitation.initiate({
        invitationId: listed.data!.invitations[0]!.invitationId,
        body: {},
      }),
    );

    expect(accepted.data?.outcome).toBe('SIGN_IN_REQUIRED');
    expect(store.getState().session.userId).toBeNull();
  });
});
