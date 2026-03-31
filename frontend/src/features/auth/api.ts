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

type UserProfilePayload = {
  username: string;
  gender: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
};

type UserProfileResponse = {
  user: CurrentUser;
  access_token: string;
  refresh_token: string;
  token_type: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export async function login(payload: LoginPayload): Promise<ApiSession> {
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
  return apiRequest<CurrentUser>("/auth/me", {
    accessToken,
  });
}

export async function updateCurrentUserProfile(
  accessToken: string,
  payload: UserProfilePayload,
): Promise<{ user: CurrentUser; session: ApiSession }> {
  const response = await apiRequest<UserProfileResponse>("/auth/me", {
    method: "PUT",
    accessToken,
    body: JSON.stringify(payload),
  });
  return {
    user: response.user,
    session: {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    },
  };
}
