import { NextResponse } from "next/server";
import { getProviderConnections, getSettings } from "@/lib/localDb";
import { APP_CONFIG } from "@/shared/constants/config";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { isAuthenticated } from "@/shared/utils/apiAuth";

/**
 * GET /api/monitoring/health — System health overview
 *
 * Unauthenticated: returns minimal status for container probes.
 * Authenticated: returns full system info, provider health, rate limits.
 */
export async function GET(request: Request) {
  try {
    const authed = await isAuthenticated(request);

    if (!authed) {
      return NextResponse.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: APP_CONFIG.version,
      });
    }

    const { getAllCircuitBreakerStatuses } = await import("@/shared/utils/circuitBreaker");
    const { getAllRateLimitStatus } = await import("@omniroute/open-sse/services/rateLimitManager");
    const { getAllModelLockouts } = await import("@omniroute/open-sse/services/accountFallback");
    const { getInflightCount } = await import("@omniroute/open-sse/services/requestDedup.ts");

    const settings = await getSettings();
    const connections = await getProviderConnections();
    const circuitBreakers = getAllCircuitBreakerStatuses();
    const rateLimitStatus = getAllRateLimitStatus();
    const lockouts = getAllModelLockouts();
    const { getAllHealthStatuses } = await import("@/lib/localHealthCheck");

    const system = {
      version: APP_CONFIG.version,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      pid: process.pid,
      platform: process.platform,
    };

    const providerHealth = {};
    for (const cb of circuitBreakers) {
      if (cb.name.startsWith("test-") || cb.name.startsWith("test_")) continue;
      providerHealth[cb.name] = {
        state: cb.state,
        failures: cb.failureCount || 0,
        lastFailure: cb.lastFailureTime,
      };
    }

    const configuredProviders = new Set(connections.map((c: any) => c.provider));
    const activeProviders = new Set(
      connections.filter((c: any) => c.isActive !== false).map((c: any) => c.provider)
    );

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      system,
      providerHealth,
      providerSummary: {
        catalogCount: Object.keys(AI_PROVIDERS).length,
        configuredCount: configuredProviders.size,
        activeCount: activeProviders.size,
        monitoredCount: Object.keys(providerHealth).length,
      },
      localProviders: getAllHealthStatuses(),
      rateLimitStatus,
      lockouts,
      dedup: {
        inflightRequests: getInflightCount(),
      },
      setupComplete: settings?.setupComplete || false,
    });
  } catch (error) {
    console.error("[API] GET /api/monitoring/health error:", error);
    return NextResponse.json({ status: "error", error: "Health check failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/monitoring/health — Reset all circuit breakers
 *
 * Resets all provider circuit breakers to CLOSED state,
 * clearing failure counts and persisted state.
 */
export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const { resetAllCircuitBreakers, getAllCircuitBreakerStatuses } =
      await import("@/shared/utils/circuitBreaker");

    const before = getAllCircuitBreakerStatuses();
    const resetCount = before.length;

    resetAllCircuitBreakers();

    console.log(`[API] DELETE /api/monitoring/health — Reset ${resetCount} circuit breakers`);

    return NextResponse.json({
      success: true,
      message: `Reset ${resetCount} circuit breaker(s) to healthy state`,
      resetCount,
    });
  } catch (error) {
    console.error("[API] DELETE /api/monitoring/health error:", error);
    return NextResponse.json({ error: "Failed to reset circuit breakers" }, { status: 500 });
  }
}
