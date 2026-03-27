// 三类异步任务共用同一套状态值，方便前端统一渲染状态标签。
export type JobStatus = "pending" | "running" | "success" | "failed";

// 导入支持的源文件类型。
export type ImportSourceType = "json" | "xlsx" | "txt" | "markdown" | "csv";
// 导出支持的数据资源类型。
export type ExportType = "records" | "templates" | "analyses";
// 导出支持的文件格式。
export type ExportFormat = "json" | "xlsx" | "markdown" | "txt" | "csv";
export type BackupFormat = "zip";

// 记录导入任务在前端列表中的结构。
export type ImportTask = {
  id: number;
  userId: number;
  sourceType: ImportSourceType;
  fileName: string;
  status: JobStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  errorReportPath: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

// 记录/模板/分析导出任务结构。
export type ExportTask = {
  id: number;
  userId: number;
  exportType: ExportType;
  format: ExportFormat;
  status: JobStatus;
  filePath: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
};

// 备份任务结构，磁盘路径和校验和都由后端生成。
export type BackupTask = {
  id: number;
  userId: number;
  format: BackupFormat;
  status: JobStatus;
  storagePath: string | null;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};
