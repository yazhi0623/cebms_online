export type ApiSession = {
  accessToken: string;
  refreshToken: string;
};

export type HealthStatus = {
  status: string;
  database?: string;
  toast_duration_ms?: number;
  auth_registration_enabled?: boolean;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
  accessToken?: string | null;
};

const backendHost = window.location.hostname || "127.0.0.1";
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredHealthUrl = import.meta.env.VITE_HEALTH_URL?.trim();

export const apiBaseUrl = configuredApiBaseUrl || `http://${backendHost}:8000/api/v1`;
export const healthUrl = configuredHealthUrl || `http://${backendHost}:8000/health`;

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  // 这里统一处理 JSON 请求的公共部分，业务模块只关心路径、方法和 payload。
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(detail);
  }

  if (response.status === 204) {
    // DELETE 这类接口没有响应体，但调用方仍然需要一个已完成的 Promise。
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(healthUrl);

  if (!response.ok) {
    throw new Error("Backend health check failed");
  }

  return (await response.json()) as HealthStatus;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string | Record<string, unknown> };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
    if (payload.detail && typeof payload.detail === "object") {
      return JSON.stringify(payload.detail);
    }
    return `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}
