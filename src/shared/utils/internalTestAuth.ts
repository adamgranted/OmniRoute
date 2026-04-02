import { randomUUID } from "node:crypto";

const HEADER_NAME = "x-omniroute-internal-token";
let token: string | null = null;

function getToken(): string {
  if (!token) {
    const g = globalThis as Record<string, unknown>;
    token = (g.__omnirouteInternalTestToken as string) || randomUUID();
    g.__omnirouteInternalTestToken = token;
  }
  return token;
}

export function buildInternalTestHeaders(): Record<string, string> {
  return {
    "X-Internal-Test": "combo-health-check",
    [HEADER_NAME]: getToken(),
  };
}

export function isInternalTestRequest(request: { headers?: { get?: (name: string) => string | null } }): boolean {
  if (!token && (globalThis as Record<string, unknown>).__omnirouteInternalTestToken) {
    token = (globalThis as Record<string, unknown>).__omnirouteInternalTestToken as string;
  }
  const testHeader = request.headers?.get?.("x-internal-test") === "combo-health-check";
  const tokenHeader = request.headers?.get?.(HEADER_NAME);
  return Boolean(testHeader && tokenHeader && token && tokenHeader === token);
}
