import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isAuthenticated } from "@/shared/utils/apiAuth";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const secret = process.env.API_KEY_SECRET || process.env.JWT_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "No API_KEY_SECRET configured" }, { status: 500 });
  }

  const token = createHash("sha256")
    .update(`omniroute-bootstrap:${secret}`)
    .digest("hex")
    .slice(0, 16);

  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:20128";
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "http";

  return NextResponse.json({
    token,
    url: `${proto}://${host}/api/bootstrap/${token}`,
    curl: `curl -fsSL ${proto}://${host}/api/bootstrap/${token} | bash`,
  });
}
