import { useEffect, useState } from "react";

import { routes } from "../../shared/constants/routes";
import { uiTiming } from "../../shared/constants/ui";
import { useAuth } from "../../shared/hooks/use-auth";

type LoginPageProps = {
  modal?: boolean;
  onClose?: () => void;
};

function normalizeAuthErrorMessage(message: string): string {
  const trimmed = message.trim();

  try {
    const parsed = JSON.parse(trimmed) as Array<{ loc?: unknown[]; msg?: string; type?: string }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1] ?? "") : "";
      const msg = first.msg ?? "";
      const type = first.type ?? "";

      if (field === "password" && (type === "string_too_short" || msg.includes("at least 8 characters"))) {
        return "密码至少需要 8 个字符";
      }

      if (field === "password" && (type === "string_too_long" || msg.includes("at most 128 characters"))) {
        return "密码不能超过 128 个字符";
      }

      if (field === "username" && (type === "string_too_short" || msg.includes("at least 3 characters"))) {
        return "用户名至少需要 3 个字符";
      }

      if (field === "username" && (type === "string_too_long" || msg.includes("at most 50 characters"))) {
        return "用户名不能超过 50 个字符";
      }

      if (field === "username" && (type === "string_pattern_mismatch" || msg.includes("pattern"))) {
        return "用户名只能包含字母、数字和下划线";
      }

      return "请求参数不正确";
    }
  } catch {
    // 非 JSON 校验错误时继续走普通字符串映射。
  }

  const reasonMap: Record<string, string> = {
    "Username already exists": "用户名已存在",
    "Incorrect username or password": "用户名或密码错误",
    "Registration is currently disabled": "注册功能优化中，请优先使用测试账号",
    "Too many login attempts, please try again later": "尝试次数过多，请稍后再试",
    "Not authenticated": "当前未登录",
    "Invalid token": "登录状态无效，请重新登录",
    "Invalid token payload": "登录状态无效，请重新登录",
    "User not found": "用户不存在",
    "Token has been revoked": "登录状态已失效，请重新登录",
    "Refresh token has been revoked": "登录状态已失效，请重新登录",
    "Request failed with status 400": "请求参数不正确",
    "Request failed with status 401": "用户名或密码错误",
    "Request failed with status 403": "当前无权执行该操作",
    "Request failed with status 429": "尝试次数过多，请稍后再试",
  };

  return reasonMap[trimmed] ?? (trimmed || "请求失败");
}

export function LoginPage({ modal = false, onClose }: LoginPageProps) {
  const { authRegistrationEnabled, login, loading, currentUser, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"status" | "alert">("status");

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), uiTiming.toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  function pushStatusToast(message: string) {
    setToastTone("status");
    setToastMessage(message);
  }

  function pushErrorToast(message: string) {
    setToastTone("alert");
    setToastMessage(message);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToastMessage(null);

    try {
      // 提交前先做最小校验，避免无意义请求直接打到后端。
      if (!username.trim() || !password) {
        pushErrorToast("请输入用户名和密码");
        return;
      }

      if (mode === "register") {
        if (!authRegistrationEnabled) {
          pushStatusToast("注册功能优化中，请优先使用测试账号");
          return;
        }

        if (password !== confirmPassword) {
          pushErrorToast("两次输入的密码不一致");
          return;
        }

        await register(username.trim(), password);
      } else {
        await login(username.trim(), password);
      }

      // 认证成功后手动推送路由，通知轻量路由器刷新当前页面。
      window.history.pushState({}, "", routes.records);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (submitError) {
      pushErrorToast(normalizeAuthErrorMessage(submitError instanceof Error ? submitError.message : "请求失败"));
    }
  }

  const card = (
    <div className={modal ? "auth-card auth-card--modal" : "auth-card"}>
      {toastMessage ? (
        <div
          aria-live={toastTone === "alert" ? "assertive" : "polite"}
          className="record-import-toast"
          role={toastTone === "alert" ? "alert" : "status"}
        >
          <span>{toastMessage}</span>
        </div>
      ) : null}
      {modal ? (
        <div className="auth-card__header">
          <button aria-label="关闭登录弹窗" className="auth-card__close" onClick={onClose} type="button">
            ×
          </button>
        </div>
      ) : null}
      <div className="auth-tabs">
        <button
          className={mode === "login" ? "auth-tab auth-tab--active" : "auth-tab"}
          onClick={() => {
            setMode("login");
            setToastMessage(null);
          }}
          type="button"
        >
          登录
        </button>
        <button
          className={
            authRegistrationEnabled
              ? mode === "register"
                ? "auth-tab auth-tab--active"
                : "auth-tab"
              : mode === "register"
                ? "auth-tab auth-tab--disabled auth-tab--active"
                : "auth-tab auth-tab--disabled"
          }
          onClick={() => {
            setToastMessage(null);
            if (!authRegistrationEnabled) {
              setMode("login");
              pushStatusToast("注册功能优化中，请优先使用测试账号");
              return;
            }

            setMode("register");
          }}
          type="button"
        >
          注册
        </button>
      </div>
      <p className="auth-card__trial">试用: test001/HelloWorld!</p>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-form__field">
          <span>用户名</span>
          <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="auth-form__field">
          <span>密码</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === "register" ? (
          <label className="auth-form__field">
            <span>确认密码</span>
            <input
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        ) : null}
        <button className="auth-form__submit auth-form__submit--legacy" disabled={loading} type="submit">
          {loading ? "提交中" : mode === "login" ? "登录" : "注册"}
        </button>
        {currentUser ? <p className="auth-form__hint">{`当前用户：${currentUser.username}`}</p> : null}
      </form>
    </div>
  );

  if (modal) {
    return card;
  }

  return <section className="auth-view">{card}</section>;
}
