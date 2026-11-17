/** Codes SQLSTATE utiles : 23505 unicité, 23P01 exclusion (créneau déjà pris). */
export function isPgError(error: unknown, code: '23505' | '23P01' | '40001'): boolean {
  const e = error as { code?: string; driverError?: { code?: string } } | null;
  return e?.code === code || e?.driverError?.code === code;
}
