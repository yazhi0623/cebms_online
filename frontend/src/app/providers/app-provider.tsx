import type { PropsWithChildren } from "react";

import { AuthProvider } from "./auth-provider";
import { ConfirmProvider } from "./confirm-provider";

export function AppProvider({ children }: PropsWithChildren) {
  // 认证状态是最外层依赖；确认弹窗是全局能力，任意页面都可能调用。
  return (
    <AuthProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </AuthProvider>
  );
}
