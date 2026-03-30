import type { TemplateItem } from "../../entities/template/types";

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function formatCreatedUpdatedTime(createdAt: string, updatedAt: string): string {
  void updatedAt;
  return formatDate(createdAt);
}

export function navigate(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function sortTemplates(items: TemplateItem[]): TemplateItem[] {
  return [...items].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}
