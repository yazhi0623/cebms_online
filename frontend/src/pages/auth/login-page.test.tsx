import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContextType } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "../../app/providers/auth-provider";
import { LoginPage } from "./login-page";

function renderLoginPage(overrides: Partial<ContextType<typeof AuthContext>> = {}) {
  const value = {
    backendReady: true,
    authRegistrationEnabled: false,
    currentUser: null,
    session: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={value}>
      <LoginPage />
    </AuthContext.Provider>,
  );
}

describe("LoginPage", () => {
  it("shows toast instead of switching to register flow", async () => {
    const user = userEvent.setup();
    const register = vi.fn();

    renderLoginPage({ register });

    await user.click(screen.getByRole("button", { name: "注册" }));

    expect(await screen.findByText("注册功能优化中，请优先使用测试账号")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
    expect(screen.queryByText("确认密码")).not.toBeInTheDocument();
  });

  it("switches to register mode when registration is enabled", async () => {
    const user = userEvent.setup();

    renderLoginPage({ authRegistrationEnabled: true });

    await user.click(screen.getByRole("button", { name: "注册" }));

    expect(screen.getByText("确认密码")).toBeInTheDocument();
  });

  it("shows localized login error in toast", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockRejectedValue(new Error("Incorrect username or password"));

    renderLoginPage({ login });

    await user.type(screen.getByLabelText("用户名"), "test001");
    await user.type(screen.getByLabelText("密码"), "wrong-password");
    await user.click(screen.getAllByRole("button", { name: "登录" })[1]);

    expect(await screen.findByText("用户名或密码错误")).toBeInTheDocument();
    expect(screen.queryByText("Incorrect username or password")).not.toBeInTheDocument();
  });

  it("shows localized validation error in toast", async () => {
    const user = userEvent.setup();
    const register = vi
      .fn()
      .mockRejectedValue(
        new Error('[{"type":"string_too_short","loc":["body","password"],"msg":"String should have at least 8 characters","input":"lili","ctx":{"min_length":8}}]'),
      );

    renderLoginPage({ authRegistrationEnabled: true, register });

    await user.click(screen.getByRole("button", { name: "注册" }));
    expect(await screen.findByText("确认密码")).toBeInTheDocument();
    await user.type(screen.getByLabelText("用户名"), "test001");
    await user.type(screen.getByLabelText("密码"), "lili");
    await user.type(screen.getByLabelText("确认密码"), "lili");
    await user.click(screen.getAllByRole("button", { name: "注册" })[1]);

    expect(await screen.findByText("密码至少需要 8 个字符")).toBeInTheDocument();
  });
});
