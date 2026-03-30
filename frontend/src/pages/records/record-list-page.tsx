import { useEffect, useState } from "react";

import { useAuth } from "../../shared/hooks/use-auth";
import { useNavigation } from "../../shared/hooks/use-navigation";
import { RecordEditor } from "./record-editor";
import { RecordSidebar } from "./record-sidebar";
import { TemplateSidebar } from "./template-sidebar";
import { useRecordWorkspace } from "./use-record-workspace";

export function RecordListPage() {
  const { currentUser } = useAuth();
  const { setBlocker } = useNavigation();
  const workspace = useRecordWorkspace();
  const [templateSidebarCollapsed, setTemplateSidebarCollapsed] = useState(true);
  const [compactLayout, setCompactLayout] = useState(false);
  const [compactPanel, setCompactPanel] = useState<"records" | "templates" | null>(null);
  const [recordNewButtonPressed, setRecordNewButtonPressed] = useState(false);
  const [templateNewButtonPressed, setTemplateNewButtonPressed] = useState(false);

  useEffect(() => {
    const compactMediaQuery = window.matchMedia("(orientation: portrait), (max-width: 1180px)");

    function syncLayoutState(event?: MediaQueryListEvent) {
      const isCompact = event?.matches ?? compactMediaQuery.matches;
      setCompactLayout(isCompact);
      setCompactPanel(null);
      setTemplateSidebarCollapsed(isCompact ? false : true);
    }

    syncLayoutState();
    compactMediaQuery.addEventListener("change", syncLayoutState);

    return () => {
      compactMediaQuery.removeEventListener("change", syncLayoutState);
    };
  }, []);

  useEffect(() => {
    setBlocker((path) => workspace.handleProtectedNavigation(path));
    return () => {
      setBlocker(null);
    };
  }, [setBlocker, workspace]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!workspace.hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [workspace.hasUnsavedChanges]);

  function toggleCompactPanel(nextPanel: "records" | "templates") {
    setCompactPanel((current) => (current === nextPanel ? null : nextPanel));
  }

  function handleSelectRecord(recordId: number) {
    void workspace.handleSelectRecord(recordId).then((didSwitch) => {
      if (compactLayout && didSwitch) {
        setCompactPanel(null);
      }
    });
  }

  function handleSelectTemplate(templateId: number) {
    void workspace.handleSelectTemplate(templateId).then((didSwitch) => {
      if (compactLayout && didSwitch) {
        setCompactPanel(null);
      }
    });
  }

  function flashRecordNewButton() {
    setRecordNewButtonPressed(true);
    window.setTimeout(() => setRecordNewButtonPressed(false), 160);
  }

  function flashTemplateNewButton() {
    setTemplateNewButtonPressed(true);
    window.setTimeout(() => setTemplateNewButtonPressed(false), 160);
  }

  function handleNewRecord() {
    void workspace.handleNewRecord().then((didSwitch) => {
      if (compactLayout && didSwitch) {
        setCompactPanel(null);
      }
    });
  }

  function handleNewTemplate() {
    void workspace.handleNewTemplate().then((didSwitch) => {
      if (compactLayout && didSwitch) {
        setCompactPanel(null);
      }
    });
  }

  return (
    <div className="page-init-shell">
      {workspace.initialLoading ? (
        <div aria-live="polite" className="page-init-overlay" role="status">
          <div className="page-init-overlay__dialog">
            <div aria-hidden="true" className="page-init-overlay__spinner" />
            <strong>{"\u52a0\u8f7d\u4e2d..."}</strong>
          </div>
        </div>
      ) : null}
      <section
        className={
          compactLayout
            ? "record-workspace record-workspace--compact"
            : templateSidebarCollapsed
              ? "record-workspace"
              : "record-workspace record-workspace--template-open"
        }
      >
        {compactLayout ? (
          <div className="record-workspace__compact-switches" aria-label={"\u8bb0\u5f55\u9875\u4fa7\u680f\u5165\u53e3"}>
            <button
              aria-pressed={compactPanel === "records"}
              className={
                compactPanel === "records"
                  ? "shell__nav-button shell__nav-button--active shell__nav-button--pressable"
                  : "shell__nav-button shell__nav-button--pressable"
              }
              onClick={() => toggleCompactPanel("records")}
              type="button"
            >
              <span>{"\u8bb0\u5f55\u5217\u8868"}</span>
              <span
                aria-hidden="true"
                className={
                  compactPanel === "records"
                    ? "record-workspace__compact-switch-arrow record-workspace__compact-switch-arrow--open"
                    : "record-workspace__compact-switch-arrow"
                }
              >
                ▾
              </span>
            </button>
            <button
              aria-pressed={compactPanel === "templates"}
              className={
                compactPanel === "templates"
                  ? "shell__nav-button shell__nav-button--active shell__nav-button--pressable"
                  : "shell__nav-button shell__nav-button--pressable"
              }
              onClick={() => toggleCompactPanel("templates")}
              type="button"
            >
              <span>{"\u6a21\u677f\u5217\u8868"}</span>
              <span
                aria-hidden="true"
                className={
                  compactPanel === "templates"
                    ? "record-workspace__compact-switch-arrow record-workspace__compact-switch-arrow--open"
                    : "record-workspace__compact-switch-arrow"
                }
              >
                ▾
              </span>
            </button>
          </div>
        ) : (
          <RecordSidebar
            allVisibleSelected={workspace.allVisibleSelected}
            currentUserName={currentUser?.username}
            deletingSelected={workspace.deletingSelected}
            error={workspace.error}
            filteredRecords={workspace.filteredRecords}
            isDemoMode={workspace.isDemoMode}
            newButtonPressed={recordNewButtonPressed}
            onDeleteSelected={() => void workspace.handleDeleteSelectedRecords()}
            onNewRecord={handleNewRecord}
            onNewRecordPressStart={flashRecordNewButton}
            onSearchDraftChange={workspace.setSearchDraft}
            onSearchSubmit={workspace.handleSearchSubmit}
            onSelectRecord={handleSelectRecord}
            onToggleRecordSelection={workspace.toggleRecordSelection}
            onToggleSelectAll={workspace.handleToggleSelectAll}
            records={workspace.records}
            recordsLoading={workspace.recordsLoading}
            searchDraft={workspace.searchDraft}
            selectedRecordId={workspace.selectedRecordId}
            selectedRecordIds={workspace.selectedRecordIds}
            selectAllRef={workspace.selectAllRef}
          />
        )}

        {compactLayout && compactPanel === "records" ? (
          <div className="record-workspace__compact-panel">
            <RecordSidebar
              allVisibleSelected={workspace.allVisibleSelected}
              currentUserName={currentUser?.username}
              deletingSelected={workspace.deletingSelected}
              error={workspace.error}
              filteredRecords={workspace.filteredRecords}
              isDemoMode={workspace.isDemoMode}
              newButtonPressed={recordNewButtonPressed}
              onDeleteSelected={() => void workspace.handleDeleteSelectedRecords()}
              onNewRecord={handleNewRecord}
              onNewRecordPressStart={flashRecordNewButton}
              onSearchDraftChange={workspace.setSearchDraft}
              onSearchSubmit={workspace.handleSearchSubmit}
              onSelectRecord={handleSelectRecord}
              onToggleRecordSelection={workspace.toggleRecordSelection}
              onToggleSelectAll={workspace.handleToggleSelectAll}
              records={workspace.records}
              recordsLoading={workspace.recordsLoading}
              searchDraft={workspace.searchDraft}
              selectedRecordId={workspace.selectedRecordId}
              selectedRecordIds={workspace.selectedRecordIds}
              selectAllRef={workspace.selectAllRef}
            />
          </div>
        ) : null}

        {!compactLayout || compactPanel === null ? (
          <RecordEditor
            contentDraft={workspace.contentDraft}
            creatingTemplate={workspace.creatingTemplate}
            deletingRecord={workspace.deletingRecord}
            deletingTemplate={workspace.deletingTemplate}
            editorError={workspace.editorError}
            editorMode={workspace.editorMode}
            footerStatusText={workspace.footerStatusText}
            importNotice={workspace.importNotice}
            isDemoMode={workspace.isDemoMode}
            onCancelDefaultTemplate={() => void workspace.handleCancelDefaultTemplate()}
            onContentDraftChange={workspace.setContentDraft}
            onDeleteRecord={() => void workspace.handleDeleteRecord()}
            onDeleteTemplate={() => void workspace.handleDeleteTemplate()}
            onImportTemplate={workspace.handleImportTemplateIntoEditor}
            onSaveRecord={() => void workspace.handleSaveRecord()}
            onSaveTemplate={() => void workspace.handleSaveTemplate()}
            onSaveTemplateAsDefault={() => void workspace.handleSaveTemplateAsDefault()}
            onTemplateContentDraftChange={workspace.setTemplateContentDraft}
            onTemplateTitleDraftChange={workspace.setTemplateTitleDraft}
            onTitleDraftChange={workspace.setTitleDraft}
            onToggleTemplateMenu={() => workspace.setTemplateMenuOpen(!workspace.templateMenuOpen)}
            pageNotice={workspace.pageNotice}
            savingRecord={workspace.savingRecord}
            savingTemplate={workspace.savingTemplate}
            selectedRecord={workspace.selectedRecord}
            selectedTemplate={workspace.selectedTemplate}
            showTemplateToolbar={workspace.showTemplateToolbar}
            templateContentDraft={workspace.templateContentDraft}
            templateDefaultDraft={workspace.templateDefaultDraft}
            templateError={workspace.templateError}
            templateMenuOpen={workspace.templateMenuOpen}
            templateMenuRef={workspace.templateMenuRef}
            templateTitleDraft={workspace.templateTitleDraft}
            templateTriggerLabel={workspace.templateTriggerLabel}
            templates={workspace.templates}
            titleDraft={workspace.titleDraft}
            titleFocusSignal={workspace.titleFocusSignal}
          />
        ) : null}

        {compactLayout && compactPanel === "templates" ? (
          <div className="record-workspace__compact-panel">
            <TemplateSidebar
              currentUserName={currentUser?.username}
              isCollapsed={false}
              newButtonPressed={templateNewButtonPressed}
              onNewTemplate={handleNewTemplate}
              onNewTemplatePressStart={flashTemplateNewButton}
              onSelectTemplate={handleSelectTemplate}
              onToggleCollapsed={() => setCompactPanel(null)}
              selectedTemplateId={workspace.selectedTemplateId}
              templateError={workspace.templateSidebarError}
              templates={workspace.templates}
              templatesLoading={workspace.templatesLoading}
            />
          </div>
        ) : null}

        {!compactLayout ? (
          <TemplateSidebar
            currentUserName={currentUser?.username}
            isCollapsed={templateSidebarCollapsed}
            newButtonPressed={templateNewButtonPressed}
            onNewTemplate={handleNewTemplate}
            onNewTemplatePressStart={flashTemplateNewButton}
            onSelectTemplate={handleSelectTemplate}
            onToggleCollapsed={() => setTemplateSidebarCollapsed((current) => !current)}
            selectedTemplateId={workspace.selectedTemplateId}
            templateError={workspace.templateSidebarError}
            templates={workspace.templates}
            templatesLoading={workspace.templatesLoading}
          />
        ) : null}
      </section>
    </div>
  );
}
