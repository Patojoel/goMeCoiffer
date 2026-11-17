import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiError } from '@gomecoiffer/contracts';
import type { Response } from 'express';
import { BusinessRuleViolation, ConflictError, DomainError, NotFoundError } from '../../domain/errors.js';
import {
  CsrfInvalidError,
  ForbiddenError,
  RequestValidationError,
  UnauthenticatedError,
} from '../security/security-errors.js';

const HTTP_CODES: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
};

/** Traduit toute erreur en `ApiResponse` d'erreur ; seul l'inattendu (500) est loggé en erreur. */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.translate(error);
    if (status >= 500) this.logger.error({ err: error }, 'Erreur inattendue');
    res.status(status).json(body);
  }

  private translate(error: unknown): [number, ApiError] {
    const fail = (status: number, code: string, message: string): [number, ApiError] => [
      status,
      { status: 'ERROR', code, message },
    ];
    if (error instanceof RequestValidationError)
      return [400, { status: 'ERROR', code: error.code, message: error.message, errors: error.errors }];
    if (error instanceof UnauthenticatedError) return fail(401, error.code, error.message);
    if (error instanceof ForbiddenError || error instanceof CsrfInvalidError)
      return fail(403, error.code, error.message);
    if (error instanceof NotFoundError) return fail(404, 'NOT_FOUND', 'Ressource introuvable.');
    if (error instanceof ConflictError) return fail(409, error.code, error.message);
    if (error instanceof BusinessRuleViolation) return fail(422, error.code, error.message);
    if (error instanceof DomainError) return fail(422, error.code, error.message);
    if (error instanceof ThrottlerException)
      return fail(429, 'TOO_MANY_REQUESTS', 'Trop de tentatives : patientez une minute puis réessayez.');
    if (error instanceof HttpException && error.getStatus() < 500) {
      const status = error.getStatus();
      const message = status === 404 ? 'Ressource introuvable.' : 'Requête invalide.';
      return fail(status, HTTP_CODES[status] ?? 'BAD_REQUEST', message);
    }
    return fail(500, 'INTERNAL_ERROR', 'Une erreur inattendue est survenue. Réessayez dans un instant.');
  }
}
