/**
 * Signed stream cursors for the vocabulary feed.
 *
 * Page 0 of a stream is free to ask for; every later page must carry the token the
 * previous page handed out. The token is stateless — an HMAC over the stream's identity
 * (seed, filters, catalog revision), the furthest position it may reach next, and an
 * expiry — so any server instance can check it without shared storage.
 *
 * What it buys: a client cannot jump straight to position 5000 of a stream, or fan one
 * seed out across parallel requests ahead of where it has actually read. A stream is
 * walked one page after another, and the only way to start another is a fresh page 0,
 * which the endpoint charges to a much tighter budget (NEW_STREAM_BUDGET).
 *
 * The secret is VOCAB_STREAM_SECRET when set; otherwise it is derived from the Supabase
 * service-role key, which every deployed instance already holds and no browser ever sees.
 * A local dev server with neither falls back to a fixed development secret.
 *
 * Exports: STREAM_TOKEN_TTL_MS, StreamIdentity, issueStreamToken, verifyStreamToken
 * Depends on: Web Crypto (globalThis.crypto.subtle)
 */

/** How long a stream stays resumable after its latest page. */
export const STREAM_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

/** Everything a token is bound to: a token from one stream never opens another. */
export type StreamIdentity = {
  seed: string;
  topic: string;
  level: string;
  difficulty: string;
  revision: string;
};

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function secretMaterial(): string {
  const explicit = process.env.VOCAB_STREAM_SECRET;
  if (explicit) return explicit;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return `kinemedia:vocab-stream:v1:${serviceKey}`;
  return "kinemedia:vocab-stream:dev-only";
}

function signingKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(secretMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return keyPromise;
}

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signature(identity: StreamIdentity, reach: number, expires: number) {
  const message = [
    "v1",
    reach,
    expires,
    identity.seed,
    identity.topic,
    identity.level,
    identity.difficulty,
    identity.revision,
  ].join("|");
  const mac = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(message));
  // 128 bits is plenty for a token that expires within hours.
  return base64url(mac).slice(0, 22);
}

/**
 * Issue the token a stream's next request must present.
 * @param identity - the stream the page was cut from
 * @param reach - the furthest position the stream may request next
 * @param now - current time, for tests
 * @returns `reach.expiresSeconds.signature`
 */
export async function issueStreamToken(
  identity: StreamIdentity,
  reach: number,
  now: number = Date.now(),
): Promise<string> {
  const expires = Math.floor((now + STREAM_TOKEN_TTL_MS) / 1000);
  return `${reach}.${expires}.${await signature(identity, reach, expires)}`;
}

/**
 * Check a presented token against the page being asked for.
 * @param token - as issued by issueStreamToken
 * @param identity - the stream the request claims to continue
 * @param position - the page position being requested
 * @param now - current time, for tests
 * @returns The token's reach when it admits this position, or null when it does not
 */
export async function verifyStreamToken(
  token: string,
  identity: StreamIdentity,
  position: number,
  now: number = Date.now(),
): Promise<number | null> {
  const match = /^(\d{1,9})\.(\d{1,12})\.([A-Za-z0-9_-]{22})$/.exec(token);
  if (!match) return null;
  const reach = Number(match[1]);
  const expires = Number(match[2]);
  if (expires * 1000 <= now || position > reach) return null;
  const expected = await signature(identity, reach, expires);
  // Constant-time compare: the signature is the only secret-dependent part.
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ match[3].charCodeAt(index);
  }
  return diff === 0 ? reach : null;
}
