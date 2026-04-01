import { createContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import type { CurrentUser } from "../../entities/user/types";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  updateCurrentUserProfile,
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
  updateProfile?: (profile: {
    username: string;
    gender: string;
    age: string;
    city: string;
    phone: string;
    email: string;
  }) => Promise<void>;
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
      setLoading(true);

      try {
        const healthStatus = await checkHealth();
        if (!active) {
          return;
        }

        applyUiTimingConfig({ toastDurationMs: healthStatus.toast_duration_ms });
        setBackendReady(true);
        setAuthRegistrationEnabled(Boolean(healthStatus.auth_registration_enabled));

        const storedSession = loadStoredSession();

        if (!storedSession?.accessToken) {
          setSession(null);
          setCurrentUser(null);
          return;
        }

        let nextSession = storedSession;
        let user: CurrentUser;

        try {
          user = await fetchCurrentUser(storedSession.accessToken);
        } catch {
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
            // ignore logout API failure and still clear local session
          }
        }
        saveStoredSession(null);
        setSession(null);
        setCurrentUser(null);
      },
      async updateProfile(profile) {
        if (!session?.accessToken) {
          throw new Error("Session unavailable");
        }
        const result = await updateCurrentUserProfile(session.accessToken, {
          username: profile.username.trim(),
          gender: profile.gender.trim() || null,
          age: profile.age.trim() ? Number(profile.age.trim()) : null,
          city: profile.city.trim() || null,
          phone: profile.phone.trim() || null,
          email: profile.email.trim() || null,
        });
        saveStoredSession(result.session);
        setSession(result.session);
        setCurrentUser(result.user);
      },
    }),
    [authRegistrationEnabled, backendReady, currentUser, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
