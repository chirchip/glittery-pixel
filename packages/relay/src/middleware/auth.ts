import type { Request, Response, NextFunction } from 'express';
import { verifyToken, shouldRefreshToken, signToken } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      githubUsername?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.githubUsername = payload.github_username;

    if (shouldRefreshToken(payload)) {
      const newToken = signToken(payload.sub, payload.github_username);
      res.setHeader('X-GP-Refreshed-Token', newToken);
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
