import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import { GrantedRights } from '../../../../test-support/fakes.js';
import { SelectActiveSalon } from '../../application/commands/select-active-salon/select-active-salon.command.js';
import { SelectActiveSalonHandler } from '../../application/commands/select-active-salon/select-active-salon.handler.js';
import { SalonNotFoundError } from '../../domain/exceptions/salon-not-found.error.js';
import { CLARISSE_ID, MIREILLE_ID, PAUL_ID } from '../builders/organization-builders.js';

const AKWA = '0195f000-0000-7000-8000-00000000c001';
const BASTOS = '0195f000-0000-7000-8000-00000000c002';
const ELEGANCE = '0195f000-0000-7000-8000-00000000c003';
const UNKNOWN = '0195f000-0000-7000-8000-00000000c0ff';

const rights = new GrantedRights({
  [MIREILLE_ID]: { [AKWA]: ['bookings:manage'], [BASTOS]: ['bookings:manage'] },
  [PAUL_ID]: { [ELEGANCE]: [] },
});
const select = (userId: string, salonId: string) =>
  new SelectActiveSalonHandler(rights).execute(new SelectActiveSalon(userId, salonId));

const refusalOf = async (userId: string, salonId: string) => {
  try {
    await select(userId, salonId);
  } catch (e) {
    return e as SalonNotFoundError;
  }
  throw new Error('Expected a refusal');
};

describe('Selecting the active salon', () => {
  it('refuses a salon that does not exist, as a missing resource', async () => {
    await expect(select(PAUL_ID, UNKNOWN)).rejects.toThrow(SalonNotFoundError);
    await expect(select(PAUL_ID, UNKNOWN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses a salon without active membership with the very same error as a missing salon', async () => {
    const missing = await refusalOf(PAUL_ID, UNKNOWN);
    const foreign = await refusalOf(PAUL_ID, BASTOS);

    expect(foreign).toBeInstanceOf(SalonNotFoundError);
    expect({ code: foreign.code, message: foreign.message }).toEqual({
      code: missing.code,
      message: missing.message,
    });
  });

  it('refuses a salon of another organisation even for a member of other salons', async () => {
    await expect(select(CLARISSE_ID, AKWA)).rejects.toThrow(SalonNotFoundError);
  });

  it('opens the salon where the user has an active membership, whatever the role', async () => {
    expect(await select(PAUL_ID, ELEGANCE)).toEqual({ salonId: ELEGANCE });
  });

  it('lets an owner open each salon of the organisation', async () => {
    expect(await select(MIREILLE_ID, AKWA)).toEqual({ salonId: AKWA });
    expect(await select(MIREILLE_ID, BASTOS)).toEqual({ salonId: BASTOS });
  });
});
