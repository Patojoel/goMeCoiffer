/**
 * Rôles prédéfinis du salon (PRD §5, UC-004 Q11) ; UC-008 en figera les permissions. `OWNER` ne s'obtient que par la
 * fondation de l'organisation.
 */
export const SalonRole = {
  OWNER: 'OWNER',
  SALON_ADMIN: 'SALON_ADMIN',
  HAIRDRESSER: 'HAIRDRESSER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  PRACTITIONER: 'PRACTITIONER',
} as const;
export type SalonRole = (typeof SalonRole)[keyof typeof SalonRole];
