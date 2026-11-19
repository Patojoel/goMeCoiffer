/** Ce que le domaine doit savoir d'un compte pour décider qu'il peut fonder une organisation. */
export interface OwnerCandidate {
  readonly userId: string;
  /** Faux pour un compte client léger (D-018). */
  readonly hasPassword: boolean;
  readonly ownsOrganization: boolean;
}
