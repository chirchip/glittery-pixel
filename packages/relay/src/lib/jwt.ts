import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface JwtPayload {
  sub: string;
  github_username: string;
  iat: number;
  exp: number;
}

export function signToken(userId: string, githubUsername: string): string {
  return jwt.sign(
    { sub: userId, github_username: githubUsername },
    config.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function shouldRefreshToken(payload: JwtPayload): boolean {
  const sevenDaysInSeconds = 7 * 24 * 60 * 60;
  const timeUntilExpiry = payload.exp - Math.floor(Date.now() / 1000);
  return timeUntilExpiry < sevenDaysInSeconds;
}
