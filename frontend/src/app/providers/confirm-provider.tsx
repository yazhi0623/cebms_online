import { createContext, useCallback, useMemo, useState, type PropsWithChildren } from "react";

type ConfirmOptions = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const initialState: ConfirmState = {
  open: false,
  message: "",
  confirmLabel: "确认",
  cancelLabel: "取消",
};

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ConfirmState>(initialState);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const close = useCallback(
    (result: boolean) => {
      // 先把 Promise 结果回传给调用方，再重置弹窗状态。
      resolver?.(result);
      setResolver(null);
      setState(initialState);
    },
    [resolver],
  );

  const value = useMemo<ConfirmContextValue>(
    () => ({
      confirm(options: ConfirmOptions) {
        // 用 Promise 形式暴露确认框后，调用方可以直接 `await confirm(...)`，
        // 代码会比事件回调链更容易读。
        return new Promise<boolean>((resolve) => {
          setResolver(() => resolve);
          setState({
            open: true,
            message: options.message,
            confirmLabel: options.confirmLabel ?? "确认",
            cancelLabel: options.cancelLabel ?? "取消",
          });
        });
      },
    }),
    [],
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state.open ? (
        <div className="confirm-overlay" role="presentation">
          <div aria-modal="true" className="confirm-dialog" role="dialog">
            <p className="confirm-message">{state.message}</p>
            <div className="confirm-actions">
              <button className="shell__nav-button shell__nav-button--pressable" onClick={() => close(false)} type="button">
                {state.cancelLabel}
              </button>
              <button
                className="shell__nav-button shell__nav-button--active shell__nav-button--pressable"
                onClick={() => close(true)}
                type="button"
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
