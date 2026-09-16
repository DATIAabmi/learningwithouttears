import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE, MAX_AGE_SECONDS } from "@/lib/auth";

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL!;
const REQUIRED_GROUP = process.env.REQUIRED_METABASE_GROUP ?? "";

interface MbUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  user_group_memberships: { id: number }[];
}

interface MbGroup {
  id: number;
  name: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // 1. Authenticate against Metabase
  let mbSessionToken: string;
  try {
    const res = await fetch(`${METABASE_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });

    if (res.status === 401 || res.status === 400) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 502 });
    }

    const data = await res.json();
    mbSessionToken = data.id;
  } catch {
    return NextResponse.json({ error: "Could not reach the server — try again" }, { status: 502 });
  }

  // 2. Fetch current user info + group memberships
  let user: MbUser;
  try {
    const res = await fetch(`${METABASE_URL}/api/user/current`, {
      headers: { "X-Metabase-Session": mbSessionToken },
    });
    if (!res.ok) {
      console.error("login: /api/user/current failed", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "Could not fetch user info" }, { status: 502 });
    }
    user = await res.json();
  } catch (err) {
    console.error("login: /api/user/current threw", err);
    return NextResponse.json({ error: "Could not fetch user info" }, { status: 502 });
  }

  // 3. If a required group is configured, verify membership
  let groupNames: string[] = [];
  if (REQUIRED_GROUP) {
    try {
      // Metabase's /api/user/current omits user_group_memberships for
      // non-admin sessions (it's only reliably present for superusers or
      // when an admin queries another user), so re-fetch this specific
      // user's record via /api/user/:id using the admin API key instead of
      // trusting whatever /api/user/current returned in step 2.
      const [userRes, groupsRes] = await Promise.all([
        fetch(`${METABASE_URL}/api/user/${user.id}`, {
          headers: { "x-api-key": process.env.METABASE_ADMIN_API_KEY! },
        }),
        fetch(`${METABASE_URL}/api/permissions/group`, {
          headers: { "x-api-key": process.env.METABASE_ADMIN_API_KEY! },
        }),
      ]);
      if (!userRes.ok) {
        console.error("login: /api/user/:id failed", userRes.status, await userRes.text().catch(() => ""));
        return NextResponse.json({ error: "Could not verify group membership" }, { status: 502 });
      }
      if (!groupsRes.ok) {
        console.error("login: /api/permissions/group failed", groupsRes.status, await groupsRes.text().catch(() => ""));
        return NextResponse.json({ error: "Could not verify group membership" }, { status: 502 });
      }
      const userWithGroups: MbUser = await userRes.json();
      const allGroups: MbGroup[] = await groupsRes.json();

      const userGroupIds = new Set((userWithGroups.user_group_memberships ?? []).map((m) => m.id));
      groupNames = allGroups
        .filter((g) => userGroupIds.has(g.id))
        .map((g) => g.name);

      if (!user.is_superuser && !groupNames.includes(REQUIRED_GROUP)) {
        return NextResponse.json(
          { error: `Your account is not in the "${REQUIRED_GROUP}" group` },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("login: group verification threw", err);
      return NextResponse.json({ error: "Could not verify group membership" }, { status: 502 });
    }
  }

  // 4. Issue our own session cookie
  const token = await signSession({
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    groups: groupNames,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
