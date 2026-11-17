/** Base des erreurs connues du domaine ; le DomainExceptionFilter les traduit en HTTP. */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Ressource absente ou hors du périmètre du requérant : 404 dans les deux cas. */
export class NotFoundError extends DomainError {
  readonly code: string = 'NOT_FOUND';
}

export class ScopeViolationError extends NotFoundError {}

export class ConflictError extends DomainError {
  readonly code: string = 'CONFLICT';
}

export class ConcurrencyConflictError extends ConflictError {
  override readonly code = 'CONCURRENCY_CONFLICT';

  constructor(aggregate: string, id: string) {
    super(`${aggregate} ${id} a été modifié entre-temps : rechargez puis recommencez.`);
  }
}

/** Règle métier refusée (422). Chaque règle a sa sous-classe nommée et un `code` stable. */
export abstract class BusinessRuleViolation extends DomainError {}

/** Valeur qui viole l'invariant d'un value object. */
export class InvalidValueError extends BusinessRuleViolation {
  readonly code = 'INVALID_VALUE';
}
