import { useEffect, useRef, useState } from "react";

import type { ExportFormat, ExportType, ImportSourceType } from "../../entities/data-center/types";
import {
  createBackupTask,
  createExportTask,
  downloadBackupFile,
  downloadExportFile,
  downloadRecordImportTemplateZip,
  fetchBackupTasks,
  fetchImportReportText,
  fetchExportTasks,
  fetchImportTasks,
  restoreBackupFile,
  uploadImportFile,
} from "../../features/data-center/api";
import { uiTiming } from "../../shared/constants/ui";
import { useAuth } from "../../shared/hooks/use-auth";
import { DropdownAction } from "../../shared/ui/dropdown-action";

const exportTypeOptions: Array<{ value: ExportType; label: string; description: string }> = [
  { value: "records", label: "记录", description: "导出记录正文与关联时间信息。" },
  { value: "analyses", label: "AI分析", description: "导出历史和汇总结果。" },
];

const exportFormatOptions: Array<{ value: ExportFormat; label: string }> = [
  { value: "json", label: "JSON" },
  { value: "xlsx", label: "XLSX" },
  { value: "markdown", label: "Markdown" },
  { value: "txt", label: "TXT" },
];

const actionClickCooldownMs = 2000;

function detectImportSourceType(fileName: string): ImportSourceType | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".xlsx")) return "xlsx";
  if (normalized.endsWith(".txt")) return "txt";
  if (normalized.endsWith(".md") || normalized.endsWith(".markdown")) return "markdown";
  return null;
}

function formatImportSourceTypeLabel(value: ImportSourceType): string {
  switch (value) {
    case "json":
      return "JSON";
    case "csv":
      return "CSV";
    case "xlsx":
      return "XLSX";
    case "txt":
      return "TXT";
    case "markdown":
      return "Markdown";
    default:
      return value;
  }
}

function getOptionLabel<T extends string>(options: Array<{ value: T; label: string }>, value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function translateImportReportReason(reason: string): string {
  const trimmed = reason.trim();
  const duplicateMatch = trimmed.match(/^Duplicate record ID (\d+) skipped$/i);
  if (duplicateMatch) {
    return `记录 ID ${duplicateMatch[1]} 已存在，已跳过`;
  }

  const reasonMap: Record<string, string> = {
    "Item must be an object": "导入项格式无效，必须是对象",
    "Both title and content are required": "标题和内容不能为空",
    "Both title and content columns are required": "标题列和内容列不能为空",
    "Record content is empty": "记录内容不能为空",
    "JSON file is not valid UTF-8 JSON.": "JSON 文件格式无效或编码错误",
    "JSON payload must be a list or an object with a records field.": "JSON 内容必须是数组，或包含 records 字段",
    "XLSX file is invalid or unreadable.": "XLSX 文件无效或无法读取",
    "XLSX file is empty or missing headers": "XLSX 文件为空或缺少表头",
    "XLSX file is empty or missing rows": "XLSX 文件为空或没有数据行",
    "TXT file is not valid UTF-8 or GBK text.": "TXT 文件编码无效，需使用 UTF-8 或 GBK",
    "TXT file is empty": "TXT 文件为空",
    "Each TXT record must start with a date line like 20250322 or 250305.": "TXT 中每条记录都要以日期行开头，例如 20250322 或 250305",
    "Markdown file is not valid UTF-8 or GBK text.": "Markdown 文件编码无效，需使用 UTF-8 或 GBK",
    "Markdown file does not contain importable records.": "Markdown 文件中没有可导入的记录",
    "Current request did not provide uploaded file content.": "当前请求没有上传文件内容",
  };

  return reasonMap[trimmed] ?? trimmed;
}

function summarizeImportReport(reportText: string): string[] {
  const reasons = reportText
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/(?:^|\s)reason=(.+)$/);
      return match ? match[1].trim() : null;
    })
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(reasons.map(translateImportReportReason)));
}

function buildImportReportToastMessage(reportText: string, successCount: number, failedCount: number): string {
  const summary = summarizeImportReport(reportText);
  if (!summary.length) {
    return `导入失败：成功 ${successCount} 条，失败 ${failedCount} 条，可下载错误报告`;
  }

  return ["导入失败：", ...summary.map((item) => `- ${item}`)].join("\n");
}

function readErrorDetail(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const payload = JSON.parse(trimmed) as { detail?: string | Record<string, unknown> };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function translateUploadLimitMessage(detail: string, label: string): string | null {
  const limitMatch = detail.match(/^.+ exceeds the (\d+)MB upload limit$/i);
  if (!limitMatch) {
    return null;
  }

  return `${label}超过 ${limitMatch[1]}MB 限制`;
}

function normalizeImportErrorMessage(message: string): string {
  const detail = readErrorDetail(message);
  const limitMessage = translateUploadLimitMessage(detail, "导入文件");
  if (limitMessage) {
    return limitMessage;
  }

  const reasonMap: Record<string, string> = {
    "source_type is required": "缺少导入文件类型",
    "file is required": "请先选择导入文件",
    "Current request did not provide uploaded file content.": "当前请求没有上传文件内容",
    "Request failed with status 400": "导入文件格式不正确",
    "Request failed with status 401": "登录状态已失效，请重新登录",
    "Request failed with status 403": "当前账号无权执行导入",
    "Request failed with status 413": "导入文件超过大小限制",
    "Request failed with status 422": "导入请求参数不完整",
    "Upload failed with status 400": "导入文件格式不正确",
    "Upload failed with status 401": "登录状态已失效，请重新登录",
    "Upload failed with status 403": "当前账号无权执行导入",
    "Upload failed with status 413": "导入文件超过大小限制",
    "Upload failed with status 422": "导入请求参数不完整",
  };

  return reasonMap[detail] ?? translateImportReportReason(detail);
}

function normalizeBackupRestoreErrorMessage(message: string): string {
  const detail = readErrorDetail(message);
  const limitMessage = translateUploadLimitMessage(detail, "备份文件");
  if (limitMessage) {
    return limitMessage;
  }

  const reasonMap: Record<string, string> = {
    "Backup file is empty": "备份文件为空",
    "Backup file is not a valid ZIP archive": "备份文件不是有效的 ZIP 压缩包",
    "Backup archive does not contain a supported payload layout": "备份压缩包中缺少可恢复的数据文件",
    "Backup JSON payload is invalid": "备份中的 JSON 数据无效",
    "Backup JSON payload must be a list": "备份中的 JSON 数据格式不正确",
    "Backup XLSX payload is invalid": "备份中的 XLSX 数据无效",
    "Request failed with status 400": "备份文件格式不正确",
    "Request failed with status 401": "登录状态已失效，请重新登录",
    "Request failed with status 403": "当前账号无权恢复备份",
    "Request failed with status 413": "备份文件超过大小限制",
    "Request failed with status 422": "恢复备份请求参数不完整",
    "Upload failed with status 400": "备份文件格式不正确",
    "Upload failed with status 401": "登录状态已失效，请重新登录",
    "Upload failed with status 403": "当前账号无权恢复备份",
    "Upload failed with status 413": "备份文件超过大小限制",
    "Upload failed with status 422": "恢复备份请求参数不完整",
  };

  return reasonMap[detail] ?? detail ?? "恢复备份失败";
}

export function DataCenterPage() {
  const { backendReady, currentUser, session, loading: authLoading } = useAuth();
  const [pageError, setPageError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [creatingImport, setCreatingImport] = useState(false);
  const [creatingExportType, setCreatingExportType] = useState<ExportType | null>(null);
  const [activeExportTypes, setActiveExportTypes] = useState<ExportType[]>([]);
  const [creatingBackupTask, setCreatingBackupTask] = useState(false);
  const [activeBackupTask, setActiveBackupTask] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<string | null>(null);
  const [templateDownloadCooling, setTemplateDownloadCooling] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
  const [exportFormats, setExportFormats] = useState<Record<ExportType, ExportFormat>>({
    records: "json",
    analyses: "json",
    templates: "json",
  });
  const pendingImportIds = useRef<Set<number>>(new Set());
  const pendingExportDownloads = useRef<Map<number, { exportType: ExportType; format: ExportFormat }>>(new Map());
  const pendingBackupDownloads = useRef<Set<number>>(new Set());
  const actionLocks = useRef<Set<string>>(new Set());
  const actionCooldowns = useRef<Map<string, number>>(new Map());
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const isDemoMode = !backendReady || !session?.accessToken || !currentUser;
  const hasPendingTasks = pendingImportIds.current.size > 0 || pendingExportDownloads.current.size > 0 || pendingBackupDownloads.current.size > 0;

  function pushSuccess(message: string) {
    setSuccessMessage(message);
    setDownloadError(null);
    setPageError(null);
  }

  function pushError(message: string) {
    setErrorToast(message);
    setDownloadError(null);
    setPageError(null);
  }

  function acquireActionLock(actionKey: string): boolean {
    if (actionLocks.current.has(actionKey)) {
      return false;
    }

    actionLocks.current.add(actionKey);
    return true;
  }

  function releaseActionLock(actionKey: string) {
    actionLocks.current.delete(actionKey);
  }

  function startActionCooldown(actionKey: string) {
    const previousTimer = actionCooldowns.current.get(actionKey);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
    }

    if (actionKey === "download-import-template-zip") {
      setTemplateDownloadCooling(true);
    }

    const timer = window.setTimeout(() => {
      actionCooldowns.current.delete(actionKey);
      if (actionKey === "download-import-template-zip") {
        setTemplateDownloadCooling(false);
      }
    }, actionClickCooldownMs);

    actionCooldowns.current.set(actionKey, timer);
  }

  function isActionCooling(actionKey: string): boolean {
    return actionCooldowns.current.has(actionKey);
  }

  async function triggerExportDownload(taskId: number, exportType: ExportType, format: ExportFormat) {
    if (!session?.accessToken) return;
    setDownloadTarget(`export-${taskId}`);
    setDownloadError(null);
    try {
      await downloadExportFile(session.accessToken, taskId, exportType, format);
      pushSuccess(`${getOptionLabel(exportTypeOptions, exportType)}导出完成，已开始下载`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "下载导出文件失败");
    } finally {
      setDownloadTarget(null);
    }
  }

  async function triggerBackupDownload(taskId: number) {
    if (!session?.accessToken) return;
    setDownloadTarget(`backup-${taskId}`);
    setDownloadError(null);
    try {
      await downloadBackupFile(session.accessToken, taskId);
      pushSuccess("完整备份已生成，已开始下载");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "下载备份文件失败");
    } finally {
      setDownloadTarget(null);
    }
  }

  async function loadTaskStatuses() {
    if (!session?.accessToken || isDemoMode) {
      return;
    }

    try {
      // 三类任务共用一个轮询周期，避免分别起多个定时器。
      const [imports, exports, backups] = await Promise.all([
        fetchImportTasks(session.accessToken),
        fetchExportTasks(session.accessToken),
        fetchBackupTasks(session.accessToken),
      ]);

      for (const taskId of Array.from(pendingImportIds.current)) {
        const task = imports.find((item) => item.id === taskId);
        if (!task || (task.status !== "success" && task.status !== "failed")) {
          continue;
        }

        pendingImportIds.current.delete(taskId);
        if (task.status === "success" && task.successCount > 0) {
          pushSuccess(`导入完成，已写入 ${task.successCount} 条记录`);
          continue;
        }

        if (task.errorReportPath) {
          // 导入失败时优先拉取错误报告文本，再把它翻译成用户可读提示。
          try {
            const reportText = await fetchImportReportText(session.accessToken, task.id);
            pushError(buildImportReportToastMessage(reportText, task.successCount, task.failedCount));
          } catch {
            pushError(`导入失败：成功 ${task.successCount} 条，失败 ${task.failedCount} 条，可下载错误报告`);
          }
        } else {
          pushError(`导入失败：成功 ${task.successCount} 条，失败 ${task.failedCount} 条`);
        }
      }

      for (const [taskId, meta] of Array.from(pendingExportDownloads.current.entries())) {
        const task = exports.find((item) => item.id === taskId);
        if (!task || (task.status !== "success" && task.status !== "failed")) {
          continue;
        }

        pendingExportDownloads.current.delete(taskId);
        setActiveExportTypes((current) => current.filter((value) => value !== meta.exportType));
        if (task.status === "success" && task.filePath) {
          await triggerExportDownload(task.id, meta.exportType, meta.format);
        } else {
          setPageNotice(`${getOptionLabel(exportTypeOptions, meta.exportType)}导出失败`);
        }
      }

      for (const taskId of Array.from(pendingBackupDownloads.current)) {
        const task = backups.find((item) => item.id === taskId);
        if (!task || (task.status !== "success" && task.status !== "failed")) {
          continue;
        }

        pendingBackupDownloads.current.delete(taskId);
        setActiveBackupTask(false);
        if (task.status === "success" && task.storagePath) {
          await triggerBackupDownload(task.id);
        } else {
          setPageNotice("完整备份生成失败");
        }
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "加载数据中心状态失败");
    }
  }

  useEffect(() => {
    if (!session?.accessToken || isDemoMode || !hasPendingTasks) {
      return;
    }

    void loadTaskStatuses();
    const timer = window.setInterval(() => void loadTaskStatuses(), 2000);
    return () => window.clearInterval(timer);
  }, [hasPendingTasks, isDemoMode, session]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSuccessMessage(null), uiTiming.toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!pageNotice) {
      return;
    }

    const timer = window.setTimeout(() => setPageNotice(null), uiTiming.toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [pageNotice]);

  useEffect(() => {
    if (!errorToast) {
      return;
    }

    const timer = window.setTimeout(() => setErrorToast(null), uiTiming.toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [errorToast]);

  function showLoginRequiredNotice() {
    setPageNotice("请先登录或注册");
    setDownloadError(null);
  }

  async function handleImportUpload() {
    if (!session?.accessToken || isDemoMode) {
      showLoginRequiredNotice();
      return;
    }

    if (!selectedImportFile) {
      setPageNotice("请先从本地选择导入文件");
      return;
    }

    const detectedType = detectImportSourceType(selectedImportFile.name);
    if (!detectedType) {
      setPageNotice("当前仅支持：txt、json、xlsx、markdown");
      return;
    }

    setCreatingImport(true);
    try {
      const task = await uploadImportFile(session.accessToken, {
        sourceType: detectedType,
        file: selectedImportFile,
      });
      // 上传成功只代表任务已创建，真正的解析和入库还在后台继续跑。
      pendingImportIds.current.add(task.id);
      setSelectedImportFile(null);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
      setPageNotice("导入任务已提交，处理中...");
      void loadTaskStatuses();
    } catch (error) {
      pushError(error instanceof Error ? normalizeImportErrorMessage(error.message) : "上传导入文件失败");
    } finally {
      setCreatingImport(false);
    }
  }

  async function handleCreateExportTask(exportType: ExportType) {
    if (!session?.accessToken || isDemoMode) {
      showLoginRequiredNotice();
      return;
    }

    const actionKey = `create-export-${exportType}`;
    if (isActionCooling(actionKey) || !acquireActionLock(actionKey)) {
      return;
    }
    startActionCooldown(actionKey);

    setCreatingExportType(exportType);
    setPageError(null);
    try {
      const task = await createExportTask(session.accessToken, {
        exportType,
        format: exportFormats[exportType],
      });
      // 记住这个任务，等后台导出完成后自动触发浏览器下载。
      pendingExportDownloads.current.set(task.id, { exportType, format: exportFormats[exportType] });
      setActiveExportTypes((current) => (current.includes(exportType) ? current : [...current, exportType]));
      setPageNotice(`${getOptionLabel(exportTypeOptions, exportType)}导出任务已提交，完成后自动下载`);
      void loadTaskStatuses();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "创建导出任务失败");
    } finally {
      setCreatingExportType(null);
      releaseActionLock(actionKey);
    }
  }

  async function handleCreateBackupTask() {
    if (!session?.accessToken || isDemoMode) {
      showLoginRequiredNotice();
      return;
    }

    const actionKey = "create-backup";
    if (isActionCooling(actionKey) || !acquireActionLock(actionKey)) {
      return;
    }
    startActionCooldown(actionKey);

    setCreatingBackupTask(true);
    setPageError(null);
    try {
      const task = await createBackupTask(session.accessToken);
      pendingBackupDownloads.current.add(task.id);
      setActiveBackupTask(true);
      setPageNotice("完整备份任务已提交，完成后自动下载");
      void loadTaskStatuses();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "创建备份任务失败");
    } finally {
      setCreatingBackupTask(false);
      releaseActionLock(actionKey);
    }
  }

  async function handleRestoreBackup() {
    if (!session?.accessToken || isDemoMode) {
      showLoginRequiredNotice();
      return;
    }

    if (!selectedBackupFile) {
      setPageNotice("请先选择本地备份文件");
      return;
    }

    setRestoringBackup(true);
    try {
      const result = await restoreBackupFile(session.accessToken, selectedBackupFile);
      setSelectedBackupFile(null);
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = "";
      }
      pushSuccess(`备份已恢复：记录 ${result.recordsImported}，模板 ${result.templatesImported}，AI分析 ${result.analysesImported}`);
    } catch (error) {
      pushError(error instanceof Error ? normalizeBackupRestoreErrorMessage(error.message) : "恢复备份失败");
    } finally {
      setRestoringBackup(false);
    }
  }

  async function handleDownload(target: string, action: () => Promise<void>, successLabel: string) {
    const actionKey = `download-${target}`;
    if (isActionCooling(actionKey)) {
      return;
    }
    startActionCooldown(actionKey);

    if (!acquireActionLock(actionKey)) {
      return;
    }

    setDownloadTarget(target);
    setDownloadError(null);
    try {
      await action();
      pushSuccess(successLabel);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "下载失败");
    } finally {
      setDownloadTarget(null);
      releaseActionLock(actionKey);
    }
  }

  useEffect(
    () => () => {
      for (const timer of actionCooldowns.current.values()) {
        window.clearTimeout(timer);
      }
      actionCooldowns.current.clear();
    },
    [],
  );

  return (
    <section className="data-center-layout data-center-layout--simple">
      <div className="data-center-layout__alerts">
      {successMessage ? (
        <div aria-live="polite" className="record-import-toast" role="status">
          <span>{successMessage}</span>
        </div>
      ) : null}
      {pageNotice ? (
        <div aria-live="polite" className="record-import-toast" role="status">
          <span>{pageNotice}</span>
        </div>
      ) : null}
      {errorToast ? (
        <div aria-live="assertive" className="record-import-toast" role="alert">
          <span>{errorToast}</span>
        </div>
      ) : null}
      {pageError ? <p className="auth-form__error">{pageError}</p> : null}
      {downloadError ? <p className="auth-form__error">{downloadError}</p> : null}
      </div>

      <section className="data-center-grid data-center-grid--paired" id="data-imports">
        <article className="panel data-panel data-panel--compact-import">
          <div className="data-panel__header">
            <div>
              <h3 className="panel__title">记录导入</h3>
            </div>
            <div className="data-panel__header-actions data-panel__header-actions--floating">
              <button
                className="shell__nav-button"
                disabled={downloadTarget === "import-template-zip" || templateDownloadCooling}
                onClick={() =>
                  void handleDownload(
                    "import-template-zip",
                    () => downloadRecordImportTemplateZip(session?.accessToken),
                    "已开始下载记录导入模板",
                  )
                }
                type="button"
              >
                {downloadTarget === "import-template-zip" ? "下载中..." : "下载模板"}
              </button>
            </div>
          </div>
          <p className="panel__text">目前支持：txt、json、xlsx、markdown</p>
          <form
            className="data-panel__form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleImportUpload();
            }}
          >
            <label className="auth-form__field">
              <span>导入文件</span>
              <input
                accept=".json,.xlsx,.txt,.md,.markdown"
                ref={importFileInputRef}
                onChange={(event) => {
                  setSelectedImportFile(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
            </label>
            <button className="shell__nav-button shell__nav-button--active data-panel__submit" disabled={creatingImport} type="submit">
              {creatingImport ? "导入中..." : "开始导入"}
            </button>
          </form>
        </article>

        <article className="panel data-panel data-panel--compact-import" id="data-backups">
          <div className="data-panel__header">
            <div>
              <h3 className="panel__title">备份恢复</h3>
            </div>
            <div
              aria-hidden="true"
              className="data-panel__header-actions data-panel__header-actions--floating data-panel__header-actions--placeholder"
            >
              <button className="shell__nav-button" disabled type="button">
                下载模板
              </button>
            </div>
          </div>
          <p className="panel__text">选择本地 ZIP 备份文件，将其中的记录、模板和恢复到当前账号。</p>
          <form
            className="data-panel__form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRestoreBackup();
            }}
          >
            <label className="auth-form__field">
              <span>备份文件</span>
              <input
                accept=".zip"
                ref={backupFileInputRef}
                onChange={(event) => {
                  setSelectedBackupFile(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
            </label>
            <button className="shell__nav-button shell__nav-button--active data-panel__submit" disabled={restoringBackup} type="submit">
              {restoringBackup ? "恢复中..." : "开始恢复"}
            </button>
          </form>
        </article>
      </section>

      <section className="data-center-grid data-center-grid--compact-three" id="data-exports">
        {exportTypeOptions.map((option) => (
          <article className="panel data-panel" key={option.value}>
            <div className="data-panel__header">
              <div>
                <h3 className="panel__title">{option.label}导出</h3>
              </div>
            </div>
            <p className="panel__text">{option.description}</p>
            <div className="data-panel__form data-panel__form--split">
              <label className="auth-form__field">
                <span>导出格式</span>
                <DropdownAction
                  className="dropdown-action--full data-center-dropdown"
                  label="选择导出格式"
                  onSelect={(value) =>
                    setExportFormats((current) => ({
                      ...current,
                      [option.value]: value as ExportFormat,
                    }))
                  }
                  options={exportFormatOptions}
                  selectedLabel={getOptionLabel(exportFormatOptions, exportFormats[option.value])}
                  selectedValue={exportFormats[option.value]}
                />
              </label>
              <div className="auth-form__field">
                <button
                  className="shell__nav-button shell__nav-button--active"
                  disabled={creatingExportType !== null || activeExportTypes.includes(option.value)}
                  onClick={() => void handleCreateExportTask(option.value)}
                  type="button"
                >
                  {creatingExportType === option.value
                    ? "创建中..."
                    : activeExportTypes.includes(option.value)
                      ? "处理中..."
                      : option.value === "records"
                        ? "导出记录"
                        : "导出AI分析"}
                </button>
              </div>
            </div>
          </article>
        ))}

        <article className="panel data-panel">
          <div className="data-panel__header">
            <div>
              <h3 className="panel__title">完整备份</h3>
            </div>
          </div>
          <p className="panel__text">打包记录、模板、与相关任务信息，生成完整 ZIP 备份。</p>
          <div className="data-panel__form data-panel__form--split">
            <div className="auth-form__field data-panel__action-spacer" aria-hidden="true" />
            <div className="auth-form__field">
              <button
                className="shell__nav-button shell__nav-button--active"
                disabled={creatingBackupTask || activeBackupTask}
                onClick={() => void handleCreateBackupTask()}
                type="button"
              >
                {creatingBackupTask ? "创建中..." : activeBackupTask ? "处理中..." : "备份全部数据"}
              </button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
