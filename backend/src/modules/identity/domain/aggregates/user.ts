import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { AccountAlreadyRegisteredError } from '../exceptions/account-already-registered.error.js';
import { NoPasswordToResetError } from '../exceptions/no-password-to-reset.error.js';

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
  /** Augmentée à chaque changement d'identifiants : une session ouverte avec une version périmée est refusée (D-031). */
  credentialsVersion: number;
  version: number;
}

interface OwnerDetails {
  name: string;
  email: string | null;
  passwordHash: string;
  now: Date;
}

interface CollaboratorAccount {
  name: string;
  passwordHash: string;
  /** Instant où le code SMS a prouvé le numéro. */
  provenAt: Date;
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
      credentialsVersion: 1,
      version: 0,
    });
  }

  /** Personne invitée sans compte : numéro vérifié à l'instant de la preuve, conditions acceptées, aucun e-mail (RG-007-08). */
  static registerCollaborator(input: CollaboratorAccount & { id: string; phone: PhoneNumber }): User {
    return new User({
      id: input.id,
      phone: input.phone.value,
      name: input.name,
      email: null,
      passwordHash: input.passwordHash,
      phoneVerifiedAt: input.provenAt,
      termsAcceptedAt: input.now,
      createdAt: input.now,
      credentialsVersion: 1,
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

  /** Empreinte à vérifier à la connexion ; `null` pour un compte client léger, qui ne se connecte pas par mot de passe. */
  get passwordHash(): string | null {
    return this.state.passwordHash;
  }

  get credentialsVersion(): number {
    return this.state.credentialsVersion;
  }

  /** Un compte client léger n'a pas de mot de passe à réinitialiser : aucun code ne lui est envoyé (D-018). */
  get canResetPassword(): boolean {
    return this.state.passwordHash !== null;
  }

  /**
   * Nouveau mot de passe prouvé par le code SMS : les sessions ouvertes avec l'ancien deviennent périmées (version),
   * le numéro est vérifié à cet instant. Aucune comparaison à l'ancien mot de passe (D-031).
   */
  resetPassword(newHash: string, now: Date): void {
    if (!this.canResetPassword) throw new NoPasswordToResetError();
    this.state.passwordHash = newHash;
    this.state.phoneVerifiedAt = now;
    this.state.credentialsVersion += 1;
  }

  /** Même mot de passe, empreinte recalculée avec les réglages en vigueur (D-028). */
  upgradePasswordHash(newHash: string): void {
    this.state.passwordHash = newHash;
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

  /** Compte du personnel : il a un mot de passe ; un compte client léger n'en a pas (D-018). */
  get isStaffAccount(): boolean {
    return this.state.passwordHash !== null;
  }

  /** Compte client léger devenu collaborateur : même identité, ses réservations restent les siennes (RG-007-09). */
  completeAsCollaborator(details: CollaboratorAccount): void {
    if (this.isStaffAccount) throw new AccountAlreadyRegisteredError();
    this.state.name = details.name;
    this.state.passwordHash = details.passwordHash;
    this.state.phoneVerifiedAt = details.provenAt;
    this.state.termsAcceptedAt = details.now;
  }

  snapshot(): Readonly<UserState> {
    return { ...this.state };
  }
}
