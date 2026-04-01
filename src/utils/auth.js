import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * @typedef {Object} UserPayload
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string} [picture]
 */

/**
 * @param {string} token
 * @returns {Promise<UserPayload>}
 */
export async function verifyGoogleToken(token) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is missing");
  }

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: clientId,
  });

  if (!payload.sub || !payload.email || !payload.name) {
    throw new Error("Invalid token payload: missing required fields");
  }

  return {
    id: payload.sub,
    email: /** @type {string} */ (payload.email),
    name: /** @type {string} */ (payload.name),
    picture: /** @type {string} */ (payload.picture),
  };
}

/**
 * @param {UserPayload} user
 * @returns {Promise<string>}
 */
export async function createSession(user) {
  const secretStr = Deno.env.get("SESSION_SECRET");
  if (!secretStr) {
    throw new Error("SESSION_SECRET environment variable is missing");
  }

  const secret = new TextEncoder().encode(secretStr);

  return await new SignJWT({ ...user })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d") // 30 days
      .sign(secret);
}

/**
 * @param {string} token
 * @returns {Promise<UserPayload | null>}
 */
export async function getSession(token) {
  if (!token) return null;

  const secretStr = Deno.env.get("SESSION_SECRET");
  if (!secretStr) {
    throw new Error("SESSION_SECRET environment variable is missing");
  }

  const secret = new TextEncoder().encode(secretStr);

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: /** @type {string} */ (payload.id),
      email: /** @type {string} */ (payload.email),
      name: /** @type {string} */ (payload.name),
      picture: /** @type {string} */ (payload.picture),
    };
  } catch (_e) {
    return null;
  }
}
