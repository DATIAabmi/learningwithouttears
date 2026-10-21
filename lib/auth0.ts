import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { getSecret } from "@/lib/auth";

// Auth0 Universal Login (OIDC authorization code flow + PKCE).
// Required env: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET.
// Optional env: APP_BASE_URL (defaults to the request origin),
// AUTH0_ORGANIZATION (org_... ID; when set, only members of that organization can sign in).

export const AUTH0_TX_COOKIE = "__ras_auth0_tx";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is not set`);
  return v;
}

export function auth0Issuer(): string {
  const domain = env("AUTH0_DOMAIN").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}/`;
}

export function auth0ClientId(): string {
  return env("AUTH0_CLIENT_ID");
}

export function auth0ClientSecret(): string {
  return env("AUTH0_CLIENT_SECRET");
}

export function auth0Organization(): string | undefined {
  return process.env.AUTH0_ORGANIZATION || undefined;
}

export function appBaseUrl(request: NextRequest): string {
  return (process.env.APP_BASE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
}

export function callbackUrl(request: NextRequest): string {
  return `${appBaseUrl(request)}/api/auth/callback`;
}

// Only allow same-site relative paths as post-login destinations.
export function safeReturnTo(from: string | null | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return "/";
  return from;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

// Login transaction carried from /api/auth/login to /api/auth/callback.
export interface LoginTransaction {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
}

export const TX_MAX_AGE_SECONDS = 60 * 10;

export async function signTransaction(tx: LoginTransaction): Promise<string> {
  return new SignJWT({ ...tx })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TX_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyTransaction(token: string): Promise<LoginTransaction | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as LoginTransaction;
  } catch {
    return null;
  }
}

let jwks:ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyIdToken(idToken: string, nonce: string) {
  const issuer = auth0Issuer();
  jwks ??= createRemoteJWKSet(new URL(".well-known/jwks.json", issuer));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: auth0ClientId(),
  });
  if (payload.nonce !== nonce) throw new Error("ID token nonce mismatch");
  return payload as {
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
    org_id?: string;
  };
}
