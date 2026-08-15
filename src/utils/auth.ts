import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { UserPayload } from "../types.ts";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export function isEmailAllowed(email: string): boolean {
  const allowedEmails = Deno.env.get("ALLOWED_EMAILS");
  if (!allowedEmails) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return allowedEmails
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .includes(normalizedEmail);
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

  if (
    typeof payload.sub !== "string" || typeof payload.email !== "string" ||
    typeof payload.name !== "string"
  ) {
    throw new Error("Invalid token payload: missing required fields");
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

export async function createSession(user: UserPayload): Promise<string> {
  const secretStr = Deno.env.get("SESSION_SECRET");
  if (!secretStr) {
    throw new Error("SESSION_SECRET environment variable is missing");
  }

  const secret = new TextEncoder().encode(secretStr);

  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
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
    if (
      typeof payload.id !== "string" || typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }

    if (!isEmailAllowed(payload.email)) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      picture: typeof payload.picture === "string"
        ? payload.picture
        : undefined,
    };
  } catch (_error) {
    return null;
  }
}
