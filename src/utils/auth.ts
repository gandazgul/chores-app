import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export async function verifyGoogleToken(token: string): Promise<UserPayload> {
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
    email: payload.email as string,
    name: payload.name as string,
    picture: payload.picture as string,
  };
}

export async function createSession(user: UserPayload): Promise<string> {
  const secretStr = Deno.env.get("SESSION_SECRET");
  if (!secretStr) {
    throw new Error("SESSION_SECRET environment variable is missing");
  }

  const secret = new TextEncoder().encode(secretStr);

  const jwt = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d") // 30 days
    .sign(secret);

  return jwt;
}

export async function getSession(token: string): Promise<UserPayload | null> {
  if (!token) return null;

  const secretStr = Deno.env.get("SESSION_SECRET");
  if (!secretStr) {
    throw new Error("SESSION_SECRET environment variable is missing");
  }

  const secret = new TextEncoder().encode(secretStr);

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      picture: payload.picture as string,
    };
  } catch (_e) {
    return null;
  }
}
