/**
 * Sérialiseur pino des erreurs : garde ce qui sert au diagnostic (type, message, code SQLSTATE, contrainte,
 * table, pile) et jamais la requête, ses paramètres ni le `detail` PostgreSQL, qui recopient les valeurs
 * de la ligne (téléphone, nom du client).
 */
export function safeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error };
  const e = error as Error & {
    code?: unknown;
    constraint?: unknown;
    table?: unknown;
    driverError?: { code?: unknown };
  };
  return {
    type: e.name,
    // Le message d'une erreur SQL peut citer la valeur refusée (« invalid input syntax … : "…" »).
    message: e.driverError ? undefined : e.message,
    code: e.code ?? e.driverError?.code,
    constraint: e.constraint,
    table: e.table,
    stack: e.stack,
  };
}
