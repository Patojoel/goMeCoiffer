import { Command } from '@nestjs/cqrs';
import type { NewAccountDetails } from '../../../domain/ports/invitee-accounts.port.js';
import type { AcceptInvitationResponse } from './accept-invitation.response.js';

interface AcceptInvitationInput {
  readonly invitationId: string;
  /** Jeton de preuve du numéro lu dans le cookie du navigateur ; `null` si le navigateur n'en porte pas. */
  readonly proofToken: string | null;
  /** Vide pour un compte du personnel existant ; sinon ce qu'il faut pour créer ou compléter le compte. */
  readonly details: NewAccountDetails | null;
  /** Session ouverte sur ce navigateur, s'il y en a une : sert seulement à choisir la session de réponse. */
  readonly session: {
    readonly userId: string;
    readonly credentialsVersion: number | null;
    /** Instant de la connexion (ms) : borne la durée absolue de la session. */
    readonly authenticatedAt: number | null;
  } | null;
  /** Durée absolue d'une session (configuration), lue par le mapper. */
  readonly sessionMaxAgeHours: number;
}

/** UC-007, intention 3 : accepter une invitation avec le numéro prouvé (jamais avec le compte de la session). */
export class AcceptInvitation extends Command<AcceptInvitationResponse> {
  readonly invitationId: string;
  readonly proofToken: string | null;
  readonly details: NewAccountDetails | null;
  readonly session: AcceptInvitationInput['session'];
  readonly sessionMaxAgeHours: number;

  constructor(input: AcceptInvitationInput) {
    super();
    this.invitationId = input.invitationId;
    this.proofToken = input.proofToken;
    this.details = input.details;
    this.session = input.session;
    this.sessionMaxAgeHours = input.sessionMaxAgeHours;
  }

  /** Une commande journalisée ou sérialisée ne montre ni le jeton de preuve ni le mot de passe. */
  toJSON() {
    return { invitationId: this.invitationId, proofToken: '***', details: this.details ? '***' : null };
  }
}
