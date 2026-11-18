import type { NextStep } from '../../../domain/enums/next-step.enum.js';

export interface SessionSalon {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

/** Résumé de session (contrat `SessionSummarySchema`) : ni téléphone ni e-mail. */
export interface SessionSummaryReadModel {
  readonly user: { readonly id: string; readonly name: string };
  readonly activeSalonId: string | null;
  readonly salons: readonly SessionSalon[];
  readonly systemRoles: readonly string[];
  readonly nextStep: NextStep;
}
