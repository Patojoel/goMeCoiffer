import type { ExecutionContext } from '@nestjs/common';

/** Préfixe des métadonnées posées par `@Throttle` (constante interne de @nestjs/throttler, non exportée). */
const THROTTLER_TRACKER = 'THROTTLER:TRACKER';

/** Limiteur nommé de la connexion, compté par appareil (ou par adresse sans cookie d'appareil). */
export const SIGN_IN_THROTTLER = 'signIn';
/** Limiteur nommé compté par adresse réseau seule. */
export const PER_ADDRESS_THROTTLER = 'perAddress';

/**
 * Un limiteur nommé du module ne s'applique qu'aux routes qui le déclarent avec `@Throttle` et un `getTracker` ;
 * sa limite et sa durée viennent du module (donc de la configuration).
 */
export const onlyWhereDeclared =
  (name: string) =>
  (context: ExecutionContext): boolean =>
    typeof Reflect.getMetadata(`${THROTTLER_TRACKER}${name}`, context.getHandler()) !== 'function';
