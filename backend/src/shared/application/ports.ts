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
/**
 * Exécute le SQL pur des lectures (QueryHandlers et repositories de lecture) ; les valeurs sont toujours des
 * paramètres liés. Appelé dans une commande, il lit dans la transaction de la commande.
 */
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
  /**
   * Ferme, après le commit, tous les flux ouverts de cet utilisateur (réinitialisation du mot de passe) : un flux
   * ne revérifie la session qu'à son ouverture. Le client se reconnecte et le garde de session tranche.
   */
  closeStreamsOfUser(userId: string): void;
  /**
   * Ferme les seuls flux ouverts avec cette session (changement de salon, D-039) : les autres appareils de
   * l'utilisateur gardent leur salon actif et leur flux. Hors transaction, l'envoi part tout de suite.
   */
  closeStreamsOfSession(sessionId: string): void;
  /**
   * Ferme, après le commit, tous les flux ouverts par cet utilisateur sur ce salon (retrait d'équipe, UC-011),
   * sans toucher ses flux ouverts sur d'autres salons.
   */
  closeUserStreamsInSalon(userId: string, salonId: string): void;
}

export const AUDIT_TRAIL = Symbol('AUDIT_TRAIL');
export interface AuditEntry {
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly actorUserId: string | null;
  readonly salonId?: string | null;
  readonly occurredAt: Date;
  /** Jamais de secret (mot de passe, code, jeton) ni de donnée personnelle superflue. */
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}
/** Trace d'audit écrite dans la transaction de la commande (PRD §11). */
export interface AuditTrail {
  record(entry: AuditEntry): Promise<void>;
}

/** Acteur authentifié, résolu côté serveur depuis la session (jamais depuis la requête). */
export interface Actor {
  readonly userId: string;
  readonly activeSalonId: string | null;
  readonly permissions: ReadonlySet<string>;
  readonly systemRoles: ReadonlySet<string>;
}

export const ACTOR_RIGHTS = Symbol('ACTOR_RIGHTS');
/**
 * Droits d'un utilisateur, relus à chaque requête : appartenance au salon actif, permissions dans ce salon,
 * rôles système. Implémenté par le module `organizations` (SqlActorRights) et lié au token dans son module Nest.
 */
export interface ActorRights {
  resolve(
    userId: string,
    activeSalonId: string | null,
  ): Promise<{
    isMember: boolean;
    permissions: readonly string[];
    systemRoles: readonly string[];
    /**
     * Version des identifiants du compte (augmentée par une réinitialisation du mot de passe) ; `null` : compte
     * inconnu. Une session qui ne porte pas cette version n'ouvre plus rien (D-028, D-031).
     */
    credentialsVersion: number | null;
  }>;
}
