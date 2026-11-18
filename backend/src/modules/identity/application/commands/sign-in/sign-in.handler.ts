import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AUDIT_TRAIL, type AuditTrail, CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { User } from '../../../domain/aggregates/user.js';
import { InvalidCredentialsError } from '../../../domain/exceptions/invalid-credentials.error.js';
import { SignInTemporarilyBlockedError } from '../../../domain/exceptions/sign-in-temporarily-blocked.error.js';
import { PASSWORD_VERIFIER, type PasswordVerifier } from '../../../domain/ports/password-verifier.port.js';
import {
  SIGN_IN_ATTEMPT_HISTORY,
  type SignInAttemptHistory,
} from '../../../domain/repositories/read/sign-in-attempt-history.read-repository.js';
import {
  SIGN_IN_ATTEMPT_REPOSITORY,
  type SignInAttemptRepository,
} from '../../../domain/repositories/write/sign-in-attempt.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/repositories/write/user.repository.js';
import { assessSignIn } from '../../../domain/services/sign-in-attempt-policy.js';
import { normalizeNetworkAddress } from '../../../domain/value-objects/network-address.js';
import type { SignInAttempt } from '../../../domain/value-objects/sign-in-attempt.js';
import { type DeviceLookup, KnownDeviceRegistry } from '../../services/known-device-registry.js';
import { SignIn } from './sign-in.command.js';
import type { SignInResponse } from './sign-in.response.js';

@CommandHandler(SignIn)
export class SignInHandler implements ICommandHandler<SignIn> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SIGN_IN_ATTEMPT_REPOSITORY) private readonly attempts: SignInAttemptRepository,
    @Inject(SIGN_IN_ATTEMPT_HISTORY) private readonly history: SignInAttemptHistory,
    private readonly devices: KnownDeviceRegistry,
    @Inject(PASSWORD_VERIFIER) private readonly passwords: PasswordVerifier,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Les essais d'un même numéro passent un à un (verrou) : la limite ne se contourne pas par une rafale. Un numéro
   * sans compte suit exactement le même chemin qu'un compte (même blocage, même coût), pour ne rien révéler.
   */
  async execute(cmd: SignIn): Promise<SignInResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    await this.attempts.lockSignInsFor(phone);
    const now = this.clock.now();

    const networkAddress = normalizeNetworkAddress(cmd.networkAddress);
    const user = await this.users.findByPhone(phone);
    const found = await this.devices.find(cmd.deviceTokens, user?.id ?? null);
    const device = found.device;
    const fromKnownDevice = device?.isRecognizedAt(now) ?? false;
    const history = await this.history.recentAttempts(phone, networkAddress, now);
    const assess = (attempts: readonly SignInAttempt[]) =>
      assessSignIn({
        phone: phone.value,
        networkAddress,
        attempts,
        fromKnownDevice,
        now,
      });

    const block = assess(history);
    if (block) return { status: 'REFUSED', refusal: new SignInTemporarilyBlockedError(block) };

    const passwordHash = user?.passwordHash ?? null;
    const correct = await this.passwords.verify(cmd.password, passwordHash);
    const attempt: SignInAttempt = {
      phone: phone.value,
      networkAddress,
      at: now,
      succeeded: correct,
      fromKnownDevice,
    };
    await this.attempts.add(attempt);

    if (!correct || !user || !passwordHash) {
      if (device && fromKnownDevice) await this.devices.recordFailure(device, now);
      const blockedNow = assess([...history, attempt]);
      if (user && blockedNow && blockedNow.reason !== 'NETWORK') await this.traceBlock(user, now);
      return { status: 'REFUSED', refusal: new InvalidCredentialsError() };
    }
    return this.signedIn(user, passwordHash, cmd, found, fromKnownDevice, now);
  }

  private async signedIn(
    user: User,
    passwordHash: string,
    cmd: SignIn,
    found: DeviceLookup,
    fromKnownDevice: boolean,
    now: Date,
  ): Promise<SignInResponse> {
    if (this.passwords.needsRehash(passwordHash)) {
      user.upgradePasswordHash(await this.passwords.rehash(cmd.password));
      await this.users.save(user);
    }
    const deviceTokens = await this.devices.recognizeAfterSuccess(found, cmd.deviceTokens, user.id, now);
    await this.audit.record({
      action: 'USER_SIGNED_IN',
      subjectType: 'user',
      subjectId: user.id,
      actorUserId: user.id,
      occurredAt: now,
      details: { knownDevice: fromKnownDevice },
    });
    return { status: 'SIGNED_IN', userId: user.id, deviceTokens };
  }

  private traceBlock(user: User, now: Date): Promise<void> {
    return this.audit.record({
      action: 'SIGN_IN_BLOCKED',
      subjectType: 'user',
      subjectId: user.id,
      actorUserId: null,
      occurredAt: now,
    });
  }
}
