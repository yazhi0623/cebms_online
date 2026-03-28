import { createContext, useCallback, useMemo, useRef, type PropsWithChildren } from "react";

type NavigationBlocker = (path: string) => boolean | Promise<boolean>;

type NavigationContextValue = {
  navigate: (path: string) => Promise<boolean>;
  setBlocker: (blocker: NavigationBlocker | null) => void;
};

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: PropsWithChildren) {
  const blockerRef = useRef<NavigationBlocker | null>(null);

  const setBlocker = useCallback((blocker: NavigationBlocker | null) => {
    blockerRef.current = blocker;
  }, []);

  const navigate = useCallback(async (path: string) => {
    if (window.location.pathname === path) {
      return true;
    }

    const blocker = blockerRef.current;
    if (blocker) {
      const allowed = await blocker(path);
      if (!allowed) {
        return false;
      }
    }

    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return true;
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      navigate,
      setBlocker,
    }),
    [navigate, setBlocker],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
