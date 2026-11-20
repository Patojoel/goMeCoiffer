import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

const PERMISSION_LABELS: Readonly<Record<string, string>> = {
  'finances:export': 'Finances : exporter',
  'finances:record-payment': 'Finances : déclarer un encaissement',
  'finances:view': 'Finances : consulter',
  'bookings:manage': 'Réservations : gérer',
  'bookings:view-all': 'Réservations : voir toutes',
  'services:manage': 'Prestations : gérer',
  'services:view': 'Prestations : consulter',
  'staff:invite': 'Personnel : inviter',
  'staff:manage': 'Personnel : gérer',
  'staff:view': 'Personnel : consulter',
  'salon-settings:edit': 'Paramètres salon : modifier',
  'salon-settings:view': 'Paramètres salon : consulter',
};

export class PermissionRequiresViewError extends BusinessRuleViolation {
  readonly code = 'PERMISSION_REQUIRES_VIEW';

  constructor(
    readonly action: string,
    readonly requiredView: string,
  ) {
    const actionLabel = PERMISSION_LABELS[action] ?? action;
    const viewLabel = PERMISSION_LABELS[requiredView] ?? requiredView;
    super(`Pour donner « ${actionLabel} », donnez aussi « ${viewLabel} ».`);
  }
}

