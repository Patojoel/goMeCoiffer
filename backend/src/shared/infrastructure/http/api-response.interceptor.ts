import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { ApiSuccess } from '@gomecoiffer/contracts';
import { map, type Observable } from 'rxjs';

/** Enveloppe toute réponse réussie dans `{ status: 'OK', data }` (sauf flux SSE). */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.reflector.get<boolean>(SSE_METADATA, ctx.getHandler())) return next.handle();
    return next
      .handle()
      .pipe(map((data: unknown): ApiSuccess<unknown> => ({ status: 'OK', data: data ?? null })));
  }
}
