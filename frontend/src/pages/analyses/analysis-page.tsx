import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { AnalysisAggregate, AnalysisItem, TodayAnalysisCount } from "../../entities/analysis/types";
import type { RecordItem } from "../../entities/record/types";
import type { TemplateItem } from "../../entities/template/types";
import {
  deleteAnalysis,
  fetchAnalyses,
  fetchAnalysisAggregate,
  fetchTodayAnalysisCount,
  generateAnalysis,
} from "../../features/analysis/api";
import { fetchRecords } from "../../features/record/api";
import { fetchTemplates } from "../../features/template/api";
import {
  loadAnalysisPreviewCache,
  loadTemplateListCache,
  saveAnalysisPreviewCache,
  saveTemplateListCache,
} from "../../shared/constants/storage";
import { uiTiming } from "../../shared/constants/ui";
import { useAuth } from "../../shared/hooks/use-auth";
import { useConfirm } from "../../shared/hooks/use-confirm";

const analysisRangeOptions = [
  { value: "1m", label: "近一个月", months: 1 },
  { value: "3m", label: "近三个月", months: 3 },
  { value: "6m", label: "近六个月", months: 6 },
  { value: "1y", label: "近一年", months: 12 },
  { value: "all", label: "全部", months: 0 },
] as const;

const analysisMenuGroups = [
  { value: "range", label: "时间" },
  { value: "template", label: "模板" },
] as const;

const ANALYSIS_MENU_PRIMARY_MIN_WIDTH = 44;

type AnalysisSelectionType = "range" | "template";

type AnalysisBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; heading: string; lines?: string[] };

const AI_SUPPLEMENT_HEADING = "AI分析：";
const NEXT_STEP_HEADING = "下一步建议：";
const ANALYSIS_SAMPLE_NOTICE = "AI分析功能暂时关闭，目前生成样本数据";

const DEMO_ANALYSES: AnalysisItem[] = [
  {
    id: -1,
    userId: 0,
    recordId: null,
    templateId: null,
    analysisType: "single",
    title: "AI分析·全部·2026-03-28",
    content:
      "总体趋势：最近几天状态有明显波动，白天更容易疲惫，晚上会反复想事情。\n\n状态变化：前半段还能维持基本节奏，后半段开始出现拖延和回避。\n\n主要触发因素：睡眠不足、任务堆积、对结果担心过多。\n\n已出现的有效应对：写下要做的事、缩小当天目标后，执行阻力会下降。\n\n下一步建议：先只保留一件最重要的小事，完成后就停止加码。",
    dayKey: "2026-03-28",
    createdAt: "2026-03-28T20:30:00",
    isBatchChunk: false,
    isFinalSummary: false,
  },
  {
    id: -2,
    userId: 0,
    recordId: null,
    templateId: null,
    analysisType: "batch_summary",
    title: "AI分析·前三个月·2026-03-30",
    content:
      "总体趋势：近三个月情绪波动和精力起伏都比较明显，低谷通常出现在连续忙碌或睡眠不稳之后。\n\n状态变化：偶尔会有几天恢复得不错，但一旦节奏被打乱，容易重新进入低能量状态。\n\n重复出现的问题模式：任务一多就容易拖到很晚，拖延后又加重内耗。\n\n已出现的有效应对：拆小步骤、减少当天目标、保留固定的休息时段。\n\n下一步建议：继续观察睡眠和任务密度对情绪的影响，每天只记录一个最想改善的问题。",
    dayKey: "2026-03-30",
    createdAt: "2026-03-30T09:15:00",
    isBatchChunk: false,
    isFinalSummary: true,
  },
];

const DEMO_ANALYSIS_AGGREGATE: AnalysisAggregate = {
  totalCount: DEMO_ANALYSES.length,
  latestDay: "2026-03-30",
  combinedContent: DEMO_ANALYSES.map((item) => `${item.title}\n${item.content}`).join("\n\n"),
};

const DEMO_TODAY_COUNT: TodayAnalysisCount = {
  date: "2026-03-30",
  count: 1,
  limit: 20,
  threshold: 10,
  llmEnabled: true,
};

function splitAnalysisParagraphs(content: string): string[] {
  return (content ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitSuggestionLines(content: string): string[] {
  return (content ?? "")
    .split(/(?<=[；。])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractHeadingBlock(paragraph: string): { heading: string; trailingContent: string } | null {
  const normalized = paragraph.trim();
  const headingPatterns = [
    { heading: AI_SUPPLEMENT_HEADING, pattern: /^\*{0,2}AI分析\*{0,2}[:：]?\s*/ },
    { heading: NEXT_STEP_HEADING, pattern: /^\*{0,2}下一步建议\*{0,2}[:：]?\s*/ },
  ] as const;

  for (const item of headingPatterns) {
    if (item.pattern.test(normalized)) {
      return {
        heading: item.heading,
        trailingContent: normalized.replace(item.pattern, "").trim(),
      };
    }
  }

  return null;
}

function mapAnalysisBlocks(content: string): AnalysisBlock[] {
  return splitAnalysisParagraphs(content).reduce<AnalysisBlock[]>((blocks, paragraph) => {
    const headingBlock = extractHeadingBlock(paragraph);
    if (!headingBlock) {
      blocks.push({ type: "paragraph", content: paragraph });
      return blocks;
    }

    const { heading, trailingContent } = headingBlock;
    if (!trailingContent) {
      blocks.push({ type: "heading", heading });
      return blocks;
    }

    const lines = heading === NEXT_STEP_HEADING ? splitSuggestionLines(trailingContent) : [trailingContent];
    blocks.push({ type: "heading", heading, lines });
    return blocks;
  }, []);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeGenerateErrorMessage(message: string): string {
  const thresholdMatch = message.match(/^At least (\d+) records are required for analysis$/);
  if (thresholdMatch) {
    return `至少需要 ${thresholdMatch[1]} 条记录后才能生成`;
  }

  const limitMatch = message.match(/^Daily analysis limit reached \((\d+)\)$/);
  if (limitMatch) {
    return `今日次数已达到上限 ${limitMatch[1]}`;
  }

  return message || "生成失败";
}

export function AnalysisPage() {
  const minimumInitOverlayMs = 1000;
  const { backendReady, currentUser, session, loading: authLoading } = useAuth();
  const { confirm } = useConfirm();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [aggregate, setAggregate] = useState<AnalysisAggregate | null>(null);
  const [todayCount, setTodayCount] = useState<TodayAnalysisCount | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectionType, setSelectionType] = useState<AnalysisSelectionType>("range");
  const [selectedLabel, setSelectedLabel] = useState("--");
  const [analysisMenuOpen, setAnalysisMenuOpen] = useState(false);
  const [analysisMenuGroup, setAnalysisMenuGroup] = useState<AnalysisSelectionType>("range");
  const [analysisMenuWidth, setAnalysisMenuWidth] = useState(220);
  const [analysisMenuPrimaryWidth, setAnalysisMenuPrimaryWidth] = useState(52);
  const [analysisMenuReady, setAnalysisMenuReady] = useState(false);
  const [portraitLayout, setPortraitLayout] = useState(window.matchMedia("(orientation: portrait)").matches);
  const analysisToolbarRef = useRef<HTMLDivElement | null>(null);
  const analysisToolbarLabelRef = useRef<HTMLSpanElement | null>(null);
  const analysisMenuRef = useRef<HTMLDivElement | null>(null);
  const initialLoadingStartedAtRef = useRef(Date.now());

  const isDemoMode = !backendReady || !session?.accessToken || !currentUser;
  const visibleAnalyses = analyses.filter((analysis) => analysis.analysisType !== "batch_chunk");
  const availableTemplateOptions = useMemo(
    () =>
      [...templates].sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1;
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      }),
    [templates],
  );
  const latestAnalysisTime =
    visibleAnalyses.reduce<string | null>((latest, analysis) => {
      if (!analysis.createdAt) {
        return latest;
      }

      if (!latest) {
        return analysis.createdAt;
      }

      return new Date(analysis.createdAt).getTime() > new Date(latest).getTime() ? analysis.createdAt : latest;
    }, null) ?? aggregate?.latestDay ?? null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: portrait)");

    const syncPortraitLayout = (event?: MediaQueryListEvent) => {
      setPortraitLayout(event?.matches ?? mediaQuery.matches);
    };

    syncPortraitLayout();
    mediaQuery.addEventListener("change", syncPortraitLayout);
    return () => {
      mediaQuery.removeEventListener("change", syncPortraitLayout);
    };
  }, []);

  useEffect(() => {
    if (!pageNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPageNotice(null);
    }, uiTiming.toastDurationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pageNotice]);

  useEffect(() => {
    if (!analysisMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!analysisMenuRef.current?.contains(event.target as Node)) {
        setAnalysisMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [analysisMenuOpen]);

  useLayoutEffect(() => {
    if (!analysisToolbarRef.current || !analysisToolbarLabelRef.current) {
      return;
    }

    const activeSubmenuLabels =
      analysisMenuGroup === "range"
        ? analysisRangeOptions.map((option) => option.label)
        : availableTemplateOptions.length
          ? availableTemplateOptions.map((template) => template.title)
          : ["暂无模板"];
    const allSubmenuLabels = [
      ...analysisRangeOptions.map((option) => option.label),
      ...(availableTemplateOptions.length ? availableTemplateOptions.map((template) => template.title) : ["暂无模板"]),
    ];
    void activeSubmenuLabels;
    const submenuLabels = [selectedLabel, ...allSubmenuLabels];
    const primaryLabels = analysisMenuGroups.map((group) => group.label);
    const minSubmenuWidth = portraitLayout ? 64 : 140;
    const measureShell = document.createElement("div");
    const measurePanel = document.createElement("div");
    const measurePrimary = document.createElement("div");
    const measureSubmenu = document.createElement("div");
    measureShell.className = "analysis-menu-shell";
    measureShell.style.position = "fixed";
    measureShell.style.left = "-10000px";
    measureShell.style.top = "0";
    measureShell.style.visibility = "hidden";
    measureShell.style.pointerEvents = "none";
    measureShell.style.width = "auto";
    measurePanel.className = portraitLayout ? "analysis-menu__panel analysis-menu__panel--portrait" : "analysis-menu__panel";
    measurePanel.style.position = "static";
    measurePanel.style.top = "auto";
    measurePanel.style.right = "auto";
    measurePanel.style.width = "auto";
    measurePanel.style.gridTemplateColumns = "max-content max-content";
    measurePrimary.className = "analysis-menu__primary";
    measureSubmenu.className = portraitLayout ? "analysis-menu__submenu analysis-menu__submenu--portrait" : "analysis-menu__submenu";

    primaryLabels.forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "analysis-menu__group";
      button.textContent = label;
      measurePrimary.appendChild(button);
    });

    submenuLabels.forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = portraitLayout ? "analysis-menu__option analysis-menu__option--portrait" : "analysis-menu__option";
      button.textContent = label;
      measureSubmenu.appendChild(button);
    });

    measurePanel.appendChild(measurePrimary);
    measurePanel.appendChild(measureSubmenu);
    measureShell.appendChild(measurePanel);
    document.body.appendChild(measureShell);

    const desiredPrimaryWidth = Math.max(
      ANALYSIS_MENU_PRIMARY_MIN_WIDTH,
      Math.ceil(measurePrimary.getBoundingClientRect().width),
    );
    const desiredSubmenuWidth = Math.max(
      minSubmenuWidth,
      Math.ceil(measureSubmenu.getBoundingClientRect().width),
    );

    document.body.removeChild(measureShell);

    const toolbarStyle = window.getComputedStyle(analysisToolbarRef.current);
    const toolbarGap = Number.parseFloat(toolbarStyle.columnGap || toolbarStyle.gap || "0");
    const availableTotalWidth = Math.max(
      desiredPrimaryWidth + minSubmenuWidth,
      Math.floor(
        analysisToolbarRef.current.getBoundingClientRect().width -
          analysisToolbarLabelRef.current.getBoundingClientRect().width -
          toolbarGap,
      ),
    );
    const hardMaxTotalWidth = portraitLayout ? window.innerWidth - 12 : 520;
    const maxTotalWidth = Math.max(
      ANALYSIS_MENU_PRIMARY_MIN_WIDTH + minSubmenuWidth,
      Math.min(availableTotalWidth, hardMaxTotalWidth),
    );
    const nextPrimaryWidth = Math.min(
      desiredPrimaryWidth,
      Math.max(ANALYSIS_MENU_PRIMARY_MIN_WIDTH, maxTotalWidth - minSubmenuWidth),
    );
    const nextSubmenuWidth = Math.min(
      desiredSubmenuWidth,
      Math.max(minSubmenuWidth, maxTotalWidth - nextPrimaryWidth),
    );

    setAnalysisMenuPrimaryWidth(nextPrimaryWidth);
    setAnalysisMenuWidth(nextSubmenuWidth);
    setAnalysisMenuReady(true);
  }, [analysisMenuGroup, availableTemplateOptions, portraitLayout, selectedLabel]);

  async function loadAnalysisData(markInitialized = false): Promise<{ todayCount: TodayAnalysisCount | null }> {
    if (!session?.accessToken || isDemoMode) {
      if (markInitialized) {
        initialLoadingStartedAtRef.current = Date.now();
      }
      setAnalyses(DEMO_ANALYSES);
      setAggregate(DEMO_ANALYSIS_AGGREGATE);
      setTodayCount(DEMO_TODAY_COUNT);
      setRecords([]);
      setTemplates([]);
      setError(null);
      setLoading(false);
      if (markInitialized) {
        const remaining = Math.max(0, minimumInitOverlayMs - (Date.now() - initialLoadingStartedAtRef.current));
        window.setTimeout(() => {
          setInitialLoading(false);
        }, remaining);
      }
      return { todayCount: DEMO_TODAY_COUNT };
    }

    let hasWarmCache = false;
    if (markInitialized) {
      const cachedAnalysisPreview = loadAnalysisPreviewCache(currentUser.id);
      const cachedTemplates = loadTemplateListCache(currentUser.id);
      hasWarmCache = Boolean(
        cachedAnalysisPreview?.analyses.length || cachedAnalysisPreview?.aggregate || cachedAnalysisPreview?.todayCount || cachedTemplates?.templates.length,
      );

      if (cachedAnalysisPreview) {
        setAnalyses(cachedAnalysisPreview.analyses);
        setAggregate(cachedAnalysisPreview.aggregate);
        setTodayCount(cachedAnalysisPreview.todayCount);
      }

      if (cachedTemplates?.templates.length) {
        setTemplates(cachedTemplates.templates);
      }

      if (!hasWarmCache) {
        initialLoadingStartedAtRef.current = Date.now();
      }
    }

    setLoading(true);
    if (markInitialized) {
      setInitialLoading(!hasWarmCache);
    }
    setError(null);
    try {
      const [nextAnalyses, nextAggregate, nextTodayCount, nextRecords, nextTemplates] = await Promise.all([
        fetchAnalyses(session.accessToken),
        fetchAnalysisAggregate(session.accessToken),
        fetchTodayAnalysisCount(session.accessToken),
        fetchRecords(session.accessToken),
        fetchTemplates(session.accessToken),
      ]);
      setAnalyses(nextAnalyses);
      setAggregate(nextAggregate);
      setTodayCount(nextTodayCount);
      setRecords(nextRecords);
      setTemplates(nextTemplates);
      saveAnalysisPreviewCache(currentUser.id, {
        analyses: nextAnalyses.filter((analysis) => analysis.analysisType !== "batch_chunk"),
        aggregate: nextAggregate,
        todayCount: nextTodayCount,
      });
      saveTemplateListCache(currentUser.id, nextTemplates);
      return { todayCount: nextTodayCount };
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载数据失败");
      return { todayCount: null };
    } finally {
      setLoading(false);
      if (markInitialized) {
        if (hasWarmCache) {
          setInitialLoading(false);
        } else {
          const remaining = Math.max(0, minimumInitOverlayMs - (Date.now() - initialLoadingStartedAtRef.current));
          window.setTimeout(() => {
            setInitialLoading(false);
          }, remaining);
        }
      }
    }
  }

  useEffect(() => {
    void loadAnalysisData(true);
  }, [backendReady, currentUser, session]);

  async function requestGenerateAnalysis(
    options: { rangeMonths?: number; templateId?: number | null },
    nextSelectionType: AnalysisSelectionType,
    nextLabel: string,
  ) {
    setSelectionType(nextSelectionType);
    setSelectedLabel(nextLabel);
    setAnalysisMenuGroup(nextSelectionType);
    setAnalysisMenuOpen(false);

    if (!session?.accessToken || isDemoMode) {
      setPageNotice("请先登录或注册");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      await generateAnalysis(session.accessToken, options);
      const snapshot = await loadAnalysisData();
      if (snapshot.todayCount && !snapshot.todayCount.llmEnabled) {
        setPageNotice(ANALYSIS_SAMPLE_NOTICE);
      }
    } catch (generateError) {
      setPageNotice(normalizeGenerateErrorMessage(generateError instanceof Error ? generateError.message : "生成失败"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteAnalysis(analysisId: number) {
    if (!session?.accessToken || isDemoMode) {
      setPageNotice("请先登录或注册");
      return;
    }

    const confirmed = await confirm({
      message: "确认删除当前记录吗？此操作不可撤销",
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(analysisId);
    setError(null);
    try {
      const isDeletingLastAnalysis = visibleAnalyses.length === 1 && visibleAnalyses[0]?.id === analysisId;
      await deleteAnalysis(session.accessToken, analysisId);
      if (isDeletingLastAnalysis) {
        setAnalyses([]);
        setAggregate({
          totalCount: 0,
          latestDay: null,
          combinedContent: "暂无已保存的AI结果",
        });
        return;
      }

      await loadAnalysisData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除记录失败");
    } finally {
      setDeletingId(null);
    }
  }

  const analysisMenuPanelWidth = analysisMenuWidth + analysisMenuPrimaryWidth;

  return (
    <section className="analysis-page-shell">
      {pageNotice ? (
        <div className="record-import-toast" role="status" aria-live="polite">
          <span>{pageNotice}</span>
        </div>
      ) : null}
      {authLoading || initialLoading ? (
        <div className="page-init-overlay" role="status" aria-live="polite">
          <div className="page-init-overlay__dialog">
            <div className="page-init-overlay__spinner" aria-hidden="true" />
            <strong>加载中...</strong>
          </div>
        </div>
      ) : null}
      {generating ? (
        <div className="analysis-loading-overlay" role="status" aria-live="polite">
          <div className="analysis-loading-overlay__dialog">
            <div className="analysis-loading-overlay__spinner" aria-hidden="true" />
            <strong>分析生成中...</strong>
          </div>
        </div>
      ) : null}
      {error ? <p className="auth-form__error">{error}</p> : null}
      <section className="panel-grid analysis-grid analysis-grid--compact">
        <article className="panel panel--wide analysis-panel analysis-panel--summary">
          <div className="data-panel__header">
            <div>
              <h2 className="panel__title">汇总概览</h2>
            </div>
          </div>
          <div className="data-center-hero data-center-hero--compact">
            <div className="data-center-stat">
              <span className="data-center-stat__label">今日次数</span>
              <strong>{todayCount ? todayCount.count : 0}</strong>
            </div>
            <div className="data-center-stat">
              <span className="data-center-stat__label">累计分析</span>
              <strong>{visibleAnalyses.length}</strong>
            </div>
            <div className="data-center-stat">
              <span className="data-center-stat__label">最近时间</span>
              <strong>{latestAnalysisTime ? (portraitLayout ? formatDateOnly(latestAnalysisTime) : formatDate(latestAnalysisTime)) : "暂无"}</strong>
            </div>
          </div>
        </article>
        <div className="analysis-page-toolbar" ref={analysisToolbarRef}>
          <span className="analysis-page-toolbar__label" ref={analysisToolbarLabelRef}>AI分析</span>
          {analysisMenuReady ? (
            <div
              className="analysis-menu-shell"
              ref={analysisMenuRef}
              style={
                {
                  width: `${analysisMenuPanelWidth}px`,
                  "--analysis-menu-shell-width": `${analysisMenuPanelWidth}px`,
                } as CSSProperties
              }
            >
            <button
              aria-expanded={analysisMenuOpen}
              aria-haspopup="menu"
              className="analysis-menu__trigger"
              disabled={generating}
              onClick={() => {
                setAnalysisMenuGroup(selectionType);
                setAnalysisMenuOpen((current) => !current);
              }}
              type="button"
            >
              <span className="analysis-menu__trigger-label">{selectedLabel}</span>
              <span
                aria-hidden="true"
                className={analysisMenuOpen ? "analysis-menu__trigger-caret analysis-menu__trigger-caret--open" : "analysis-menu__trigger-caret"}
              />
            </button>
            {analysisMenuOpen ? (
              <div
                className={portraitLayout ? "analysis-menu__panel analysis-menu__panel--portrait" : "analysis-menu__panel"}
                role="menu"
                style={{ width: "100%", gridTemplateColumns: `${analysisMenuPrimaryWidth}px ${analysisMenuWidth}px` }}
              >
                <div className="analysis-menu__primary" role="presentation">
                  {analysisMenuGroups.map((group) => (
                    <button
                      aria-selected={analysisMenuGroup === group.value}
                      className={analysisMenuGroup === group.value ? "analysis-menu__group analysis-menu__group--active" : "analysis-menu__group"}
                      key={group.value}
                      onClick={() => setAnalysisMenuGroup(group.value)}
                      onFocus={() => setAnalysisMenuGroup(group.value)}
                      onMouseEnter={() => setAnalysisMenuGroup(group.value)}
                      type="button"
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
                <div
                  className={portraitLayout ? "analysis-menu__submenu analysis-menu__submenu--portrait" : "analysis-menu__submenu"}
                  style={{ width: `${analysisMenuWidth}px` }}
                >
                  {analysisMenuGroup === "range"
                    ? analysisRangeOptions.map((option) => (
                        <button
                          className={
                            portraitLayout
                              ? selectedLabel === option.label
                                ? "analysis-menu__option analysis-menu__option--portrait analysis-menu__option--active"
                                : "analysis-menu__option analysis-menu__option--portrait"
                              : selectedLabel === option.label
                                ? "analysis-menu__option analysis-menu__option--active"
                                : "analysis-menu__option"
                          }
                          key={option.value}
                          onClick={() => void requestGenerateAnalysis({ rangeMonths: option.months }, "range", option.label)}
                          role="menuitem"
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))
                    : availableTemplateOptions.length
                      ? availableTemplateOptions.map((template) => (
                          <button
                            className={
                              portraitLayout
                                ? selectedLabel === template.title
                                  ? "analysis-menu__option analysis-menu__option--portrait analysis-menu__option--active"
                                  : "analysis-menu__option analysis-menu__option--portrait"
                                : selectedLabel === template.title
                                  ? "analysis-menu__option analysis-menu__option--active"
                                  : "analysis-menu__option"
                            }
                            key={template.id}
                            onClick={() => void requestGenerateAnalysis({ templateId: template.id }, "template", template.title)}
                            role="menuitem"
                            type="button"
                          >
                            {template.title}
                          </button>
                        ))
                      : (
                          <div className={portraitLayout ? "analysis-menu__empty analysis-menu__empty--portrait" : "analysis-menu__empty"}>暂无模板</div>
                        )}
                </div>
              </div>
            ) : null}
            </div>
          ) : null}
        </div>
        <article className="panel panel--wide analysis-panel analysis-panel--history">
          <h2 className="panel__title">分析历史</h2>
          <div className="data-task-list">
            {!visibleAnalyses.length && !loading ? <p className="panel__hint analysis-panel__empty">当前没有分析记录</p> : null}
            {visibleAnalyses.map((analysis) => (
                <article key={analysis.id} className="data-task-card analysis-history-card">
                  <div className="data-task-card__header">
                    <strong>{analysis.title}</strong>
                    <button
                      aria-label="删除分析记录"
                      className="analysis-history-card__delete"
                      disabled={deletingId === analysis.id}
                      onClick={() => void handleDeleteAnalysis(analysis.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <p className="data-task-card__meta">{formatDate(analysis.createdAt)}</p>
                  <div className="analysis-history-card__content">
                    {mapAnalysisBlocks(analysis.content).map((block, index) =>
                      block.type === "heading" ? (
                        <div key={`${analysis.id}-${index}`} className="analysis-history-card__block">
                          <p className="analysis-history-card__paragraph analysis-history-card__paragraph--heading">
                            {block.heading}
                          </p>
                          {block.lines?.map((line, lineIndex) => (
                            <p key={`${analysis.id}-${index}-${lineIndex}`} className="analysis-history-card__paragraph">
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p key={`${analysis.id}-${index}`} className="analysis-history-card__paragraph">
                          {block.content}
                        </p>
                      ),
                    )}
                  </div>
                </article>
              ))}
          </div>
        </article>
      </section>
    </section>
  );
}
