export const uiTiming = {
  toastDurationMs: 2400,
};

export function applyUiTimingConfig(config: { toastDurationMs?: number | null }) {
  // 只接受正数，避免把提示显示时间改成无效值。
  if (typeof config.toastDurationMs === "number" && Number.isFinite(config.toastDurationMs) && config.toastDurationMs > 0) {
    uiTiming.toastDurationMs = config.toastDurationMs;
  }
}
