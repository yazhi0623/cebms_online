import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { ProfileModal } from "../../features/auth/profile-modal";
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
  return `${value.slice(0, headChars)}...${value.slice(value.length - tailChars)}`;
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
  const { currentUser, loading, logout, updateProfile } = useAuth();
  const { navigate } = useNavigation();
  const [pathname, setPathname] = useState(window.location.pathname);
  const [portraitLayout, setPortraitLayout] = useState(window.matchMedia("(orientation: portrait)").matches);
  const [lastContentPath, setLastContentPath] = useState(
    window.location.pathname === routes.login ? routes.records : window.location.pathname,
  );
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const brandMetaRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);
  const compactUserRef = useRef<HTMLButtonElement | null>(null);
  const authActionRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    const syncPortraitLayout = (event?: MediaQueryListEvent) => {
      setPortraitLayout(event?.matches ?? mediaQuery.matches);
    };

    syncPortraitLayout();
    mediaQuery.addEventListener("change", syncPortraitLayout);
    return () => {
      mediaQuery.removeEventListener("change", syncPortraitLayout);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfileModalOpen(false);
    }
  }, [currentUser]);

  const authModalOpen = !currentUser && pathname === routes.login;
  const currentRoute = resolveRoute(authModalOpen ? lastContentPath : pathname);
  const navRoutes = routeDefinitions.filter((route) => route.navVisible && route.path !== routes.login);
  const sessionLabel = loading ? "\u68c0\u67e5\u4f1a\u8bdd\u4e2d" : currentUser ? currentUser.username : "\u8bbf\u5ba2";
  const sessionTextLabel = loading
    ? "\u68c0\u67e5\u4f1a\u8bdd\u4e2d"
    : currentUser
      ? "\u5f53\u524d\u7528\u6237\uff1a"
      : "\u8bbf\u5ba2";
  const [compactSessionLabel, setCompactSessionLabel] = useState(sessionLabel);
  const [compactUserWidth, setCompactUserWidth] = useState<number | null>(null);
  const contentClassName =
    currentRoute.path === routes.records
      ? "shell__content shell__content--records"
      : currentRoute.path === routes.dataCenter
        ? "shell__content shell__content--data-center"
        : "shell__content";

  useLayoutEffect(() => {
    if (!brandMetaRef.current || !subtitleRef.current || !compactUserRef.current || !authActionRef.current) {
      setCompactSessionLabel(sessionLabel);
      setCompactUserWidth(null);
      return;
    }

    const brandMetaElement = brandMetaRef.current;
    const subtitleElement = subtitleRef.current;
    const compactUserElement = compactUserRef.current;
    const authActionElement = authActionRef.current;
    const sourceLabel = currentUser?.username ?? sessionLabel;

    const updateLabel = () => {
      const brandMetaStyle = window.getComputedStyle(brandMetaElement);
      const compactUserStyle = window.getComputedStyle(compactUserElement);
      const gap = Number.parseFloat(brandMetaStyle.columnGap || brandMetaStyle.gap || "0");
      const availableWidth = Math.max(
        0,
        brandMetaElement.getBoundingClientRect().width - subtitleElement.getBoundingClientRect().width - gap,
      );
      const targetWidth = portraitLayout
        ? authActionElement.getBoundingClientRect().width
        : Math.min(authActionElement.getBoundingClientRect().width, availableWidth);

      if (targetWidth <= 0) {
        setCompactSessionLabel(sourceLabel);
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
      setCompactSessionLabel(fitMiddleEllipsisToWidth(sourceLabel, targetWidth, font));
    };

    updateLabel();
    const observer = new ResizeObserver(() => {
      updateLabel();
    });
    observer.observe(brandMetaElement);
    observer.observe(subtitleElement);
    observer.observe(authActionElement);
    window.addEventListener("resize", updateLabel);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLabel);
    };
  }, [currentUser, portraitLayout, sessionLabel]);

  async function handleProfileSave(profile: {
    username: string;
    gender: string;
    age: string;
    city: string;
    phone: string;
    email: string;
  }) {
    if (!updateProfile) {
      setProfileError("\u4fdd\u5b58\u5931\u8d25");
      return;
    }
    setProfileSaving(true);
    setProfileError("");
    try {
      await updateProfile(profile);
      setProfileModalOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "\u4fdd\u5b58\u5931\u8d25");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div
      className={portraitLayout ? "shell shell--portrait" : "shell"}
      style={
        compactUserWidth
          ? ({
              "--compact-user-width": `${compactUserWidth}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <header className={portraitLayout ? "shell__header shell__header--portrait" : "shell__header"}>
        <div>
          <div className="shell__brand-row">
            <h1 className="shell__title">{"\u4f60\u4e00\u751f\u7684\u6545\u4e8b"}</h1>
            <div className="shell__brand-meta" ref={brandMetaRef}>
              <p className="shell__subtitle" ref={subtitleRef}>
                {"\u8bb0\u5f55\u8d70\u5411\u672a\u6765\u7684\u8db3\u8ff9"}
              </p>
              {currentUser ? (
                <button
                  className="shell__compact-user shell__user-link"
                  onClick={() => {
                    setProfileError("");
                    setProfileModalOpen(true);
                  }}
                  ref={compactUserRef}
                  style={compactUserWidth ? { width: `${compactUserWidth}px` } : undefined}
                  title={currentUser.username}
                  type="button"
                >
                  {compactSessionLabel}
                </button>
              ) : (
                <span
                  className="shell__compact-user"
                  ref={compactUserRef}
                  style={compactUserWidth ? { width: `${compactUserWidth}px` } : undefined}
                  title={sessionLabel}
                >
                  {loading ? sessionLabel : compactSessionLabel}
                </span>
              )}
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
          <div className="shell__session">
            {currentUser ? (
              <>
                <span className="shell__session-text">
                  {sessionTextLabel}
                  <button
                    className="shell__user-link"
                    onClick={() => {
                      setProfileError("");
                      setProfileModalOpen(true);
                    }}
                    type="button"
                  >
                    {currentUser.username}
                  </button>
                </span>
                <button
                  className="shell__nav-button"
                  onClick={() => {
                    void logout();
                    void navigate(routes.login);
                  }}
                  ref={authActionRef}
                  type="button"
                >
                  {"\u9000\u51fa"}
                </button>
              </>
            ) : (
              <>
                <span className="shell__session-text">{sessionTextLabel}</span>
                <button
                  className="shell__nav-button"
                  onClick={() => {
                    void navigate(routes.login);
                  }}
                  ref={authActionRef}
                  type="button"
                >
                  {"\u767b\u5f55/\u6ce8\u518c"}
                </button>
              </>
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
        {currentUser && profileModalOpen ? (
          <ProfileModal
            currentUser={currentUser}
            error={profileError}
            onClose={() => {
              setProfileError("");
              setProfileModalOpen(false);
            }}
            onSave={handleProfileSave}
            saving={profileSaving}
          />
        ) : null}
      </main>
    </div>
  );
}
