import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Demo mode has no auth server, so the chosen demo user id is kept in an
 * HMAC-signed cookie. Tampering with the id (for example to become the admin)
 * invalidates the signature. The secret falls back to a per-process random
 * value, which simply signs everyone out on restart.
 */

const globalSecret = globalThis as typeof globalThis & { __demoSessionSecret?: string };

function secret(): string {
  globalSecret.__demoSessionSecret ??=
    process.env.DEMO_SESSION_SECRET ?? randomBytes(32).toString('hex');
  return globalSecret.__demoSessionSecret;
}

function sign(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url');
}

export function encodeDemoSession(userId: string, key = secret()): string {
  return `${userId}.${sign(userId, key)}`;
}

export function decodeDemoSession(cookie: string | undefined, key = secret()): string | null {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = cookie.slice(0, dot);
  const given = Buffer.from(cookie.slice(dot + 1));
  const expected = Buffer.from(sign(userId, key));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
