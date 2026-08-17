import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = process.env.METABASE_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing METABASE_JWT_SECRET" }, { status: 500 });
  }

  const token = jwt.sign(
    {
      email: "embedding@datiak12.io",
      first_name: "Embed",
      last_name: "User",
      groups: ["All Users"],
      exp: Math.round(Date.now() / 1000) + 60 * 10,
    },
    secret,
  );

  return NextResponse.json({ jwt: token });
}
