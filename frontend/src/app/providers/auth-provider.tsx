import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import type { CurrentUser } from "../../entities/user/types";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
} from "../../features/auth/api";
import { type ApiSession, checkHealth } from "../../shared/api/client";
import { applyUiTimingConfig } from "../../shared/constants/ui";
import { loadStoredSession, saveStoredSession } from "../../shared/constants/storage";

type AuthContextValue = {
  backendReady: boolean;
  authRegistrationEnabled: boolean;
  currentUser: CurrentUser | null;
  session: ApiSession | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [backendReady, setBackendReady] = useState(false);
  const [authRegistrationEnabled, setAuthRegistrationEnabled] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      // 应用启动时统一恢复登录态，避免每个页面各自做一遍会话初始化。
      setLoading(true);

      try {
        const healthStatus = await checkHealth();
        if (!active) {
          return;
        }

        // 当前后端会返回一部分 UI 时序配置，例如 toast 时长。
        applyUiTimingConfig({ toastDurationMs: healthStatus.toast_duration_ms });
        setBackendReady(true);
        setAuthRegistrationEnabled(Boolean(healthStatus.auth_registration_enabled));

        const storedSession = loadStoredSession();

        if (!storedSession?.accessToken) {
          // 没有本地令牌时，直接进入游客态。
          setSession(null);
          setCurrentUser(null);
          return;
        }

        let nextSession = storedSession;
        let user: CurrentUser;

        try {
          user = await fetchCurrentUser(storedSession.accessToken);
        } catch {
          // access token 失效时，尝试用 refresh token 静默恢复会话。
          if (!storedSession.refreshToken) {
            throw new Error("Session refresh unavailable");
          }

          nextSession = await refreshSession(storedSession.refreshToken);
          saveStoredSession(nextSession);
          user = await fetchCurrentUser(nextSession.accessToken);
        }

        if (!active) {
          return;
        }

        setSession(nextSession);
        setCurrentUser(user);
      } catch {
        if (!active) {
          return;
        }

        setBackendReady(false);
        setAuthRegistrationEnabled(false);
        setSession(null);
        setCurrentUser(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      backendReady,
      authRegistrationEnabled,
      currentUser,
      session,
      loading,
      async register(username: string, password: string) {
        await registerRequest({ username, password });
        // 注册成功后立刻登录，前端可以直接进入工作台而不需要再次输入密码。
        const nextSession = await loginRequest({ username, password });
        saveStoredSession(nextSession);
        setSession(nextSession);
        const user = await fetchCurrentUser(nextSession.accessToken);
        setCurrentUser(user);
        setBackendReady(true);
      },
      async login(username: string, password: string) {
        const nextSession = await loginRequest({ username, password });
        saveStoredSession(nextSession);
        setSession(nextSession);
        const user = await fetchCurrentUser(nextSession.accessToken);
        setCurrentUser(user);
        setBackendReady(true);
      },
      async logout() {
        if (session?.accessToken) {
          try {
            await logoutRequest(session.accessToken);
          } catch {
            // 退出本质上是本地清理令牌。即便后端返回失败，也不应该阻止前端退出。
          }
        }
        saveStoredSession(null);
        setSession(null);
        setCurrentUser(null);
      },
    }),
    [authRegistrationEnabled, backendReady, currentUser, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
