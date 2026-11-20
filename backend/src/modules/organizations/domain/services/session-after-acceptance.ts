export type SessionAfterAcceptance = 'OPEN_NEW' | 'REGENERATE' | 'NONE';

/** Une session sans version porte la version initiale des identifiants (voir `AuthGuard`). */
const INITIAL_CREDENTIALS_VERSION = 1;
const HOUR_MS = 3_600_000;

/**
 * Quelle session après l'acceptation (RG-007-13) : un compte créé ou complété est connecté à neuf ; le titulaire déjà
 * connecté sur ce navigateur passe dans le salon rejoint ; tout autre cas (personne, un autre compte, des identifiants
 * périmés, une session qui a passé sa durée absolue) laisse la session telle quelle.
 */
export function sessionAfterAcceptance(input: {
  accountCreated: boolean;
  account: { userId: string; credentialsVersion: number };
  current: { userId: string; credentialsVersion: number | null; authenticatedAt: number | null } | null;
  now: Date;
  sessionMaxAgeHours: number;
}): SessionAfterAcceptance {
  if (input.accountCreated) return 'OPEN_NEW';
  const { current, account } = input;
  const sameAccount =
    current !== null &&
    current.userId === account.userId &&
    (current.credentialsVersion ?? INITIAL_CREDENTIALS_VERSION) === account.credentialsVersion;
  const stillAlive =
    current?.authenticatedAt != null &&
    input.now.getTime() - current.authenticatedAt <= input.sessionMaxAgeHours * HOUR_MS;
  return sameAccount && stillAlive ? 'REGENERATE' : 'NONE';
}
