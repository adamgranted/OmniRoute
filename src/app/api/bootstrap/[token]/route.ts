import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_CONFIG } from "@/shared/constants/config";
import {
  getBootstrapBaseUrl,
  injectBootstrapTemplate,
  isBootstrapTokenMatch,
} from "@/shared/utils/bootstrap";

const SCRIPT_TEMPLATE = loadScript();

function loadScript(): string {
  try {
    return readFileSync(join(process.cwd(), "scripts", "bootstrap.sh"), "utf-8");
  } catch {
    return "";
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isBootstrapTokenMatch(token)) {
    return new Response("Not found", { status: 404 });
  }

  if (!SCRIPT_TEMPLATE) {
    return new Response("Bootstrap script not found", { status: 500 });
  }

  const baseUrl = getBootstrapBaseUrl(request);
  const script = injectBootstrapTemplate(SCRIPT_TEMPLATE, baseUrl, APP_CONFIG.version || "dev");

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
