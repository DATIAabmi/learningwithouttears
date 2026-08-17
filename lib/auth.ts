import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "__ras_session";
export const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET env var is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}
