import type { BusinessRuleViolation } from '../domain/errors.js';

/**
 * Levée par un handler dont le refus doit laisser une trace en base (essai compté, code consommé) : le
 * `TransactionalCommandBus` commite la transaction, exécute les actions post-commit, puis lève `refusal`.
 * Toute autre erreur annule la transaction.
 */
export class RefuseAfterCommit extends Error {
  constructor(readonly refusal: BusinessRuleViolation) {
    super(refusal.message);
  }
}
