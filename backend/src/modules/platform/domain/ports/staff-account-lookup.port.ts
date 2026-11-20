import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';

export const STAFF_ACCOUNT_LOOKUP = Symbol('STAFF_ACCOUNT_LOOKUP');

export interface StaffAccountMatch {
  readonly userId: string;
  readonly hasPassword: boolean;
}

/** Port vers `identity` : trouve un compte par son numéro camerounais normalisé (RG-012-04). */
export interface StaffAccountLookup {
  findByPhone(phone: PhoneNumber): Promise<StaffAccountMatch | null>;
}

