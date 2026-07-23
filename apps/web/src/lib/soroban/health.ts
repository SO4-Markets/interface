export type HealthStatus = "healthy" | "degraded" | "unreachable";

export async function checkRpcHealth(url: string, timeoutMs: number = 5000): Promise<{ status: HealthStatus; label: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        return { status: "degraded", label: "Degraded" };
      }
      return { status: "unreachable", label: "Unreachable" };
    }

    const data = await res.json();
    if (data.result?.status === "healthy") {
      return { status: "healthy", label: "Healthy" };
    }

    return { status: "degraded", label: "Degraded" };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { status: "unreachable", label: "Timeout" };
    }
    return { status: "unreachable", label: "Unreachable" };
  }
}
