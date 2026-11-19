import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  type ActiveSalonSelected,
  type SelectActiveSalon,
  SelectActiveSalonSchema,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { AuthenticatedOnly, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { ActiveSalonResponder } from './active-salon.responder.js';
import { toSelectActiveSalon } from './mappers/select-active-salon.request-mapper.js';

/** UC-005 — ouvrir un salon ou en changer. Aucun salon actif requis : c'est ce qu'on choisit. */
@Controller('salon/session')
export class ActiveSalonController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly session: ActiveSalonResponder,
  ) {}

  @Post('active-salon')
  @HttpCode(200)
  @AuthenticatedOnly()
  async select(
    @Body({ schema: SelectActiveSalonSchema }) body: SelectActiveSalon,
    @CurrentActor() actor: Actor,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ActiveSalonSelected> {
    const selected = await this.commands.execute(toSelectActiveSalon(body, actor));
    return this.session.activeSalonSelected(req, res, actor, selected);
  }
}
