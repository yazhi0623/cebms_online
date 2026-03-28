import { useEffect, useState } from "react";

import { LoginPage } from "../../pages/auth/login-page";
import { routes } from "../../shared/constants/routes";
import { useAuth } from "../../shared/hooks/use-auth";
import { useNavigation } from "../../shared/hooks/use-navigation";
import { resolveRoute, routeDefinitions } from "./routes";

export function AppRouter() {
  const { currentUser, loading, logout } = useAuth();
  const { navigate } = useNavigation();
  const [pathname, setPathname] = useState(window.location.pathname);
  const [lastContentPath, setLastContentPath] = useState(
    window.location.pathname === routes.login ? routes.records : window.location.pathname,
  );

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (pathname !== routes.login) {
      setLastContentPath(pathname);
    }
  }, [pathname]);

  const authModalOpen = !currentUser && pathname === routes.login;
  const currentRoute = resolveRoute(authModalOpen ? lastContentPath : pathname);
  // 登录页以弹层方式覆盖在内容页之上，尽量贴近旧前端交互。
  const navRoutes = routeDefinitions.filter((route) => route.navVisible && route.path !== routes.login);
  const showSessionInfo = true;
  const contentClassName =
    currentRoute.path === routes.records
      ? "shell__content shell__content--records"
      : currentRoute.path === routes.dataCenter
        ? "shell__content shell__content--data-center"
        : "shell__content";

  return (
    <div className="shell">
      <header className="shell__header">
        <div>
          <div className="shell__brand-row">
            <h1 className="shell__title">你一生的故事</h1>
            <p className="shell__subtitle">记录走向未来的足迹</p>
          </div>
        </div>
        <div className="shell__header-actions">
          <nav className="shell__nav" aria-label="Primary">
            {navRoutes.map((route) => {
              const active = currentRoute.path === route.path;

              return (
                <button
                  key={route.path}
                  className={active ? "shell__nav-button shell__nav-button--active" : "shell__nav-button"}
                  onClick={() => {
                    void navigate(route.path);
                  }}
                  type="button"
                >
                  {route.label}
                </button>
              );
            })}
          </nav>
          <div className="shell__session">
            {showSessionInfo ? (
              <span className="shell__session-text">
                {loading ? "检查会话中" : currentUser ? `当前用户：${currentUser.username}` : "访客"}
              </span>
            ) : null}
            {currentUser ? (
              <button
                className="shell__nav-button"
                onClick={() => {
                  void logout();
                  void navigate(routes.login);
                }}
                type="button"
              >
                退出
              </button>
            ) : (
              <button
                className="shell__nav-button"
                onClick={() => {
                  void navigate(routes.login);
                }}
                type="button"
              >
                登录/注册
              </button>
            )}
          </div>
        </div>
      </header>
      <main className={contentClassName}>
        {currentRoute.element}
        {authModalOpen ? (
          <div className="auth-modal-overlay" role="presentation">
            <LoginPage
              modal
              onClose={() => {
                void navigate(lastContentPath);
              }}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
