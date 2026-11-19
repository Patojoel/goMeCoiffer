/** Rien sur le compte éventuel du numéro (D-019). */
export interface InviteCollaboratorResponse {
  readonly invitationId: string;
  readonly name: string;
  readonly phone: string;
  readonly role: string;
  readonly expiresAt: string;
}
