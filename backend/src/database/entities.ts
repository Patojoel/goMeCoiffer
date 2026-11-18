import { KnownDeviceOrmEntity } from '../modules/identity/infrastructure/persistence/orm-entities/known-device.orm-entity.js';
import { OtpChallengeOrmEntity } from '../modules/identity/infrastructure/persistence/orm-entities/otp-challenge.orm-entity.js';
import { SignInAttemptOrmEntity } from '../modules/identity/infrastructure/persistence/orm-entities/sign-in-attempt.orm-entity.js';
import { UserOrmEntity } from '../modules/identity/infrastructure/persistence/orm-entities/user.orm-entity.js';

/**
 * Registre des entités TypeORM (`*.orm-entity.ts`) de tous les modules. Une entité absente d'ici n'est
 * connue ni de l'application, ni de `migration:generate`.
 */
export const ENTITIES: Function[] = [
  UserOrmEntity,
  OtpChallengeOrmEntity,
  SignInAttemptOrmEntity,
  KnownDeviceOrmEntity,
];
