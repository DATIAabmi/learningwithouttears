import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { appBaseUrl, auth0ClientId, auth0Issuer } from "@/lib/auth0";

export const dynamic = "force-dynamic";

// Clears our session, then ends the Auth0 session so the next sign-in
// prompts again instead of silently reusing it.
export async function GET(request: NextRequest) {
  const logout = new URL("v2/logout", auth0Issuer());
  logout.search = new URLSearchParams({
    client_id: auth0ClientId(),
    returnTo: `${appBaseUrl(request)}/login`,
  }).toString();

  const response = NextResponse.redirect(logout);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
