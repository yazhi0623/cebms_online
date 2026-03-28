import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { LoginPage } from "../../pages/auth/login-page";
import { routes } from "../../shared/constants/routes";
import { useAuth } from "../../shared/hooks/use-auth";
import { useNavigation } from "../../shared/hooks/use-navigation";
import { resolveRoute, routeDefinitions } from "./routes";

function middleEllipsis(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  const visibleChars = Math.max(2, maxChars - 1);
  const headChars = Math.ceil(visibleChars / 2);
  const tailChars = Math.floor(visibleChars / 2);
  return `${value.slice(0, headChars)}…${value.slice(value.length - tailChars)}`;
}

function fitMiddleEllipsisToWidth(value: string, maxWidth: number, font: string) {
  if (!value || maxWidth <= 0) {
    return value;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return value;
  }

  context.font = font;
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let bestFit = middleEllipsis(value, 2);
  let low = 2;
  let high = value.length;

  while (low <= high) {
    const candidateChars = Math.floor((low + high) / 2);
    const candidate = middleEllipsis(value, candidateChars);
    if (context.measureText(candidate).width <= maxWidth) {
      bestFit = candidate;
      low = candidateChars + 1;
    } else {
      high = candidateChars - 1;
    }
  }

  return bestFit;
}

export function AppRouter() {
  const { currentUser, loading, logout } = useAuth();
  const { navigate } = useNavigation();
  const [pathname, setPathname] = useState(window.location.pathname);
  const [lastContentPath, setLastContentPath] = useState(
    window.location.pathname === routes.login ? routes.records : window.location.pathname,
  );
  const brandMetaRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);
  const compactUserRef = useRef<HTMLSpanElement | null>(null);
  const sessionRef = useRef<HTMLDivElement | null>(null);

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
  const navRoutes = routeDefinitions.filter((route) => route.navVisible && route.path !== routes.login);
  const sessionLabel = loading ? "检查会话中" : currentUser ? currentUser.username : "访客";
  const sessionTextLabel = loading ? "检查会话中" : currentUser ? `当前用户：${currentUser.username}` : "访客";
  const [compactSessionLabel, setCompactSessionLabel] = useState(sessionLabel);
  const [compactUserWidth, setCompactUserWidth] = useState<number | null>(null);
  const contentClassName =
    currentRoute.path === routes.records
      ? "shell__content shell__content--records"
      : currentRoute.path === routes.dataCenter
        ? "shell__content shell__content--data-center"
        : "shell__content";

  useLayoutEffect(() => {
    if (!brandMetaRef.current || !subtitleRef.current || !compactUserRef.current || !sessionRef.current) {
      setCompactSessionLabel(sessionLabel);
      setCompactUserWidth(null);
      return;
    }

    if (!currentUser) {
      setCompactSessionLabel(sessionLabel);
      setCompactUserWidth(null);
      return;
    }

    const brandMetaElement = brandMetaRef.current;
    const subtitleElement = subtitleRef.current;
    const compactUserElement = compactUserRef.current;
    const sessionElement = sessionRef.current;

    const updateLabel = () => {
      const brandMetaStyle = window.getComputedStyle(brandMetaElement);
      const compactUserStyle = window.getComputedStyle(compactUserElement);
      const gap = Number.parseFloat(brandMetaStyle.columnGap || brandMetaStyle.gap || "0");
      const availableWidth = Math.max(
        0,
        brandMetaElement.getBoundingClientRect().width - subtitleElement.getBoundingClientRect().width - gap,
      );
      const targetWidth = Math.min(sessionElement.getBoundingClientRect().width, availableWidth);

      if (targetWidth <= 0) {
        setCompactSessionLabel(currentUser.username);
        setCompactUserWidth(null);
        return;
      }

      const font = [
        compactUserStyle.fontStyle,
        compactUserStyle.fontVariant,
        compactUserStyle.fontWeight,
        compactUserStyle.fontSize,
        compactUserStyle.fontFamily,
      ].join(" ");

      setCompactUserWidth(targetWidth);
      setCompactSessionLabel(fitMiddleEllipsisToWidth(currentUser.username, targetWidth, font));
    };

    updateLabel();
    const observer = new ResizeObserver(() => {
      updateLabel();
    });
    observer.observe(brandMetaElement);
    observer.observe(subtitleElement);
    observer.observe(sessionElement);
    window.addEventListener("resize", updateLabel);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLabel);
    };
  }, [currentUser, sessionLabel]);

  return (
    <div className="shell">
      <header className="shell__header">
        <div>
          <div className="shell__brand-row">
            <h1 className="shell__title">你一生的故事</h1>
            <div className="shell__brand-meta" ref={brandMetaRef}>
              <p className="shell__subtitle" ref={subtitleRef}>
                记录走向未来的足迹
              </p>
              <span
                className="shell__compact-user"
                ref={compactUserRef}
                style={compactUserWidth ? { width: `${compactUserWidth}px` } : undefined}
                title={currentUser?.username ?? sessionLabel}
              >
                {loading ? sessionLabel : compactSessionLabel}
              </span>
            </div>
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
          <div className="shell__session" ref={sessionRef}>
            <span className="shell__session-text">{sessionTextLabel}</span>
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
