import { ErrorCode } from '@gomecoiffer/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { t } from '../../i18n/i18n.js';
import { JOIN_SALON_API_ROUTES } from '../../modules/join-salon/infra/api-routes/JoinSalonApiRoutes.js';
import { PLATFORM_API_ROUTES } from '../../modules/platform/infra/api-routes/PlatformApiRoutes.js';
import { ROLES_API_ROUTES } from '../../modules/roles/infra/api-routes/RolesApiRoutes.js';
import { TEAM_API_ROUTES } from '../../modules/team/infra/api-routes/TeamApiRoutes.js';
import { codeToMessage, resolveApiErrorMessage } from '../codeToMessage.js';
import { assertSafeApiPath, parseApiEnvelope } from '../envelope.js';
import { HttpError, toApiFailure } from '../HttpError.js';

describe('API response unwrapping and error mapping', () => {
  it('unwraps an OK envelope and validates its payload with the contract schema', () => {
    const data = parseApiEnvelope(200, { status: 'OK', data: { count: 3 } }, z.object({ count: z.number() }));

    expect(data).toEqual({ count: 3 });
  });

  it('unwraps an OK envelope as-is when no schema is supplied', () => {
    const data = parseApiEnvelope(200, { status: 'OK', data: { ok: true } });

    expect(data).toEqual({ ok: true });
  });

  it('throws a typed HttpError carrying status, code, message and field errors on ERROR envelopes', () => {
    let caught: unknown;
    try {
      parseApiEnvelope(422, {
        status: 'ERROR',
        code: 'RULE_VIOLATED',
        message: 'Nom trop court',
        errors: [{ path: 'name', message: '2 caractères au moins' }],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpError);
    expect(caught).toMatchObject({
      status: 422,
      code: 'RULE_VIOLATED',
      message: 'Nom trop court',
      errors: [{ path: 'name', message: '2 caractères au moins' }],
    });
  });

  it('throws INTERNAL_ERROR when the payload does not match the ApiResponse envelope', () => {
    let caught: unknown;
    try {
      parseApiEnvelope(502, '<html>bad gateway</html>');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpError);
    expect(caught).toMatchObject({
      status: 502,
      code: ErrorCode.INTERNAL_ERROR,
    });
  });

  it('throws INTERNAL_ERROR without leaking ZodError details when OK payload breaks contract schema', () => {
    let caught: unknown;
    try {
      parseApiEnvelope(
        200,
        { status: 'OK', data: { count: 'not-a-number' } },
        z.object({ count: z.number() }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpError);
    expect(caught).toMatchObject({
      status: 200,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Réponse du serveur illisible.',
    });
  });

  it('validates relative API paths and rejects protocol-relative or unprefixed targets', () => {
    expect(() => assertSafeApiPath('/api/public/health')).not.toThrow();
    expect(() => assertSafeApiPath('//evil.example/steal')).toThrow(HttpError);
    expect(() => assertSafeApiPath('.evil.example/steal')).toThrow(HttpError);
    expect(() => assertSafeApiPath('/api/public/a b')).toThrow(HttpError);
  });

  it('serializes HttpError and masks unexpected internal errors into generic ApiFailure objects', () => {
    const httpFailure = toApiFailure(
      new HttpError(409, ErrorCode.SLOT_NO_LONGER_AVAILABLE, 'Créneau pris', [
        { path: 'slot', message: 'pris' },
      ]),
    );
    const unknownFailure = toApiFailure(new Error('SQL constraint internal detail'));

    expect(httpFailure).toEqual({
      status: 409,
      code: ErrorCode.SLOT_NO_LONGER_AVAILABLE,
      message: 'Créneau pris',
      errors: [{ path: 'slot', message: 'pris' }],
    });
    expect(httpFailure).not.toBeInstanceOf(Error);
    expect(unknownFailure).toEqual({
      status: 0,
      code: 'UNKNOWN',
      message: 'Une erreur inattendue est survenue.',
    });
  });

  it.each([
    [ErrorCode.UNAUTHENTICATED, 'errors.unauthenticated.staff'],
    ['STAFF_SIGN_IN_REQUIRED', 'errors.forbidden.staffSignInRequired'],
    [ErrorCode.FORBIDDEN, 'errors.forbidden.permission'],
    [ErrorCode.NOT_FOUND, 'errors.notFound'],
    [ErrorCode.CONFLICT, 'errors.conflict'],
    [ErrorCode.CONCURRENCY_CONFLICT, 'errors.conflict'],
    [ErrorCode.SLOT_NO_LONGER_AVAILABLE, 'errors.slotNoLongerAvailable'],
    [ErrorCode.TOO_MANY_REQUESTS, 'errors.tooManyRequests'],
    ['NETWORK_ERROR', 'errors.network'],
    ['UNKNOWN_BUSINESS_CODE', 'errors.generic'],
  ])('maps error code %s to i18n key %s', (code, expectedKey) => {
    expect(codeToMessage(code)).toBe(expectedKey);
  });

  it('encodes slashes and traversal dots safely on every parameterized API route', () => {
    const hostileId = '../secret/path';
    const hostileRole = '../SUPER_ADMIN/extra';

    const routes = [
      TEAM_API_ROUTES.cancelInvitation(hostileId),
      TEAM_API_ROUTES.changeRole(hostileId),
      TEAM_API_ROUTES.removeMember(hostileId),
      JOIN_SALON_API_ROUTES.accept(hostileId),
      ROLES_API_ROUTES.adjustPermissions(hostileRole),
      PLATFORM_API_ROUTES.revokeRole(hostileId, hostileRole),
    ];

    for (const route of routes) {
      expect(() => assertSafeApiPath(route)).not.toThrow();
      expect(route).toContain('%2F');
      expect(route).toContain('%2E');
      expect(route).not.toContain('..');
    }

    const dotOnlyRoute = TEAM_API_ROUTES.cancelInvitation('..');
    expect(dotOnlyRoute).toBe('/api/salon/invitations/%2E%2E/cancellation');
  });

  it('masks internal, network, unauthenticated and unknown failures while preserving 4xx business messages', () => {
    expect(
      resolveApiErrorMessage({ status: 0, code: 'NETWORK_ERROR', message: 'TypeError: failed to fetch' }),
    ).toBe(t('errors.network'));
    expect(
      resolveApiErrorMessage({ status: 500, code: ErrorCode.INTERNAL_ERROR, message: 'pg detail leak' }),
    ).toBe(t('errors.generic'));
    expect(
      resolveApiErrorMessage({
        status: 401,
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Raw token mismatch',
      }),
    ).toBe(t('errors.unauthenticated.staff'));
    expect(
      resolveApiErrorMessage({ status: 422, code: 'UNKNOWN', message: 'Internal trace' }),
    ).toBe(t('errors.generic'));
    expect(
      resolveApiErrorMessage({ status: 422, code: 'RULE_VIOLATED', message: 'Le salon est déjà complet.' }),
    ).toBe('Le salon est déjà complet.');
    expect(
      resolveApiErrorMessage({ status: 403, code: 'STAFF_SIGN_IN_REQUIRED', message: '   ' }),
    ).toBe(t('errors.forbidden.staffSignInRequired'));
    expect(
      resolveApiErrorMessage(new HttpError(409, ErrorCode.SLOT_NO_LONGER_AVAILABLE, 'Créneau déjà réservé.')),
    ).toBe('Créneau déjà réservé.');
    expect(resolveApiErrorMessage(new Error('SQL constraint internal detail'))).toBe(t('errors.generic'));
    expect(resolveApiErrorMessage(null)).toBe(t('errors.generic'));
  });
});
