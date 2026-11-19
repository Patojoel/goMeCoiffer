/** Liste fermée tenue par GoMeCoiffer (D-036) ; identique au contrat `CITIES`. */
export const CITIES = [
  'Douala',
  'Yaoundé',
  'Bafoussam',
  'Bamenda',
  'Buea',
  'Limbé',
  'Kribi',
  'Garoua',
  'Maroua',
  'Ngaoundéré',
  'Bertoua',
  'Ebolowa',
] as const;
export type City = (typeof CITIES)[number];
