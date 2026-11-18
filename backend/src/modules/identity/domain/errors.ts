import { BusinessRuleViolation } from '../../../shared/domain/errors.js';

export class OtpIncorrectError extends BusinessRuleViolation {
  readonly code = 'OTP_INCORRECT';
  constructor(attemptsLeft: number) {
    super(`Code incorrect. Il vous reste ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''}.`);
  }
}

export class OtpExpiredError extends BusinessRuleViolation {
  readonly code = 'OTP_EXPIRED';
  constructor() {
    super('Ce code a expiré. Demandez-en un nouveau.');
  }
}

export class OtpAttemptsExhaustedError extends BusinessRuleViolation {
  readonly code = 'OTP_ATTEMPTS_EXHAUSTED';
  constructor() {
    super("Trop d'essais. Demandez un nouveau code.");
  }
}

/** Code déjà utilisé, remplacé par un plus récent, ou jamais demandé : le même message pour tous. */
export class OtpNoLongerValidError extends BusinessRuleViolation {
  readonly code = 'OTP_NO_LONGER_VALID';
  constructor() {
    super("Ce code n'est plus valable. Demandez un nouveau code.");
  }
}

export class OtpResendTooSoonError extends BusinessRuleViolation {
  readonly code = 'OTP_RESEND_TOO_SOON';
  constructor(readonly secondsLeft: number) {
    super(`Un code vient d'être envoyé. Vous pourrez en demander un autre dans ${secondsLeft} secondes.`);
  }
}

export class OtpTooManyRequestsError extends BusinessRuleViolation {
  readonly code = 'OTP_TOO_MANY_REQUESTS';
  constructor() {
    super("Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance.");
  }
}

export type PasswordRejection = 'TOO_SHORT' | 'TOO_LONG' | 'TOO_COMMON' | 'CONTAINS_PHONE';
const PASSWORD_MESSAGES: Record<PasswordRejection, string> = {
  TOO_SHORT: 'Le mot de passe doit compter au moins 10 caractères.',
  TOO_LONG: 'Le mot de passe ne peut pas dépasser 128 caractères.',
  TOO_COMMON: 'Ce mot de passe est trop courant : choisissez une phrase propre à vous.',
  CONTAINS_PHONE: 'Le mot de passe ne doit pas contenir votre numéro de téléphone.',
};

export class PasswordRejectedError extends BusinessRuleViolation {
  readonly code: string;
  constructor(reason: PasswordRejection) {
    super(PASSWORD_MESSAGES[reason]);
    this.code = `PASSWORD_${reason}`;
  }
}

/** N'est atteignable qu'avec un code valide, donc par le titulaire du numéro (D-019). */
export class AccountAlreadyRegisteredError extends BusinessRuleViolation {
  readonly code = 'ACCOUNT_ALREADY_REGISTERED';
  constructor() {
    super('Un compte existe déjà pour ce numéro : connectez-vous ou utilisez « Mot de passe oublié ».');
  }
}
