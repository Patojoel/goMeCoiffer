const SESSION_MUTATION_PATHS = new Set([
  '/api/salon/session/active-salon',
  '/api/salon/organizations',
  '/api/salon/salons',
  '/api/public/auth/sign-in',
  '/api/public/auth/sign-out',
  '/api/public/auth/password-reset',
  '/api/public/sign-up',
  '/api/public/client/session',
]);

const INVITATION_ACCEPTANCE_PATH = /^\/api\/public\/invitations\/[^/]+\/acceptance$/;

export function isSessionMutationPath(path: string): boolean {
  return SESSION_MUTATION_PATHS.has(path) || INVITATION_ACCEPTANCE_PATH.test(path);
}
