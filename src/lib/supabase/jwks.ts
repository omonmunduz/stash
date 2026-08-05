/**
 * SHARED JWKS CACHE
 *
 * Supabase signs this project's access tokens with ES256, so a JWT can be
 * verified locally with WebCrypto instead of asking the Auth server who the
 * caller is. Verification needs the project's public keys, and fetching those
 * per request would just move the round trip rather than remove it.
 *
 * auth-js caches JWKs on the client instance, but both callers here build a
 * fresh Supabase client per request — middleware because it wires request
 * cookies in, lib/supabase/server.ts because it reads the cookie store. That
 * makes the instance cache permanently cold. Module scope survives for the life
 * of the runtime instance instead, so a warm one verifies with zero network
 * calls.
 *
 * Middleware (Edge) and the server client (Node) each get their own copy of this
 * module. That is fine: they warm independently, and one cold fetch per runtime
 * per TTL is the entire cost.
 *
 * Uses nothing but fetch() and Date.now(), so it is safe on both runtimes.
 */

import type { JWK } from '@supabase/supabase-js';

/**
 * Signing keys rotate rarely, and getClaims() falls back to its own fetch on a
 * kid miss, so a stale entry costs one extra request rather than a failure.
 */
const JWKS_TTL_MS = 10 * 60 * 1000;

let jwksPromise: Promise<{ keys: JWK[] } | undefined> | null = null;
let jwksFetchedAt = 0;

/**
 * The project's JWKS, or undefined if it could not be fetched.
 *
 * Returns undefined rather than throwing: passing undefined to getClaims() makes
 * it fetch the keys itself, so a failure here degrades to the old latency
 * instead of breaking authentication.
 *
 * The promise is cached rather than the resolved value, so a burst of requests
 * against a cold instance shares one fetch instead of racing.
 */
export async function getJwks(): Promise<{ keys: JWK[] } | undefined> {
  if (jwksPromise && Date.now() - jwksFetchedAt < JWKS_TTL_MS) {
    return jwksPromise;
  }

  jwksFetchedAt = Date.now();
  jwksPromise = fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  )
    .then((res): Promise<{ keys?: JWK[] } | undefined> =>
      res.ok ? res.json() : Promise.resolve(undefined)
    )
    .then((body) => (body?.keys?.length ? { keys: body.keys } : undefined))
    .catch(() => undefined);

  const jwks = await jwksPromise;

  // A failed fetch must not be cached for the full TTL — the next request should
  // get a fresh attempt rather than ten minutes of guaranteed misses.
  if (!jwks) {
    jwksPromise = null;
    jwksFetchedAt = 0;
  }

  return jwks;
}
