//backend/src/lib/zohoAuth.ts

import { prisma } from './db';

/**
 * Zoho OAuth2 token management with DB-backed caching.
 * Direct port of the Edge Function token logic.
 */

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let refreshInFlight: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ZohoRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds = 60) {
    super(message);
    this.name = 'ZohoRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedAccessToken && tokenExpiresAt > now + 300_000) {
    return cachedAccessToken;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    // Check DB cache
    try {
      const cached = await prisma.zohoTokenCache.findUnique({ where: { id: 'default' } });
      if (cached && new Date(cached.expiresAt).getTime() > now + 300_000) {
        cachedAccessToken = cached.accessToken;
        tokenExpiresAt = new Date(cached.expiresAt).getTime();
        return cachedAccessToken!;
      }
    } catch (err) {
      console.warn('DB token cache read failed:', err);
    }

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.eu';

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN');
    }

    const backoffMs = [500, 1500, 3000];
    let lastError: string | null = null;

    for (let attempt = 0; attempt < backoffMs.length; attempt++) {
      const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });

      const data = await res.json() as any;

      if (data.error) {
        lastError = data.error_description || data.error;
        const isRateLimited =
          data.error === 'Access Denied' &&
          (data.error_description || '').toLowerCase().includes('too many requests');

        if (isRateLimited && attempt < backoffMs.length - 1) {
          await sleep(backoffMs[attempt]);
          continue;
        }
        if (isRateLimited) {
          throw new ZohoRateLimitError(`Token refresh rate-limited: ${lastError}`, 60);
        }
        throw new Error(`Token refresh failed: ${data.error}`);
      }

      cachedAccessToken = data.access_token;
      tokenExpiresAt = now + data.expires_in * 1000;

      // Persist to DB
      try {
        await prisma.zohoTokenCache.upsert({
          where: { id: 'default' },
          update: {
            accessToken: cachedAccessToken!,
            expiresAt: new Date(tokenExpiresAt),
          },
          create: {
            id: 'default',
            accessToken: cachedAccessToken!,
            expiresAt: new Date(tokenExpiresAt),
          },
        });
      } catch (dbErr) {
        console.warn('Failed to cache token to DB:', dbErr);
      }

      return cachedAccessToken!;
    }

    throw new Error(`Token refresh failed: ${lastError || 'Unknown error'}`);
  })();

  try {
    return await refreshInFlight!;
  } finally {
    refreshInFlight = null;
  }
}

export function formatZohoDateTime(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}
