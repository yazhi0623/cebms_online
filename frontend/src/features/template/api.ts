import { apiRequest } from "../../shared/api/client";
import type { TemplateItem } from "../../entities/template/types";

type TemplateResponse = {
  id: number;
  user_id: number;
  title: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchTemplates(accessToken: string): Promise<TemplateItem[]> {
  // 模板列表同时服务于模板侧栏和记录编辑器的模板导入菜单。
  const templates = await apiRequest<TemplateResponse[]>("/templates", {
    accessToken,
  });

  return templates.map(mapTemplate);
}

function mapTemplate(template: TemplateResponse): TemplateItem {
  // 在 feature 层完成 snake_case -> camelCase 的字段转换。
  return {
    id: template.id,
    userId: template.user_id,
    title: template.title,
    content: template.content,
    isDefault: template.is_default,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}

type TemplatePayload = {
  title: string;
  content: string;
  is_default: boolean;
};

export async function createTemplate(accessToken: string, payload: TemplatePayload): Promise<TemplateItem> {
  // 新建模板后返回完整对象，前端可以直接写回列表。
  const template = await apiRequest<TemplateResponse>("/templates", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });

  return mapTemplate(template);
}

export async function updateTemplate(
  accessToken: string,
  templateId: number,
  payload: TemplatePayload,
): Promise<TemplateItem> {
  // 更新模板和新建模板共享同一套对象映射逻辑。
  const template = await apiRequest<TemplateResponse>(`/templates/${templateId}`, {
    method: "PUT",
    accessToken,
    body: JSON.stringify(payload),
  });

  return mapTemplate(template);
}

export async function deleteTemplate(accessToken: string, templateId: number): Promise<void> {
  // 删除模板返回 204，调用方只需等待请求完成。
  await apiRequest<void>(`/templates/${templateId}`, {
    method: "DELETE",
    accessToken,
  });
}
