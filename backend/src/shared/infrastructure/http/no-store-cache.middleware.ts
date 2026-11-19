import type { NextFunction, Request, Response } from 'express';

/** Empêche la mise en cache (navigateur ou proxy) des réponses authentifiées d'un salon ou de l'administration. */
export function noStorePrivateRoutes(req: Request, res: Response, next: NextFunction): void {
  if (
    req.path === '/api/salon' ||
    req.path.startsWith('/api/salon/') ||
    req.path === '/api/admin' ||
    req.path.startsWith('/api/admin/')
  ) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

