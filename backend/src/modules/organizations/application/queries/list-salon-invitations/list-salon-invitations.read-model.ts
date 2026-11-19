import type { SalonInvitation } from '@gomecoiffer/contracts';

/** Invitation du salon (contrat `SalonInvitationSchema`) : jamais d'auteur ni de jeton. */
export type SalonInvitationReadModel = Readonly<SalonInvitation>;
