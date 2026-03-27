import type {
  BackupTask,
  ExportFormat,
  ExportTask,
  ExportType,
  ImportSourceType,
  ImportTask,
} from "../../entities/data-center/types";
import { apiBaseUrl, apiRequest } from "../../shared/api/client";

type ImportTaskResponse = {
  id: number;
  user_id: number;
  source_type: ImportSourceType;
  file_name: string;
  status: ImportTask["status"];
  total_count: number;
  success_count: number;
  failed_count: number;
  error_report_path: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type ExportTaskResponse = {
  id: number;
  user_id: number;
  export_type: ExportType;
  format: ExportFormat;
  status: ExportTask["status"];
  file_path: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  expires_at: string | null;
};

type BackupTaskResponse = {
  id: number;
  user_id: number;
  format: BackupTask["format"];
  status: BackupTask["status"];
  storage_path: string | null;
  checksum: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

type CreateImportPayload = {
  sourceType: ImportSourceType;
  fileName: string;
};

type CreateExportPayload = {
  exportType: ExportType;
  format: ExportFormat;
};

function mapImportTask(task: ImportTaskResponse): ImportTask {
  // 数据中心页内部统一使用 camelCase 字段管理任务状态。
  return {
    id: task.id,
    userId: task.user_id,
    sourceType: task.source_type,
    fileName: task.file_name,
    status: task.status,
    totalCount: task.total_count,
    successCount: task.success_count,
    failedCount: task.failed_count,
    errorReportPath: task.error_report_path,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    finishedAt: task.finished_at,
  };
}

function mapExportTask(task: ExportTaskResponse): ExportTask {
  // 导出任务除了状态外，还会额外关心文件路径和过期时间。
  return {
    id: task.id,
    userId: task.user_id,
    exportType: task.export_type,
    format: task.format,
    status: task.status,
    filePath: task.file_path,
    fileSize: task.file_size,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    finishedAt: task.finished_at,
    expiresAt: task.expires_at,
  };
}

function mapBackupTask(task: BackupTaskResponse): BackupTask {
  // 备份任务和导出任务很像，但字段语义不同，所以单独映射。
  return {
    id: task.id,
    userId: task.user_id,
    format: task.format,
    status: task.status,
    storagePath: task.storage_path,
    checksum: task.checksum,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    finishedAt: task.finished_at,
  };
}

export async function fetchImportTasks(accessToken: string): Promise<ImportTask[]> {
  const response = await apiRequest<ImportTaskResponse[]>("/imports/records", { accessToken });
  return response.map(mapImportTask);
}

export async function deleteImportTask(accessToken: string, taskId: number): Promise<void> {
  await apiRequest<void>(`/imports/records/${taskId}`, {
    accessToken,
    method: "DELETE",
  });
}

export async function createImportTask(accessToken: string, payload: CreateImportPayload): Promise<ImportTask> {
  const response = await apiRequest<ImportTaskResponse>("/imports/records", {
    accessToken,
    method: "POST",
    body: JSON.stringify({
      source_type: payload.sourceType,
      file_name: payload.fileName,
    }),
  });

  return mapImportTask(response);
}

export async function uploadImportFile(accessToken: string, payload: { sourceType: ImportSourceType; file: File }): Promise<ImportTask> {
  // 文件上传必须走 FormData，不能复用通用 JSON 请求助手。
  const formData = new FormData();
  formData.append("source_type", payload.sourceType);
  formData.append("file", payload.file);

  const response = await fetch(`${apiBaseUrl}/imports/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upload failed with status ${response.status}`);
  }

  return mapImportTask((await response.json()) as ImportTaskResponse);
}

export async function uploadTemplateFile(accessToken: string, file: File): Promise<{ successCount: number; failedCount: number; totalCount: number }> {
  // 模板导入接口直接返回统计结果，而不是后台任务。
  const formData = new FormData();
  formData.append("upload_file", file);

  const response = await fetch(`${apiBaseUrl}/templates/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    success_count: number;
    failed_count: number;
    total_count: number;
  };

  return {
    successCount: payload.success_count,
    failedCount: payload.failed_count,
    totalCount: payload.total_count,
  };
}

export async function fetchExportTasks(accessToken: string): Promise<ExportTask[]> {
  const response = await apiRequest<ExportTaskResponse[]>("/exports", { accessToken });
  return response.map(mapExportTask);
}

export async function deleteExportTask(accessToken: string, taskId: number): Promise<void> {
  await apiRequest<void>(`/exports/${taskId}`, {
    accessToken,
    method: "DELETE",
  });
}

export async function createExportTask(accessToken: string, payload: CreateExportPayload): Promise<ExportTask> {
  const response = await apiRequest<ExportTaskResponse>("/exports", {
    accessToken,
    method: "POST",
    body: JSON.stringify({
      export_type: payload.exportType,
      format: payload.format,
    }),
  });

  return mapExportTask(response);
}

export async function fetchBackupTasks(accessToken: string): Promise<BackupTask[]> {
  const response = await apiRequest<BackupTaskResponse[]>("/backups", { accessToken });
  return response.map(mapBackupTask);
}

export async function deleteBackupTask(accessToken: string, taskId: number): Promise<void> {
  await apiRequest<void>(`/backups/${taskId}`, {
    accessToken,
    method: "DELETE",
  });
}

export async function createBackupTask(accessToken: string): Promise<BackupTask> {
  const response = await apiRequest<BackupTaskResponse>("/backups", {
    accessToken,
    method: "POST",
    body: JSON.stringify({ format: "zip" }),
  });

  return mapBackupTask(response);
}

export async function restoreBackupFile(
  accessToken: string,
  file: File,
): Promise<{ recordsImported: number; templatesImported: number; analysesImported: number }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${apiBaseUrl}/backups/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upload failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    records_imported: number;
    templates_imported: number;
    analyses_imported: number;
  };

  return {
    recordsImported: payload.records_imported,
    templatesImported: payload.templates_imported,
    analysesImported: payload.analyses_imported,
  };
}

async function downloadFile(path: string, accessToken: string | null | undefined, fallbackName: string): Promise<void> {
  // 统一处理文件下载：请求 -> blob -> object URL -> 模拟点击下载。
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const contentDisposition = response.headers.get("Content-Disposition");
  const matchedName = contentDisposition?.match(/filename="?([^"]+)"?$/i)?.[1];
  const fileName = matchedName || fallbackName;
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadImportReport(accessToken: string, taskId: number): Promise<void> {
  await downloadFile(`/imports/records/${taskId}/report`, accessToken, `import-report-${taskId}.txt`);
}

export async function fetchImportReportText(accessToken: string, taskId: number): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/imports/records/${taskId}/report`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Download failed with status ${response.status}`);
  }

  return response.text();
}

export async function downloadRecordImportTemplateZip(accessToken?: string | null): Promise<void> {
  await downloadFile("/imports/records/template/download", accessToken, "record-import-templates.zip");
}

export async function downloadExportFile(accessToken: string, taskId: number, exportType: ExportType, format: ExportFormat): Promise<void> {
  await downloadFile(`/exports/${taskId}/download`, accessToken, `${exportType}-export-${taskId}.${format}`);
}

export async function downloadBackupFile(accessToken: string, taskId: number): Promise<void> {
  await downloadFile(`/backups/${taskId}/download`, accessToken, `backup-${taskId}.zip`);
}

export async function downloadTemplateExportFile(accessToken: string, format: ExportFormat): Promise<void> {
  const extension = format === "markdown" ? "md" : format;
  await downloadFile(`/templates/export?format=${format}`, accessToken, `templates-export.${extension}`);
}
