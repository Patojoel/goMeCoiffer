interface TrackedRequest {
  readonly session?: { readonly userId?: unknown };
  readonly ip?: unknown;
}

/** Compteur par utilisateur connecté (D-056) ; repli sur l'adresse si la requête n'en porte pas. */
export const trackByStaffUser = (req: TrackedRequest): string =>
  typeof req.session?.userId === 'string' && req.session.userId !== ''
    ? `user:${req.session.userId}`
    : `address:${String(req.ip ?? 'unknown')}`;
