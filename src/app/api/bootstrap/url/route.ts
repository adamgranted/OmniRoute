import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import {
  deriveBootstrapToken,
  getBootstrapBaseUrl,
  quoteShellValue,
} from "@/shared/utils/bootstrap";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const token = deriveBootstrapToken();
  if (!token) {
    return NextResponse.json({ error: "No API_KEY_SECRET configured" }, { status: 500 });
  }

  const baseUrl = getBootstrapBaseUrl(request);
  const scriptUrl = `${baseUrl}/api/bootstrap/${token}`;

  return NextResponse.json({
    token,
    url: scriptUrl,
    curl: `curl -fsSL ${quoteShellValue(scriptUrl)} | bash`,
  });
}
