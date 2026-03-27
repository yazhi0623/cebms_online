import { useContext } from "react";

import { AuthContext } from "../../app/providers/auth-provider";

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    // 这里直接报错能尽早暴露 Provider 树挂错的问题。
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
