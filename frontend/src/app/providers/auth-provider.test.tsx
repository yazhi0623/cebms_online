import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, AuthProvider } from "./auth-provider";
import * as authApi from "../../features/auth/api";
import * as apiClient from "../../shared/api/client";
import { saveStoredSession } from "../../shared/constants/storage";

function AuthProbe() {
  const value = useContext(AuthContext);

  if (!value) {
    return null;
  }

  return (
    <div>
      <span data-testid="backend-ready">{String(value.backendReady)}</span>
      <span data-testid="registration-enabled">{String(value.authRegistrationEnabled)}</span>
      <span data-testid="loading">{String(value.loading)}</span>
      <span data-testid="current-user">{value.currentUser?.username ?? "guest"}</span>
    </div>
  );
}

function renderWithProvider(children: React.ReactNode) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

describe("AuthProvider", () => {
  it("restores session from local storage on bootstrap", async () => {
    saveStoredSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    vi.spyOn(apiClient, "checkHealth").mockResolvedValue({ status: "ok", auth_registration_enabled: true });
    vi.spyOn(authApi, "fetchCurrentUser").mockResolvedValue({ id: 1, username: "tester" });

    renderWithProvider(<AuthProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("backend-ready")).toHaveTextContent("true");
    expect(screen.getByTestId("registration-enabled")).toHaveTextContent("true");
    expect(screen.getByTestId("current-user")).toHaveTextContent("tester");
  });

  it("falls back to guest state when backend health check fails", async () => {
    vi.spyOn(apiClient, "checkHealth").mockRejectedValue(new Error("offline"));

    renderWithProvider(<AuthProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("backend-ready")).toHaveTextContent("false");
    expect(screen.getByTestId("registration-enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("current-user")).toHaveTextContent("guest");
  });
});
