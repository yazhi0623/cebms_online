import type { AnalysisAggregate, AnalysisItem, AnalysisTaskItem, TodayAnalysisCount } from "../../entities/analysis/types";
import { apiRequest } from "../../shared/api/client";

type AnalysisResponse = {
  id: number;
  user_id: number;
  record_id: number | null;
  template_id: number | null;
  analysis_type: "single" | "batch_chunk" | "batch_summary";
  content: string;
  day_key: string;
  created_at: string;
};

type AggregateResponse = {
  total_count: number;
  latest_day: string | null;
  combined_content: string;
};

type TodayCountResponse = {
  date?: string;
  day_key?: string;
  count: number;
  limit: number;
  threshold: number;
  llm_enabled?: boolean;
};

type AnalysisTaskResponse = {
  id: number;
  user_id: number;
  record_id: number | null;
  template_id: number | null;
  range_months: number;
  status: "pending" | "running" | "success" | "failed";
  result_analysis_id: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

const ANALYSIS_TITLE_PREFIX = "【分析范围】";

function normalizeAnalysisDisplayContent(content: string): string {
  // 后端返回的长文本里可能有多余空行，这里先做一次展示层清洗。
  return (content ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatAnalysisTitleDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRangeLabel(rangeLabel: string): string {
  return rangeLabel
    .replace(/（第\d+\/\d+组）$/, "")
    .replace(/（第\d+\/\d+段(?:，[^）]+)?）$/, "")
    .replace(/（汇总）$/, "")
    .replace(/^前一个月$/, "近一个月")
    .replace(/^前三个月$/, "近三个月")
    .replace(/^前六个月$/, "近六个月")
    .replace(/^前一年$/, "近一年")
    .trim();
}

function parseAnalysisContent(content: string): { title: string; content: string } {
  // 分析文本第一行约定为范围标题，这里拆成卡片标题和正文。
  const [firstLine = "", ...restLines] = (content ?? "").split(/\r?\n/);
  if (firstLine.startsWith(ANALYSIS_TITLE_PREFIX)) {
    const rangeLabel = normalizeRangeLabel(firstLine.slice(ANALYSIS_TITLE_PREFIX.length).trim() || "全部");
    return {
      title: `AI分析·${rangeLabel}`,
      content: normalizeAnalysisDisplayContent(restLines.join("\n")),
    };
  }

  return {
    title: "AI分析·全部",
    content: normalizeAnalysisDisplayContent(content),
  };
}

function mapAnalysis(item: AnalysisResponse): AnalysisItem {
  // 统一把后端分析对象转换成页面直接可用的展示对象。
  const parsed = parseAnalysisContent(item.content);

  return {
    id: item.id,
    userId: item.user_id,
    recordId: item.record_id,
    templateId: item.template_id,
    analysisType: item.analysis_type,
    title: `${parsed.title}·${formatAnalysisTitleDate(item.created_at)}`,
    content: parsed.content,
    dayKey: item.day_key,
    createdAt: item.created_at,
    isBatchChunk: item.analysis_type === "batch_chunk",
    isFinalSummary: item.analysis_type === "batch_summary",
  };
}

function mapAnalysisTask(item: AnalysisTaskResponse): AnalysisTaskItem {
  return {
    id: item.id,
    userId: item.user_id,
    recordId: item.record_id,
    templateId: item.template_id,
    rangeMonths: item.range_months,
    status: item.status,
    resultAnalysisId: item.result_analysis_id,
    errorMessage: item.error_message,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    finishedAt: item.finished_at,
  };
}

export async function fetchAnalyses(accessToken: string): Promise<AnalysisItem[]> {
  // 历史列表接口返回原始数组，这里顺手完成展示字段映射。
  const response = await apiRequest<AnalysisResponse[]>("/analyses", { accessToken });
  return response.map(mapAnalysis);
}

export async function fetchAnalysisAggregate(accessToken: string): Promise<AnalysisAggregate> {
  const response = await apiRequest<AggregateResponse>("/analyses/aggregate", { accessToken });
  return {
    totalCount: response.total_count,
    latestDay: response.latest_day,
    combinedContent: response.combined_content,
  };
}

export async function fetchTodayAnalysisCount(accessToken: string): Promise<TodayAnalysisCount> {
  const response = await apiRequest<TodayCountResponse>("/analyses/count/today", { accessToken });
  return {
    date: response.date ?? response.day_key ?? "",
    count: response.count,
    limit: response.limit,
    threshold: response.threshold,
    llmEnabled: response.llm_enabled ?? true,
  };
}

export async function generateAnalysis(
  accessToken: string,
  options?: { recordId?: number | null; templateId?: number | null; rangeMonths?: number },
): Promise<AnalysisItem> {
  // 生成分析既可能从记录页发起，也可能从分析页按时间范围发起。
  const response = await apiRequest<AnalysisResponse>("/analyses/generate", {
    accessToken,
    method: "POST",
    body: JSON.stringify({
      ...(options?.recordId ? { record_id: options.recordId } : {}),
      ...(options?.templateId ? { template_id: options.templateId } : {}),
      range_months: options?.rangeMonths ?? 0,
    }),
  });

  return mapAnalysis(response);
}

export async function createAnalysisTask(
  accessToken: string,
  options?: { recordId?: number | null; templateId?: number | null; rangeMonths?: number },
): Promise<AnalysisTaskItem> {
  const response = await apiRequest<AnalysisTaskResponse>("/analyses/tasks", {
    accessToken,
    method: "POST",
    body: JSON.stringify({
      ...(options?.recordId ? { record_id: options.recordId } : {}),
      ...(options?.templateId ? { template_id: options.templateId } : {}),
      range_months: options?.rangeMonths ?? 0,
    }),
  });

  return mapAnalysisTask(response);
}

export async function fetchAnalysisTask(accessToken: string, taskId: number): Promise<AnalysisTaskItem> {
  const response = await apiRequest<AnalysisTaskResponse>(`/analyses/tasks/${taskId}`, {
    accessToken,
  });
  return mapAnalysisTask(response);
}

export async function deleteAnalysis(accessToken: string, analysisId: number): Promise<void> {
  await apiRequest<void>(`/analyses/${analysisId}`, {
    accessToken,
    method: "DELETE",
  });
}
