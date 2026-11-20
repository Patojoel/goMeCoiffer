import type { InvitationsForProvenPhone } from '@gomecoiffer/contracts';

/** Contrat `InvitationsForProvenPhoneSchema` : jamais l'auteur de l'invitation ni le numéro. */
export type InvitationsForProvenPhoneReadModel = Readonly<{
  account: InvitationsForProvenPhone['account'];
  invitations: readonly Readonly<InvitationsForProvenPhone['invitations'][number]>[];
}>;
