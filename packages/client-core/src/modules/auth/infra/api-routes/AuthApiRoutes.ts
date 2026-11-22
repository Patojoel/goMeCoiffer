export const AUTH_API_ROUTES = {
  session: '/api/salon/session',
  signIn: '/api/public/auth/sign-in',
  signOut: '/api/public/auth/sign-out',
  requestSignUpCode: '/api/public/sign-up/code',
  confirmSignUp: '/api/public/sign-up',
  requestPasswordResetCode: '/api/public/auth/password-reset/code',
  resetPassword: '/api/public/auth/password-reset',
} as const;
