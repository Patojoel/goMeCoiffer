import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { CsrfToken, Health } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../security/decorators.js';
import { CSRF_PROTECTION, type CsrfProtection } from '../security/http-security.js';

@Controller('public')
@Public()
export class PublicController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
  ) {}

  @Get('health')
  async health(): Promise<Health> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'ok', database: 'down' };
    }
  }

  /** Jeton à renvoyer dans l'en-tête x-csrf-token sur toute écriture ; lié à la session du navigateur. */
  @Get('session/csrf')
  csrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response): CsrfToken {
    req.session.visitor = true;
    res.setHeader('Cache-Control', 'no-store');
    return { csrfToken: this.csrf.generateCsrfToken(req, res) };
  }
}
