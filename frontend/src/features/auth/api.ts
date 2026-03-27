import { apiRequest, type ApiSession } from "../../shared/api/client";
import type { CurrentUser } from "../../entities/user/types";

type LoginPayload = {
  username: string;
  password: string;
};

type RegisterPayload = {
  username: string;
  password: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export async function login(payload: LoginPayload): Promise<ApiSession> {
  // 后端返回 snake_case，前端在 feature 层统一转成 camelCase。
  const response = await apiRequest<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  };
}

export async function register(payload: RegisterPayload): Promise<void> {
  await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function refreshSession(refreshToken: string): Promise<ApiSession> {
  // 刷新令牌是一个很小的 JSON 请求，不需要走 multipart 或特殊下载逻辑。
  const response = await apiRequest<TokenResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  };
}

export async function logout(accessToken: string): Promise<void> {
  await apiRequest("/auth/logout", {
    method: "POST",
    accessToken,
  });
}

export async function fetchCurrentUser(accessToken: string): Promise<CurrentUser> {
  // 应用启动时 AuthProvider 会通过这个接口恢复当前用户信息。
  return apiRequest<CurrentUser>("/auth/me", {
    accessToken,
  });
}
