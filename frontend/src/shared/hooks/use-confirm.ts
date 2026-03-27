import { useContext } from "react";

import { ConfirmContext } from "../../app/providers/confirm-provider";

export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    // 确认框能力由 ConfirmProvider 统一提供，脱离它调用没有意义。
    throw new Error("useConfirm must be used within ConfirmProvider");
  }

  return context;
}
