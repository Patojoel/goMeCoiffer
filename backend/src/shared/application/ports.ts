import type { SqlStatement } from './sql.js';

export const CLOCK = Symbol('CLOCK');
export interface Clock {
  now(): Date;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');
export interface IdGenerator {
  /** UUID v7 : triable par date de création. */
  next(): string;
}

export const READ_DB = Symbol('READ_DB');
/** Exécute le SQL pur des QueryHandlers ; les valeurs sont toujours des paramètres liés. */
export interface SqlReader {
  many<T>(query: SqlStatement): Promise<readonly T[]>;
  /** 0 ligne → NotFoundError. */
  one<T>(query: SqlStatement): Promise<T>;
  maybeOne<T>(query: SqlStatement): Promise<T | null>;
}

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');
export interface RealtimeMessage {
  readonly type: string;
  /** Identifiants et statuts seulement : jamais de nom ni de téléphone de client. */
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
}
/** Envoi après le commit de la transaction en cours ; une panne est loggée, jamais propagée. */
export interface RealtimePublisher {
  publishToUser(userId: string, message: RealtimeMessage): void;
  publishToSalon(salonId: string, message: RealtimeMessage): void;
}

/** Acteur authentifié, résolu côté serveur depuis la session (jamais depuis la requête). */
export interface Actor {
  readonly userId: string;
  readonly activeSalonId: string | null;
  readonly permissions: ReadonlySet<string>;
  readonly systemRoles: ReadonlySet<string>;
}

export const ACTOR_RIGHTS = Symbol('ACTOR_RIGHTS');
/** Droits d'un utilisateur : permissions dans le salon actif et rôles système. Fourni par le module des comptes. */
export interface ActorRights {
  resolve(
    userId: string,
    activeSalonId: string | null,
  ): Promise<{ permissions: readonly string[]; systemRoles: readonly string[] }>;
}
