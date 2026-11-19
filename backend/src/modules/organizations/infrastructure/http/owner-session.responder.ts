import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { OrganizationCreated } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import type { Actor } from '../../../../shared/application/ports.js';
import { regenerateSessionOnSalon } from '../../../../shared/infrastructure/security/authenticated-session.js';
import {
  CSRF_PROTECTION,
  type CsrfProtection,
} from '../../../../shared/infrastructure/security/http-security.js';
import { GetMySession } from '../../../identity/application/queries/get-my-session/get-my-session.query.js';
import type { CreateOrganizationResponse } from '../../application/commands/create-organization/create-organization.response.js';

/** Effets HTTP qui suivent la création de l'organisation : la session change de privilèges (D-037). */
@Injectable()
export class OwnerSessionResponder {
  constructor(
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
  ) {}

  async organizationCreated(
    req: Request,
    res: Response,
    actor: Pick<Actor, 'userId'>,
    created: CreateOrganizationResponse,
  ): Promise<OrganizationCreated> {
    await regenerateSessionOnSalon(req, created.salonId);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    const session = await this.queries.execute(new GetMySession(actor.userId, created.salonId));
    return { ...created, csrfToken, session };
  }
}
