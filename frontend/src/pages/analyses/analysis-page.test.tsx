import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisPage } from "./analysis-page";

const {
  createAnalysisTaskMock,
  deleteAnalysisMock,
  fetchAnalysesMock,
  fetchAnalysisAggregateMock,
  fetchAnalysisTaskMock,
  fetchRecordsMock,
  fetchTemplatesMock,
  fetchTodayAnalysisCountMock,
  loadAnalysisPreviewCacheMock,
  loadTemplateListCacheMock,
  saveAnalysisPreviewCacheMock,
  saveTemplateListCacheMock,
} = vi.hoisted(() => ({
  createAnalysisTaskMock: vi.fn(),
  deleteAnalysisMock: vi.fn(),
  fetchAnalysesMock: vi.fn(),
  fetchAnalysisAggregateMock: vi.fn(),
  fetchAnalysisTaskMock: vi.fn(),
  fetchRecordsMock: vi.fn(),
  fetchTemplatesMock: vi.fn(),
  fetchTodayAnalysisCountMock: vi.fn(),
  loadAnalysisPreviewCacheMock: vi.fn(),
  loadTemplateListCacheMock: vi.fn(),
  saveAnalysisPreviewCacheMock: vi.fn(),
  saveTemplateListCacheMock: vi.fn(),
}));

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
  fetchAnalyses: fetchAnalysesMock,
  fetchAnalysisAggregate: fetchAnalysisAggregateMock,
  fetchTodayAnalysisCount: fetchTodayAnalysisCountMock,
  createAnalysisTask: createAnalysisTaskMock,
  fetchAnalysisTask: fetchAnalysisTaskMock,
  deleteAnalysis: deleteAnalysisMock,
}));

vi.mock("../../features/record/api", () => ({
  fetchRecords: fetchRecordsMock,
}));

vi.mock("../../features/template/api", () => ({
  fetchTemplates: fetchTemplatesMock,
}));

vi.mock("../../shared/constants/storage", () => ({
  loadAnalysisPreviewCache: loadAnalysisPreviewCacheMock,
  loadTemplateListCache: loadTemplateListCacheMock,
  saveAnalysisPreviewCache: saveAnalysisPreviewCacheMock,
  saveTemplateListCache: saveTemplateListCacheMock,
}));

describe("AnalysisPage", () => {
  beforeEach(() => {
    createAnalysisTaskMock.mockReset();
    deleteAnalysisMock.mockReset();
    fetchAnalysesMock.mockReset();
    fetchAnalysisAggregateMock.mockReset();
    fetchAnalysisTaskMock.mockReset();
    fetchRecordsMock.mockReset();
    fetchTemplatesMock.mockReset();
    fetchTodayAnalysisCountMock.mockReset();
    loadAnalysisPreviewCacheMock.mockReset();
    loadTemplateListCacheMock.mockReset();
    saveAnalysisPreviewCacheMock.mockReset();
    saveTemplateListCacheMock.mockReset();

    fetchAnalysesMock.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        recordId: null,
        templateId: null,
        analysisType: "single",
        title: "AI分析·全部·2026-04-01",
        content: "总体趋势：稳定。",
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
        content: "总体趋势：稳定。",
        dayKey: "2026-04-01",
        createdAt: "2026-04-01T09:00:00Z",
        isBatchChunk: false,
        isFinalSummary: true,
      },
    ]);
    fetchAnalysisAggregateMock.mockResolvedValue({
      totalCount: 5,
      latestDay: "2026-04-01",
      combinedContent: "aggregate",
    });
    fetchTodayAnalysisCountMock.mockResolvedValue({
      date: "2026-04-01",
      count: 1,
      limit: 5,
      threshold: 10,
      llmEnabled: false,
    });
    fetchRecordsMock.mockResolvedValue([]);
    fetchTemplatesMock.mockResolvedValue([]);
    loadAnalysisPreviewCacheMock.mockReturnValue({
      analyses: [
        {
          id: 1,
          userId: 1,
          recordId: null,
          templateId: null,
          analysisType: "single",
          title: "AI分析·全部·2026-04-01",
          content: "总体趋势：稳定。",
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
    });
    loadTemplateListCacheMock.mockReturnValue({ templates: [] });

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

    await screen.findByText("5", {}, { timeout: 3000 });

    const label = screen.getByText("累计分析");
    const statCard = label.closest(".data-center-stat") as HTMLElement | null;
    expect(statCard).not.toBeNull();
    expect(within(statCard!).getByText("5")).toBeInTheDocument();
    expect(within(statCard!).queryByText("1")).not.toBeInTheDocument();
  });

  it(
    "shows disabled notice and does not create a task when llm is disabled",
    async () => {
    render(<AnalysisPage />);

      await screen.findByText("5", {}, { timeout: 3000 });

      fireEvent.click(screen.getByRole("button", { name: "--", hidden: true }));
      fireEvent.click(screen.getByRole("menuitem", { name: "近一个月" }));

      expect(await screen.findByText("AI分析功能暂时关闭", {}, { timeout: 3000 })).toBeInTheDocument();
      expect(createAnalysisTaskMock).not.toHaveBeenCalled();
    },
    10000,
  );
});
