import type { PropsWithChildren } from "react";

import { AuthProvider } from "./auth-provider";
import { ConfirmProvider } from "./confirm-provider";
import { NavigationProvider } from "./navigation-provider";

export function AppProvider({ children }: PropsWithChildren) {
  // 认证状态是最外层依赖；确认弹窗是全局能力，任意页面都可能调用。
  return (
    <AuthProvider>
      <NavigationProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </NavigationProvider>
    </AuthProvider>
  );
}
