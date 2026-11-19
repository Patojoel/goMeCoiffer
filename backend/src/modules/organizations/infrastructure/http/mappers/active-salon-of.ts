import type { Actor } from '../../../../../shared/application/ports.js';

/** Les routes qui l'appellent portent `@RequiresPermission` : le garde a déjà refusé un acteur sans salon actif. */
export const activeSalonOf = (actor: Pick<Actor, 'activeSalonId'>): string => {
  if (actor.activeSalonId === null) throw new Error('Route de salon appelée sans salon actif.');
  return actor.activeSalonId;
};
