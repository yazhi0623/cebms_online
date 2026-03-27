import { useEffect, useMemo, useRef, useState } from "react";

import type { RecordItem } from "../../entities/record/types";
import type { TemplateItem } from "../../entities/template/types";
import { createRecord, deleteRecord, fetchRecords, updateRecord } from "../../features/record/api";
import { demoRecords } from "../../features/record/demo-data";
import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from "../../features/template/api";
import { demoTemplates } from "../../features/template/demo-data";
import { loadRecordImportNotice, saveRecordImportNotice } from "../../shared/constants/storage";
import { uiTiming } from "../../shared/constants/ui";
import { useAuth } from "../../shared/hooks/use-auth";
import { useConfirm } from "../../shared/hooks/use-confirm";
import { sortTemplates } from "./record-workspace-utils";

export type EditorMode = "record" | "template";

export function useRecordWorkspace() {
  const { backendReady, currentUser, session } = useAuth();
  const { confirm } = useConfirm();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [recordTemplateId, setRecordTemplateId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("record");
  const [templateTitleDraft, setTemplateTitleDraft] = useState("");
  const [templateContentDraft, setTemplateContentDraft] = useState("");
  const [templateDefaultDraft, setTemplateDefaultDraft] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateTriggerLabel, setTemplateTriggerLabel] = useState("导入模板");
  const [titleFocusSignal, setTitleFocusSignal] = useState(0);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const templateMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const notice = loadRecordImportNotice();
    if (!notice) {
      return;
    }

    setImportNotice(`已导入 ${notice.importedCount} 条记录`);
    saveRecordImportNotice(null);
  }, []);

  useEffect(() => {
    if (!importNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setImportNotice(null);
    }, uiTiming.toastDurationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [importNotice]);

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
    let active = true;

    async function loadWorkspaceData() {
      if (!backendReady || !session?.accessToken || !currentUser) {
        // 后端不可用或未登录时进入 demo 模式，保证页面仍可演示和阅读。
        setRecords(demoRecords);
        setTemplates(demoTemplates);
        setSelectedRecordId(null);
        setSelectedTemplateId(null);
        setSelectedRecordIds([]);
        setError(null);
        setTemplateError(null);
        setRecordsLoading(false);
        setTemplatesLoading(false);
        return;
      }

      setRecordsLoading(true);
      setTemplatesLoading(true);
      setError(null);
      setTemplateError(null);

      try {
        // 记录页渲染依赖三组数据：记录、模板、分析配额，所以一起并发拉取。
        const [nextRecords, nextTemplates] = await Promise.all([
          fetchRecords(session.accessToken),
          fetchTemplates(session.accessToken),
        ]);
        if (!active) {
          return;
        }

        setRecords(nextRecords);
        setTemplates(sortTemplates(nextTemplates));
        setSelectedRecordIds((currentIds) => currentIds.filter((id) => nextRecords.some((record) => record.id === id)));
        setSelectedRecordId((currentSelected) =>
          currentSelected && nextRecords.some((record) => record.id === currentSelected) ? currentSelected : null,
        );
        setSelectedTemplateId((currentSelected) =>
          currentSelected && nextTemplates.some((template) => template.id === currentSelected)
            ? currentSelected
            : null,
        );
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "加载记录失败");
        setTemplateError(loadError instanceof Error ? loadError.message : "加载模板失败");
        setSelectedRecordId(null);
        setSelectedTemplateId(null);
      } finally {
        if (active) {
          setRecordsLoading(false);
          setTemplatesLoading(false);
        }
      }
    }

    void loadWorkspaceData();
    return () => {
      active = false;
    };
  }, [backendReady, currentUser, session]);

  const isDemoMode = !backendReady || !session?.accessToken || !currentUser;

  const filteredRecords = useMemo(() => {
    // 当前数据量较小，搜索直接在前端内存里做过滤即可。
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return records;
    }

    return records.filter((record) => {
      const title = record.title.toLowerCase();
      const content = record.content.toLowerCase();
      return title.includes(keyword) || content.includes(keyword);
    });
  }, [records, searchKeyword]);

  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const defaultTemplate = templates.find((template) => template.isDefault) ?? null;
  const visibleRecordIds = filteredRecords.map((record) => record.id);
  const selectedVisibleCount = visibleRecordIds.filter((id) => selectedRecordIds.includes(id)).length;
  const allVisibleSelected = visibleRecordIds.length > 0 && selectedVisibleCount === visibleRecordIds.length;
  const partiallySelected = selectedVisibleCount > 0 && !allVisibleSelected;
  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    if (!templateMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!templateMenuRef.current?.contains(event.target as Node)) {
        setTemplateMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [templateMenuOpen]);

  useEffect(() => {
    if (selectedRecord) {
      setEditorMode("record");
      setTitleDraft(selectedRecord.title);
      setContentDraft(selectedRecord.content);
      setRecordTemplateId(selectedRecord.templateId);
      setEditorError(null);
      return;
    }

    setTitleDraft("");
    setContentDraft(defaultTemplate?.content ?? "");
    setRecordTemplateId(defaultTemplate?.id ?? null);
    setEditorError(null);
  }, [defaultTemplate, selectedRecord]);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateTitleDraft(selectedTemplate.title);
      setTemplateContentDraft(selectedTemplate.content);
      setTemplateDefaultDraft(selectedTemplate.isDefault);
      if (editorMode === "template") {
        setTitleDraft(selectedTemplate.title);
        setContentDraft(selectedTemplate.content);
      }
      return;
    }

    setTemplateTitleDraft("");
    setTemplateContentDraft("");
    setTemplateDefaultDraft(false);
  }, [editorMode, selectedTemplate]);

  function handleSearchSubmit() {
    setSearchKeyword(searchDraft.trim());
  }

  function showLoginRequiredNotice() {
    setPageNotice("请先登录或注册");
  }

  function showPageNotice(message: string) {
    setPageNotice(message);
  }

  function toggleRecordSelection(recordId: number, checked: boolean) {
    setSelectedRecordIds((currentIds) => (checked ? [...new Set([...currentIds, recordId])] : currentIds.filter((id) => id !== recordId)));
  }

  function handleToggleSelectAll(checked: boolean) {
    setSelectedRecordIds((currentIds) =>
      checked ? [...new Set([...currentIds, ...visibleRecordIds])] : currentIds.filter((id) => !visibleRecordIds.includes(id)),
    );
  }

  function handleImportTemplateIntoEditor(template: TemplateItem) {
    // 导入模板并不请求后端，只是把已加载的模板内容写进编辑器草稿。
    setEditorMode("record");
    const isCreatingRecord = editorMode === "record" && selectedRecord === null;
    const nextContent = isCreatingRecord
      ? [contentDraft.trimEnd(), template.content.trim()].filter(Boolean).join("\n\n")
      : template.content;

    setEditorMode("record");
    setSelectedRecordId(null);
    if (!isCreatingRecord) {
      setTitleDraft("");
    }
    setContentDraft(nextContent);
    setRecordTemplateId(template.id);
    setEditorError(null);
    setTemplateTriggerLabel(template.isDefault ? `${template.title}（默认）` : template.title);
    setTemplateMenuOpen(false);
  }

  function handleSelectRecord(recordId: number) {
    setEditorMode("record");
    setSelectedRecordId(recordId);
    setSelectedTemplateId(null);
    setCreatingTemplate(false);
  }

  function handleSelectTemplate(templateId: number) {
    setEditorMode("template");
    setCreatingTemplate(false);
    setSelectedRecordId(null);
    setSelectedTemplateId(templateId);
  }

  function requestTitleFocus() {
    setTitleFocusSignal((current) => current + 1);
  }

  function isEditingExistingRecord() {
    return editorMode === "record" && selectedRecord !== null;
  }

  function isEditingExistingTemplate() {
    return editorMode === "template" && selectedTemplate !== null && !creatingTemplate;
  }

  function hasRecordChanges() {
    if (!selectedRecord) {
      return false;
    }

    return titleDraft !== selectedRecord.title || contentDraft !== selectedRecord.content;
  }

  function hasTemplateChanges() {
    if (!selectedTemplate) {
      return false;
    }

    return templateTitleDraft !== selectedTemplate.title || templateContentDraft !== selectedTemplate.content;
  }

  function hasRecordDraftText() {
    return editorMode === "record" && selectedRecord === null && (titleDraft.trim().length > 0 || contentDraft.trim().length > 0);
  }

  function hasTemplateDraftText() {
    return (
      editorMode === "template" &&
      (creatingTemplate || selectedTemplate === null) &&
      (templateTitleDraft.trim().length > 0 || templateContentDraft.trim().length > 0)
    );
  }

  function openNewRecordEditor() {
    setEditorMode("record");
    setSelectedRecordId(null);
    setSelectedTemplateId(null);
    setEditorError(null);
    setTitleDraft("");
    setContentDraft(defaultTemplate?.content ?? "");
    setRecordTemplateId(defaultTemplate?.id ?? null);
    setTemplateTriggerLabel("导入模板");
    setTemplateMenuOpen(false);
    if (!defaultTemplate?.content.trim()) {
      requestTitleFocus();
    }
  }

  function openNewTemplateEditor() {
    setEditorMode("template");
    setCreatingTemplate(true);
    setSelectedRecordId(null);
    setSelectedRecordIds([]);
    setSelectedTemplateId(null);
    setTemplateTitleDraft("");
    setTemplateContentDraft("");
    setTemplateDefaultDraft(false);
    setTemplateError(null);
    setTitleDraft("");
    setContentDraft("");
    setTemplateTriggerLabel("导入模板");
    setTemplateMenuOpen(false);
    requestTitleFocus();
  }

  async function handleNewRecord() {
    if (isEditingExistingRecord() && hasRecordChanges()) {
      const shouldSave = await confirm({
        message: "是否更新该记录？",
        confirmLabel: "保存",
        cancelLabel: "舍弃",
      });
      if (shouldSave) {
        const saved = await handleSaveRecord();
        if (!saved) {
          return false;
        }
      }
    } else if (hasRecordDraftText()) {
      const shouldDiscard = await confirm({
        message: "正在编辑记录，需要保留该记录吗？",
        confirmLabel: "舍弃",
        cancelLabel: "保留",
      });
      if (!shouldDiscard) {
        return false;
      }
    } else if (isEditingExistingTemplate() && hasTemplateChanges()) {
      const shouldSave = await confirm({
        message: "是否更新该模板？",
        confirmLabel: "保存",
        cancelLabel: "舍弃",
      });
      if (shouldSave) {
        const saved = await handleSaveTemplate();
        if (!saved) {
          return false;
        }
      }
    } else if (hasTemplateDraftText()) {
      const shouldDiscard = await confirm({
        message: "正在编辑模板，需要保留该模板吗？",
        confirmLabel: "舍弃",
        cancelLabel: "保留",
      });
      if (!shouldDiscard) {
        return false;
      }
    }

    openNewRecordEditor();
    return true;
  }

  async function handleNewTemplate() {
    if (isEditingExistingTemplate() && hasTemplateChanges()) {
      const shouldSave = await confirm({
        message: "是否更新该模板？",
        confirmLabel: "保存",
        cancelLabel: "舍弃",
      });
      if (shouldSave) {
        const saved = await handleSaveTemplate();
        if (!saved) {
          return false;
        }
      }
    } else if (hasTemplateDraftText()) {
      const shouldDiscard = await confirm({
        message: "正在编辑模板，需要保留该模板吗？",
        confirmLabel: "舍弃",
        cancelLabel: "保留",
      });
      if (!shouldDiscard) {
        return false;
      }
    } else if (isEditingExistingRecord() && hasRecordChanges()) {
      const shouldSave = await confirm({
        message: "是否更新该记录？",
        confirmLabel: "保存",
        cancelLabel: "舍弃",
      });
      if (shouldSave) {
        const saved = await handleSaveRecord();
        if (!saved) {
          return false;
        }
      }
    } else if (hasRecordDraftText()) {
      const shouldDiscard = await confirm({
        message: "正在编辑记录，需要保留该记录吗？",
        confirmLabel: "舍弃",
        cancelLabel: "保留",
      });
      if (!shouldDiscard) {
        return false;
      }
    }

    openNewTemplateEditor();
    return true;
  }

  async function handleSaveRecord() {
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return false;
    }

    const nextTitle = titleDraft.trim();
    const nextContent = contentDraft.trim();
    if (!nextTitle) {
      setEditorError("请输入记录标题");
      return false;
    }
    if (!nextContent) {
      setEditorError("请输入记录内容");
      return false;
    }

    setSavingRecord(true);
    setEditorError(null);
    try {
      // 一个编辑器同时承担新建和编辑，是否已有 selectedRecord 决定调用哪个接口。
      const nextRecord = selectedRecord
        ? await updateRecord(session.accessToken, selectedRecord.id, {
            title: nextTitle,
            content: nextContent,
            templateId: recordTemplateId,
          })
        : await createRecord(session.accessToken, {
            title: nextTitle,
            content: nextContent,
            templateId: recordTemplateId,
          });
      setRecords((currentRecords) =>
        selectedRecord ? currentRecords.map((record) => (record.id === nextRecord.id ? nextRecord : record)) : [nextRecord, ...currentRecords],
      );
      setSelectedRecordId(nextRecord.id);
      return true;
    } catch (saveError) {
      setEditorError(saveError instanceof Error ? saveError.message : "保存记录失败");
      return false;
    } finally {
      setSavingRecord(false);
    }
  }

  async function handleDeleteRecord() {
    if (!selectedRecord) {
      return;
    }
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return;
    }

    const confirmed = await confirm({ message: "确认删除当前记录吗  此操作不可撤销" });
    if (!confirmed) {
      return;
    }

    setDeletingRecord(true);
    setEditorError(null);
    try {
      await deleteRecord(session.accessToken, selectedRecord.id);
      setRecords((currentRecords) => {
        const nextRecords = currentRecords.filter((record) => record.id !== selectedRecord.id);
        setSelectedRecordId(nextRecords[0]?.id ?? null);
        return nextRecords;
      });
      setSelectedRecordIds((currentIds) => currentIds.filter((id) => id !== selectedRecord.id));
    } catch (deleteError) {
      setEditorError(deleteError instanceof Error ? deleteError.message : "删除记录失败");
    } finally {
      setDeletingRecord(false);
    }
  }

  async function handleDeleteSelectedRecords() {
    if (!selectedRecordIds.length) {
      return;
    }
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return;
    }

    const idsToDelete = [...selectedRecordIds];
    const confirmed = await confirm({
      message:
        selectedVisibleCount === filteredRecords.length
          ? `确认删除当前列表全部 ${idsToDelete.length} 条记录吗  此操作不可撤销`
          : `确认删除选中的 ${idsToDelete.length} 条记录吗  此操作不可撤销`,
    });
    if (!confirmed) {
      return;
    }

    setDeletingSelected(true);
    setEditorError(null);
    try {
      // 当前批量删除是前端并发调用多个单条删除接口，而不是后端批量接口。
      await Promise.all(idsToDelete.map((recordId) => deleteRecord(session.accessToken, recordId)));
      setRecords((currentRecords) => currentRecords.filter((record) => !idsToDelete.includes(record.id)));
      setSelectedRecordIds([]);
      if (selectedRecordId && idsToDelete.includes(selectedRecordId)) {
        const nextRecord = records.find((record) => !idsToDelete.includes(record.id));
        setSelectedRecordId(nextRecord?.id ?? null);
      }
    } catch (deleteError) {
      setEditorError(deleteError instanceof Error ? deleteError.message : "批量删除失败");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handleSaveTemplate() {
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return false;
    }

    const nextTitle = templateTitleDraft.trim() || selectedTemplate?.title || "";
    const nextContent = templateContentDraft.trim();
    if (!nextTitle) {
      setTemplateError("请输入模板标题");
      return false;
    }
    if (!nextContent) {
      setTemplateError("请输入模板内容");
      return false;
    }

    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const nextTemplate =
        creatingTemplate || !selectedTemplate
          ? await createTemplate(session.accessToken, { title: nextTitle, content: nextContent, is_default: templateDefaultDraft })
          : await updateTemplate(session.accessToken, selectedTemplate.id, {
              title: nextTitle,
              content: nextContent,
              is_default: templateDefaultDraft,
            });
      setTemplates((currentTemplates) => {
        const withoutCurrent = currentTemplates
          .filter((template) => template.id !== nextTemplate.id)
          .map((template) => (nextTemplate.isDefault ? { ...template, isDefault: false } : template));
        return sortTemplates([nextTemplate, ...withoutCurrent]);
      });
      setSelectedTemplateId(nextTemplate.id);
      setCreatingTemplate(false);
      setTitleDraft(nextTemplate.title);
      setContentDraft(nextTemplate.content);
      return true;
    } catch (saveError) {
      setTemplateError(saveError instanceof Error ? saveError.message : "保存模板失败");
      return false;
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSaveTemplateAsDefault() {
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return;
    }

    const nextTitle = templateTitleDraft.trim() || selectedTemplate?.title || "";
    const nextContent = templateContentDraft.trim();
    if (!nextTitle) {
      setTemplateError("请输入模板标题");
      return;
    }
    if (!nextContent) {
      setTemplateError("请输入模板内容");
      return;
    }

    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const nextTemplate =
        creatingTemplate || !selectedTemplate
          ? await createTemplate(session.accessToken, { title: nextTitle, content: nextContent, is_default: true })
          : await updateTemplate(session.accessToken, selectedTemplate.id, {
              title: nextTitle,
              content: nextContent,
              is_default: true,
            });
      setTemplates((currentTemplates) => {
        const withoutCurrent = currentTemplates
          .filter((template) => template.id !== nextTemplate.id)
          .map((template) => ({ ...template, isDefault: false }));
        return sortTemplates([nextTemplate, ...withoutCurrent]);
      });
      setSelectedTemplateId(nextTemplate.id);
      setCreatingTemplate(false);
      setTitleDraft(nextTemplate.title);
      setContentDraft(nextTemplate.content);
      setTemplateTitleDraft(nextTemplate.title);
      setTemplateContentDraft(nextTemplate.content);
      setTemplateDefaultDraft(true);
    } catch (saveError) {
      setTemplateError(saveError instanceof Error ? saveError.message : "保存模板失败");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleCancelDefaultTemplate() {
    if (!selectedTemplate || !selectedTemplate.isDefault) {
      return;
    }
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return;
    }

    const nextTitle = templateTitleDraft.trim() || selectedTemplate.title;
    const nextContent = templateContentDraft.trim();
    if (!nextTitle) {
      setTemplateError("请输入模板标题");
      return;
    }
    if (!nextContent) {
      setTemplateError("请输入模板内容");
      return;
    }

    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const nextTemplate = await updateTemplate(session.accessToken, selectedTemplate.id, {
        title: nextTitle,
        content: nextContent,
        is_default: false,
      });
      setTemplates((currentTemplates) =>
        sortTemplates(currentTemplates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template))),
      );
      setSelectedTemplateId(nextTemplate.id);
      setCreatingTemplate(false);
      setTitleDraft(nextTemplate.title);
      setContentDraft(nextTemplate.content);
      setTemplateTitleDraft(nextTemplate.title);
      setTemplateContentDraft(nextTemplate.content);
      setTemplateDefaultDraft(false);
    } catch (saveError) {
      setTemplateError(saveError instanceof Error ? saveError.message : "取消默认模板失败");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplate) {
      return;
    }
    if (isDemoMode || !session?.accessToken) {
      showLoginRequiredNotice();
      return;
    }

    const confirmed = await confirm({ message: "确认删除当前模板吗  此操作不可撤销" });
    if (!confirmed) {
      return;
    }

    setDeletingTemplate(true);
    setTemplateError(null);
    try {
      await deleteTemplate(session.accessToken, selectedTemplate.id);
      setTemplates((currentTemplates) => {
        const nextTemplates = sortTemplates(currentTemplates.filter((template) => template.id !== selectedTemplate.id));
        setSelectedTemplateId(null);
        return nextTemplates;
      });
      setCreatingTemplate(false);
      setEditorMode("record");
      setSelectedRecordId(null);
      setTitleDraft("");
      setContentDraft(defaultTemplate?.content ?? "");
      setRecordTemplateId(defaultTemplate?.id ?? null);
      setTemplateTriggerLabel("导入模板");
      setTemplateMenuOpen(false);
    } catch (deleteError) {
      setTemplateError(deleteError instanceof Error ? deleteError.message : "删除模板失败");
    } finally {
      setDeletingTemplate(false);
    }
  }

  const showTemplateToolbar = editorMode === "record" && !selectedRecord;
  // 底部状态区同时承担提示文案和错误展示，避免页面出现多个碎片化提示区域。
  const editorStatusText =
    editorMode === "template"
      ? creatingTemplate
        ? "当前为新增模板"
        : selectedTemplate?.isDefault
          ? "当前为默认模板"
          : "当前为模板编辑"
      : selectedRecord
        ? "当前为记录编辑"
        : templateTriggerLabel === "导入模板"
          ? "当前为新增记录"
          : `已导入模板内容 ${templateTriggerLabel}`;
  const footerStatusText = editorMode === "template" ? templateError ?? editorStatusText : editorError ?? editorStatusText;

  return {
    records,
    templates,
    recordsLoading,
    templatesLoading,
    error,
    templateError,
    editorError,
    selectedRecordId,
    selectedTemplateId,
    selectedRecordIds,
    searchDraft,
    titleDraft,
    contentDraft,
    recordTemplateId,
    editorMode,
    templateTitleDraft,
    templateContentDraft,
    templateDefaultDraft,
    savingRecord,
    savingTemplate,
    deletingRecord,
    creatingTemplate,
    deletingTemplate,
    deletingSelected,
    importNotice,
    pageNotice,
    templateMenuOpen,
    templateTriggerLabel,
    titleFocusSignal,
    selectAllRef,
    templateMenuRef,
    isDemoMode,
    filteredRecords,
    selectedRecord,
    selectedTemplate,
    defaultTemplate,
    selectedVisibleCount,
    allVisibleSelected,
    showTemplateToolbar,
    footerStatusText,
    setSearchDraft,
    setTitleDraft,
    setContentDraft,
    setTemplateTitleDraft,
    setTemplateContentDraft,
    setTemplateMenuOpen,
    handleSearchSubmit,
    toggleRecordSelection,
    handleToggleSelectAll,
    handleSelectRecord,
    handleSelectTemplate,
    handleImportTemplateIntoEditor,
    handleSaveRecord,
    handleDeleteRecord,
    handleDeleteSelectedRecords,
    handleSaveTemplate,
    handleSaveTemplateAsDefault,
    handleCancelDefaultTemplate,
    handleDeleteTemplate,
    handleNewRecord,
    handleNewTemplate,
  };
}
