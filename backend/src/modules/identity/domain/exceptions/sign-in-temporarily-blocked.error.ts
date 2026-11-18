import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';
import type { SignInBlock } from '../services/sign-in-attempt-policy.js';

const minutes = (n: number) => `${n} minute${n > 1 ? 's' : ''}`;

const MESSAGES: Record<SignInBlock['reason'], (block: SignInBlock) => string> = {
  PHONE_SHORT: (b) =>
    `Trop d'essais pour ce numéro. Réessayez dans ${minutes('minutes' in b ? b.minutes : 15)} ou utilisez « Mot de passe oublié ».`,
  PHONE_DAILY: () =>
    "Trop d'essais pour ce numéro aujourd'hui. Utilisez « Mot de passe oublié » ou réessayez demain.",
  NETWORK: () =>
    "Trop d'essais depuis ce réseau. Réessayez dans une heure ou connectez-vous depuis votre appareil habituel.",
};

export class SignInTemporarilyBlockedError extends BusinessRuleViolation {
  readonly code = 'SIGN_IN_TEMPORARILY_BLOCKED';
  constructor(block: SignInBlock) {
    super(MESSAGES[block.reason](block));
  }
}
