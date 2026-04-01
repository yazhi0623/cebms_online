import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisPage } from "./analysis-page";

vi.mock("../../shared/hooks/use-auth", () => ({
  useAuth: () => ({
    backendReady: true,
    currentUser: { id: 1, username: "tester" },
    session: { accessToken: "token" },
    loading: false,
  }),
}));

vi.mock("../../shared/hooks/use-confirm", () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("../../features/analysis/api", () => ({
  fetchAnalyses: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      recordId: null,
      templateId: null,
      analysisType: "single",
      title: "AI分析·全部·2026-04-01",
      content: "总体趋势：稳定",
      dayKey: "2026-04-01",
      createdAt: "2026-04-01T10:00:00Z",
      isBatchChunk: false,
      isFinalSummary: false,
    },
    {
      id: 2,
      userId: 1,
      recordId: null,
      templateId: null,
      analysisType: "batch_summary",
      title: "AI分析·近一年·2026-04-01",
      content: "总体趋势：稳定",
      dayKey: "2026-04-01",
      createdAt: "2026-04-01T09:00:00Z",
      isBatchChunk: false,
      isFinalSummary: true,
    },
  ]),
  fetchAnalysisAggregate: vi.fn().mockResolvedValue({
    totalCount: 5,
    latestDay: "2026-04-01",
    combinedContent: "aggregate",
  }),
  fetchTodayAnalysisCount: vi.fn().mockResolvedValue({
    date: "2026-04-01",
    count: 1,
    limit: 5,
    threshold: 10,
    llmEnabled: false,
  }),
  generateAnalysis: vi.fn(),
  deleteAnalysis: vi.fn(),
}));

vi.mock("../../features/record/api", () => ({
  fetchRecords: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../features/template/api", () => ({
  fetchTemplates: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../shared/constants/storage", () => ({
  loadAnalysisPreviewCache: vi.fn().mockReturnValue({
    analyses: [
      {
        id: 1,
        userId: 1,
        recordId: null,
        templateId: null,
        analysisType: "single",
        title: "AI分析·全部·2026-04-01",
        content: "总体趋势：稳定",
        dayKey: "2026-04-01",
        createdAt: "2026-04-01T10:00:00Z",
        isBatchChunk: false,
        isFinalSummary: false,
      },
    ],
    aggregate: {
      totalCount: 5,
      latestDay: "2026-04-01",
      combinedContent: "aggregate",
    },
    todayCount: {
      date: "2026-04-01",
      count: 1,
      limit: 5,
      threshold: 10,
      llmEnabled: false,
    },
  }),
  loadTemplateListCache: vi.fn().mockReturnValue({ templates: [] }),
  saveAnalysisPreviewCache: vi.fn(),
  saveTemplateListCache: vi.fn(),
}));

describe("AnalysisPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("shows aggregate totalCount instead of visible history length", async () => {
    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
    });

    const label = screen.getByText("累计分析");
    const statCard = label.closest(".data-center-stat") as HTMLElement | null;
    expect(statCard).not.toBeNull();
    expect(within(statCard!).getByText("5")).toBeInTheDocument();
    expect(within(statCard!).queryByText("1")).not.toBeInTheDocument();
  });
});
