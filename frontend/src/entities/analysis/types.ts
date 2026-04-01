// 单条分析结果，既可以对应单条记录，也可能来自批量分析流程。
export type AnalysisItem = {
  id: number;
  userId: number;
  recordId: number | null;
  templateId: number | null;
  analysisType: "single" | "batch_chunk" | "batch_summary";
  title: string;
  content: string;
  dayKey: string;
  createdAt: string;
  isBatchChunk: boolean;
  isFinalSummary: boolean;
};

// 分析页顶部汇总卡片依赖的聚合数据。
export type AnalysisAggregate = {
  totalCount: number;
  latestDay: string | null;
  combinedContent: string;
};

// 前端用它判断当天还能否继续触发 AI 分析。
export type TodayAnalysisCount = {
  date: string;
  count: number;
  limit: number;
  threshold: number;
  llmEnabled: boolean;
};

export type AnalysisTaskItem = {
  id: number;
  userId: number;
  recordId: number | null;
  templateId: number | null;
  rangeMonths: number;
  status: "pending" | "running" | "success" | "failed";
  resultAnalysisId: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};
