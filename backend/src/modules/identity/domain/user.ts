import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { AccountAlreadyRegisteredError } from './errors.js';

interface UserState {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  /** Empreinte argon2id ; absente pour un compte client léger (D-018). */
  passwordHash: string | null;
  phoneVerifiedAt: Date | null;
  termsAcceptedAt: Date | null;
  createdAt: Date;
  version: number;
}

interface OwnerDetails {
  name: string;
  email: string | null;
  passwordHash: string;
  now: Date;
}

/** Identité de connexion unique, clé : le numéro de téléphone (EX-001). Aucun rôle ici : les rôles vivent ailleurs. */
export class User extends AggregateRoot {
  private constructor(private state: UserState) {
    super();
  }

  static registerOwner(input: OwnerDetails & { id: string; phone: PhoneNumber }): User {
    return new User({
      id: input.id,
      phone: input.phone.value,
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      phoneVerifiedAt: input.now,
      termsAcceptedAt: input.now,
      createdAt: input.now,
      version: 0,
    });
  }

  static restore(state: Readonly<UserState>): User {
    return new User({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get phone(): PhoneNumber {
    return PhoneNumber.parse(this.state.phone);
  }

  /** Un compte avec mot de passe ne se réinscrit pas : il se connecte ou réinitialise son mot de passe. */
  get acceptsOwnerRegistration(): boolean {
    return this.state.passwordHash === null;
  }

  /** Compte client léger devenu propriétaire : même identité, ses réservations restent les siennes (RG-001-10). */
  completeAsOwner(details: OwnerDetails): void {
    if (!this.acceptsOwnerRegistration) throw new AccountAlreadyRegisteredError();
    this.state.name = details.name;
    this.state.email = details.email;
    this.state.passwordHash = details.passwordHash;
    this.state.phoneVerifiedAt = details.now;
    this.state.termsAcceptedAt = details.now;
  }

  snapshot(): Readonly<UserState> {
    return { ...this.state };
  }
}
