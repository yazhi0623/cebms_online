import type { TemplateItem } from "../../entities/template/types";

export function formatDate(value: string): string {
  // 后端返回 ISO 字符串，这里统一转成本地可读时间。
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function navigate(path: string) {
  // 项目没有引入重型路由库，因此直接操作 history + popstate。
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function sortTemplates(items: TemplateItem[]): TemplateItem[] {
  // 默认模板永远排最前，剩余模板按更新时间倒序展示。
  return [...items].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}
