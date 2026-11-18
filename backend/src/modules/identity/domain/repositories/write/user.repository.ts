import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { User } from '../../aggregates/user.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export interface UserRepository {
  findByPhone(phone: PhoneNumber): Promise<User | null>;
  save(user: User): Promise<void>;
}
