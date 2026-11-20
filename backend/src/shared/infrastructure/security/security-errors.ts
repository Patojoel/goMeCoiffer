import { DomainError } from '../../domain/errors.js';

export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED';
  constructor() {
    super('Session absente ou expirée : reconnectez-vous.');
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  constructor(message = "Vous n'avez pas le droit de faire cette action dans ce salon.") {
    super(message);
  }
}

/** Session client (ouverte par code SMS) sur un espace réservé aux salons ou à l'administration (D-054, D-055, RG-009-08). */
export class StaffSignInRequiredError extends DomainError {
  readonly code = 'STAFF_SIGN_IN_REQUIRED';
  constructor() {
    super(
      'Cet espace est réservé aux salons. Connectez-vous avec votre mot de passe, ou créez votre compte salon.',
    );
  }
}

export class CsrfInvalidError extends DomainError {
  readonly code = 'CSRF_INVALID';
  constructor() {
    super('Jeton de sécurité absent ou expiré : rechargez la page puis recommencez.');
  }
}

/** Entrée refusée par le schéma du contrat (400). */
export class RequestValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  constructor(readonly errors: readonly { path: string; message: string }[]) {
    super('Certaines informations sont invalides : corrigez les champs signalés.');
  }
}
