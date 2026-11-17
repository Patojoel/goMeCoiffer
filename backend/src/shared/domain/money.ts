import { InvalidValueError } from './errors.js';

/** Montant en francs CFA (XAF), toujours entier et positif ou nul. */
export class Money {
  private constructor(readonly amount: number) {}

  static xaf(amount: number): Money {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new InvalidValueError(`Montant invalide : ${amount} (FCFA entiers, positif ou nul).`);
    }
    return new Money(amount);
  }

  add(other: Money): Money {
    return Money.xaf(this.amount + other.amount);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount;
  }
}
