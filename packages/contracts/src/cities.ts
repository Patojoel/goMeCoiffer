import { z } from 'zod';

/** Villes couvertes par GoMeCoiffer (D-036) : liste fermée, tenue par GoMeCoiffer. */
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
export const CitySchema = z.enum(CITIES, { error: 'Choisissez la ville du salon dans la liste.' });
export type City = z.infer<typeof CitySchema>;
