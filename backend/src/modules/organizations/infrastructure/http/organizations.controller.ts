import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  type CreateOrganization,
  CreateOrganizationSchema,
  type OrganizationCreated,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { AuthenticatedOnly, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { toCreateOrganization } from './mappers/create-organization.request-mapper.js';
import { OwnerSessionResponder } from './owner-session.responder.js';

/** UC-004 — créer son organisation et son premier salon. Aucun salon actif requis : on n'en a pas encore. */
@Controller('salon/organizations')
export class OrganizationsController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly session: OwnerSessionResponder,
  ) {}

  @Post()
  @HttpCode(201)
  @AuthenticatedOnly()
  async create(
    @Body({ schema: CreateOrganizationSchema }) body: CreateOrganization,
    @CurrentActor() actor: Actor,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrganizationCreated> {
    const created = await this.commands.execute(toCreateOrganization(body, actor));
    return this.session.organizationCreated(req, res, actor, created);
  }
}
