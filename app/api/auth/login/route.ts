import { NextRequest, NextResponse } from "next/server";
import {
  AUTH0_TX_COOKIE,
  TX_MAX_AGE_SECONDS,
  auth0ClientId,
  auth0Issuer,
  auth0Organization,
  callbackUrl,
  pkceChallenge,
  randomToken,
  safeReturnTo,
  signTransaction,
} from "@/lib/auth0";

export const dynamic = "force-dynamic";

// Starts Auth0 Universal Login. The state, nonce, PKCE verifier and return
// path are kept in a short-lived signed cookie and checked in /api/auth/callback.
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("from"));
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();

  const authorize = new URL("authorize", auth0Issuer());
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: auth0ClientId(),
    redirect_uri: callbackUrl(request),
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  const organization = auth0Organization();
  if (organization) authorize.searchParams.set("organization", organization);

  const response = NextResponse.redirect(authorize);
  response.cookies.set(AUTH0_TX_COOKIE, await signTransaction({ state, nonce, verifier, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TX_MAX_AGE_SECONDS,
    path: "/api/auth",
  });
  return response;
}
