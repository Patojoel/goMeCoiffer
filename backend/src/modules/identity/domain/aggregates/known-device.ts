import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';

export const KNOWN_DEVICE_LIFETIME_DAYS = 90;
export const KNOWN_DEVICE_MAX_FAILURES = 5;
const DAY_MS = 24 * 3_600_000;

interface KnownDeviceState {
  id: string;
  userId: string;
  /** Empreinte du jeton du cookie : le jeton lui-même n'est jamais stocké. */
  tokenHash: string;
  recognizedAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  failedAttempts: number;
  revokedAt: Date | null;
  version: number;
}

/**
 * Appareil sur lequel un compte s'est connecté avec succès (D-025) : reconnu 90 jours après la dernière
 * réussite, et plus du tout après 5 échecs de suite depuis lui (téléphone volé).
 */
export class KnownDevice extends AggregateRoot {
  private constructor(private state: KnownDeviceState) {
    super();
  }

  static recognize(input: { id: string; userId: string; tokenHash: string; now: Date }): KnownDevice {
    return new KnownDevice({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      recognizedAt: input.now,
      lastUsedAt: input.now,
      expiresAt: new Date(input.now.getTime() + KNOWN_DEVICE_LIFETIME_DAYS * DAY_MS),
      failedAttempts: 0,
      revokedAt: null,
      version: 0,
    });
  }

  static restore(state: Readonly<KnownDeviceState>): KnownDevice {
    return new KnownDevice({ ...state });
  }

  isRecognizedAt(now: Date): boolean {
    return this.state.revokedAt === null && now.getTime() < this.state.expiresAt.getTime();
  }

  /** Une connexion réussie prolonge la reconnaissance de 90 jours et remet les échecs à zéro. */
  recordSuccess(now: Date): void {
    this.state.lastUsedAt = now;
    this.state.expiresAt = new Date(now.getTime() + KNOWN_DEVICE_LIFETIME_DAYS * DAY_MS);
    this.state.failedAttempts = 0;
    this.state.revokedAt = null;
  }

  /** Réinitialisation du mot de passe : l'appareil n'est plus reconnu avant sa prochaine connexion réussie (D-031). */
  revoke(now: Date): void {
    this.state.revokedAt = now;
  }

  /** Nouveau jeton à chaque connexion réussie : le précédent, s'il a été copié, ne vaut plus rien. */
  renewToken(tokenHash: string): void {
    this.state.tokenHash = tokenHash;
  }

  /** Un échec saisi depuis un appareil qui n'est plus reconnu ne compte pas : seuls les appareils reconnus se révoquent. */
  recordFailure(now: Date): void {
    if (!this.isRecognizedAt(now)) return;
    this.state.failedAttempts += 1;
    if (this.state.failedAttempts >= KNOWN_DEVICE_MAX_FAILURES) this.state.revokedAt = now;
  }

  snapshot(): Readonly<KnownDeviceState> {
    return { ...this.state };
  }
}
