import { describe, expect, it } from 'vitest';
import { NextStep } from '../../domain/enums/next-step.enum.js';
import { nextStepAfterSignIn } from '../../domain/services/next-step-after-sign-in.js';

describe('Choosing where to lead a user after sign-in', () => {
  it('leads a platform administrator to the administration, even when they also belong to salons', () => {
    expect(nextStepAfterSignIn({ systemRoles: ['SUPER_ADMIN'], salonIds: ['akwa', 'bastos'] })).toBe(
      NextStep.PLATFORM_ADMIN,
    );
  });

  it('opens the only salon of a user who belongs to a single one', () => {
    expect(nextStepAfterSignIn({ systemRoles: [], salonIds: ['akwa'] })).toBe(NextStep.OPEN_SALON);
  });

  it('asks a user who belongs to several salons to choose one', () => {
    expect(nextStepAfterSignIn({ systemRoles: [], salonIds: ['akwa', 'bastos'] })).toBe(
      NextStep.CHOOSE_SALON,
    );
  });

  it('asks a user without any salon to create their organisation', () => {
    expect(nextStepAfterSignIn({ systemRoles: [], salonIds: [] })).toBe(NextStep.CREATE_ORGANIZATION);
  });
});
