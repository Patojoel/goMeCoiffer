import { OtpChallengeOrmEntity } from '../modules/identity/infrastructure/persistence/otp-challenge.orm-entity.js';
import { UserOrmEntity } from '../modules/identity/infrastructure/persistence/user.orm-entity.js';

/**
 * Registre des entités TypeORM (`*.orm-entity.ts`) de tous les modules. Une entité absente d'ici n'est
 * connue ni de l'application, ni de `migration:generate`.
 */
export const ENTITIES: Function[] = [UserOrmEntity, OtpChallengeOrmEntity];
