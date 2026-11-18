import { NextStep } from '../enums/next-step.enum.js';

export interface SignInContext {
  readonly systemRoles: readonly string[];
  /** Salons où l'utilisateur a une appartenance active. */
  readonly salonIds: readonly string[];
}

/** D-027 : rôle système → administration ; un salon → l'ouvrir ; plusieurs → choisir ; aucun → créer son organisation. */
export function nextStepAfterSignIn({ systemRoles, salonIds }: SignInContext): NextStep {
  if (systemRoles.length > 0) return NextStep.PLATFORM_ADMIN;
  if (salonIds.length === 1) return NextStep.OPEN_SALON;
  if (salonIds.length > 1) return NextStep.CHOOSE_SALON;
  return NextStep.CREATE_ORGANIZATION;
}
