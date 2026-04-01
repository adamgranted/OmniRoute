import { createHash } from "node:crypto";

const BOOTSTRAP_ROUTE_PREFIX = "/api/bootstrap/";
const DEFAULT_BOOTSTRAP_HOST = "localhost:20128";

export function getBootstrapSecret(): string | null {
  const secret = process.env.API_KEY_SECRET || process.env.JWT_SECRET || "";
  const trimmed = secret.trim();
  return trimmed ? trimmed : null;
}

export function deriveBootstrapToken(secret: string | null = getBootstrapSecret()): string | null {
  if (!secret) return null;
  return createHash("sha256").update(`omniroute-bootstrap:${secret}`).digest("hex").slice(0, 16);
}

export function isPublicBootstrapScriptPath(pathname: string): boolean {
  if (!pathname.startsWith(BOOTSTRAP_ROUTE_PREFIX)) return false;

  const suffix = pathname.slice(BOOTSTRAP_ROUTE_PREFIX.length);
  return suffix.length > 0 && suffix !== "url" && !suffix.includes("/");
}

export function getBootstrapBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host") || DEFAULT_BOOTSTRAP_HOST;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim()
    .toLowerCase();
  const proto = forwardedProto === "https" ? "https" : "http";

  return `${proto}://${host}`;
}

export function quoteShellValue(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function injectBootstrapTemplate(
  template: string,
  baseUrl: string,
  version: string
): string {
  return template
    .replace("# %%OMNIROUTE_URL%%", () => `OMNIROUTE_URL=${quoteShellValue(baseUrl)}`)
    .replace("%%VERSION%%", () => version);
}
