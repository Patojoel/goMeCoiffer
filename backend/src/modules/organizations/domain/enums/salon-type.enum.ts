/** Valeurs = contrat `SalonTypeSchema`. */
export const SalonType = {
  HAIR_SALON: 'HAIR_SALON',
  BARBER_SHOP: 'BARBER_SHOP',
  BEAUTY: 'BEAUTY',
  MIXED: 'MIXED',
} as const;
export type SalonType = (typeof SalonType)[keyof typeof SalonType];
