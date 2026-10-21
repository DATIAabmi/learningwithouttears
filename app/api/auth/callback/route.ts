import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, MAX_AGE_SECONDS } from "@/lib/auth";
import {
  AUTH0_TX_COOKIE,
  appBaseUrl,
  auth0ClientId,
  auth0ClientSecret,
  auth0Issuer,
  auth0Organization,
  callbackUrl,
  verifyIdToken,
  verifyTransaction,
} from "@/lib/auth0";

export const dynamic = "force-dynamic";

function fail(request: NextRequest, message: string) {
  const loginUrl = new URL("/login", appBaseUrl(request));
  loginUrl.searchParams.set("error", message);
  const res = NextResponse.redirect(loginUrl);
  res.cookies.delete({ name: AUTH0_TX_COOKIE, path: "/api/auth" });
  return res;
}

// Auth0 redirects here after Universal Login. Exchange the code for tokens,
// verify the ID token, then issue our own session cookie.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const auth0Error = params.get("error_description") ?? params.get("error");
  if (auth0Error) return fail(request, auth0Error);

  const txCookie = request.cookies.get(AUTH0_TX_COOKIE)?.value;
  const tx = txCookie ? await verifyTransaction(txCookie) : null;
  if (!tx || params.get("state") !== tx.state) {
    return fail(request, "Your sign-in session expired — please try again");
  }

  const code = params.get("code");
  if (!code) return fail(request, "Missing authorization code");

  let idToken: string;
  try {
    const res = await fetch(new URL("oauth/token", auth0Issuer()), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: auth0ClientId(),
        client_secret: auth0ClientSecret(),
        code,
        code_verifier: tx.verifier,
        redirect_uri: callbackUrl(request),
      }),
    });
    if (!res.ok) return fail(request, "Authentication failed");
    idToken = (await res.json()).id_token;
  } catch {
    return fail(request, "Could not reach Auth0 — try again");
  }

  let claims: Awaited<ReturnType<typeof verifyIdToken>>;
  try {
    claims = await verifyIdToken(idToken, tx.nonce);
  } catch {
    return fail(request, "Could not verify your identity");
  }

  const organization = auth0Organization();
  if (organization && claims.org_id !== organization) {
    return fail(request, "Your account is not a member of this organization");
  }

  if (!claims.email) return fail(request, "Your Auth0 account has no email address");

  const [first = "", ...rest] = (claims.name ?? "").split(" ");
  const token = await signSession({
    email: claims.email,
    firstName: claims.given_name ?? first,
    lastName: claims.family_name ?? rest.join(" "),
    groups: [],
  });

  const response = NextResponse.redirect(new URL(tx.returnTo, appBaseUrl(request)));
  response.cookies.delete({ name: AUTH0_TX_COOKIE, path: "/api/auth" });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
