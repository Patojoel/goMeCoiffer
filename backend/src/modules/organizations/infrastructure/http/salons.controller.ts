import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AddSalonToOrganization,
  AddSalonToOrganizationSchema,
  type SalonAdded,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { CurrentActor, RequiresPermission } from '../../../../shared/infrastructure/security/decorators.js';
import { toAddSalonToOrganization } from './mappers/add-salon-to-organization.request-mapper.js';
import { trackByStaffUser } from './rate-limit-trackers.js';
import { SalonAddedResponder } from './salon-added.responder.js';

/** UC-010 — ajouter un salon à son organisation existante (propriétaire uniquement, D-056). */
@Controller('salon/salons')
export class SalonsController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly responder: SalonAddedResponder,
  ) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('organization:manage-salons')
  @Throttle({ default: { limit: 20, ttl: 3_600_000, getTracker: trackByStaffUser } })
  async add(
    @Body({ schema: AddSalonToOrganizationSchema }) body: AddSalonToOrganization,
    @CurrentActor() actor: Actor,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SalonAdded> {
    const added = await this.commands.execute(toAddSalonToOrganization(body, actor));
    return this.responder.added(req, res, actor, added);
  }
}

