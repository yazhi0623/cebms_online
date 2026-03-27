import { apiRequest } from "../../shared/api/client";
import type { RecordItem } from "../../entities/record/types";

type RecordResponse = {
  id: number;
  user_id: number;
  template_id: number | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function fetchRecords(accessToken: string): Promise<RecordItem[]> {
  // 列表接口返回的是后端字段命名，先在这里统一映射成前端领域对象。
  const records = await apiRequest<RecordResponse[]>("/records", {
    accessToken,
  });

  return records.map((record) => ({
    id: record.id,
    userId: record.user_id,
    templateId: record.template_id,
    title: record.title,
    content: record.content,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));
}

type RecordPayload = {
  title: string;
  content: string;
  templateId?: number | null;
};

function mapRecord(record: RecordResponse): RecordItem {
  // 在 feature 层把字段格式转换好，页面组件就不用关心后端命名风格。
  return {
    id: record.id,
    userId: record.user_id,
    templateId: record.template_id,
    title: record.title,
    content: record.content,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function createRecord(accessToken: string, payload: RecordPayload): Promise<RecordItem> {
  // 新建后直接返回完整记录对象，便于前端立刻插入列表。
  const record = await apiRequest<RecordResponse>("/records", {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
      template_id: payload.templateId ?? null,
    }),
  });

  return mapRecord(record);
}

export async function updateRecord(
  accessToken: string,
  recordId: number,
  payload: RecordPayload,
): Promise<RecordItem> {
  // 更新接口和新建接口共享同一套响应映射逻辑。
  const record = await apiRequest<RecordResponse>(`/records/${recordId}`, {
    method: "PUT",
    accessToken,
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
      template_id: payload.templateId ?? null,
    }),
  });

  return mapRecord(record);
}

export async function deleteRecord(accessToken: string, recordId: number): Promise<void> {
  // 删除接口返回 204，无需解析响应体。
  await apiRequest<void>(`/records/${recordId}`, {
    method: "DELETE",
    accessToken,
  });
}
