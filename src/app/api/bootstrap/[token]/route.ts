import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_CONFIG } from "@/shared/constants/config";

const BOOTSTRAP_TOKEN = deriveBootstrapToken();
const SCRIPT_TEMPLATE = loadScript();

function deriveBootstrapToken(): string {
  const secret = process.env.API_KEY_SECRET || process.env.JWT_SECRET || "";
  if (!secret) return "";
  return createHash("sha256").update(`omniroute-bootstrap:${secret}`).digest("hex").slice(0, 16);
}

function loadScript(): string {
  try {
    return readFileSync(join(process.cwd(), "scripts", "bootstrap.sh"), "utf-8");
  } catch {
    return "";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!BOOTSTRAP_TOKEN || token !== BOOTSTRAP_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  if (!SCRIPT_TEMPLATE) {
    return new Response("Bootstrap script not found", { status: 500 });
  }

  const host =
    _request.headers.get("x-forwarded-host") ||
    _request.headers.get("host") ||
    "localhost:20128";
  const proto =
    _request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
  const baseUrl = `${proto}://${host}`;

  const script = SCRIPT_TEMPLATE
    .replace("# %%OMNIROUTE_URL%%", `OMNIROUTE_URL="${baseUrl}"`)
    .replace("%%VERSION%%", APP_CONFIG.version || "dev");

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
