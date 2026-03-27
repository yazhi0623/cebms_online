import { useLayoutEffect, useRef, useState, type MutableRefObject } from "react";

import type { TemplateItem } from "../../entities/template/types";

type RecordEditorProps = {
  contentDraft: string;
  creatingTemplate: boolean;
  deletingRecord: boolean;
  deletingTemplate: boolean;
  editorError: string | null;
  editorMode: "record" | "template";
  footerStatusText: string;
  importNotice: string | null;
  isDemoMode: boolean;
  pageNotice: string | null;
  savingRecord: boolean;
  savingTemplate: boolean;
  selectedRecord: { id: number } | null;
  selectedTemplate: { id: number } | null;
  showTemplateToolbar: boolean;
  templateContentDraft: string;
  templateDefaultDraft: boolean;
  templateError: string | null;
  templateMenuOpen: boolean;
  templateMenuRef: MutableRefObject<HTMLDivElement | null>;
  templateTitleDraft: string;
  templateTriggerLabel: string;
  templates: TemplateItem[];
  titleDraft: string;
  onContentDraftChange: (value: string) => void;
  onDeleteRecord: () => void;
  onDeleteTemplate: () => void;
  onImportTemplate: (template: TemplateItem) => void;
  onSaveRecord: () => void;
  onSaveTemplate: () => void;
  onCancelDefaultTemplate: () => void;
  onSaveTemplateAsDefault: () => void;
  onTemplateContentDraftChange: (value: string) => void;
  onTemplateTitleDraftChange: (value: string) => void;
  onTitleDraftChange: (value: string) => void;
  onToggleTemplateMenu: () => void;
};

export function RecordEditor({
  contentDraft,
  creatingTemplate,
  deletingRecord,
  deletingTemplate,
  editorError,
  editorMode,
  footerStatusText,
  importNotice,
  isDemoMode,
  pageNotice,
  savingRecord,
  savingTemplate,
  selectedRecord,
  selectedTemplate,
  showTemplateToolbar,
  templateContentDraft,
  templateDefaultDraft,
  templateError,
  templateMenuOpen,
  templateMenuRef,
  templateTitleDraft,
  templateTriggerLabel,
  templates,
  titleDraft,
  onContentDraftChange,
  onDeleteRecord,
  onDeleteTemplate,
  onImportTemplate,
  onSaveRecord,
  onSaveTemplate,
  onCancelDefaultTemplate,
  onSaveTemplateAsDefault,
  onTemplateContentDraftChange,
  onTemplateTitleDraftChange,
  onTitleDraftChange,
  onToggleTemplateMenu,
}: RecordEditorProps) {
  // 下拉按钮宽度根据真实文本宽度计算，避免中文标题在 `ch` 估算下出现对齐偏差。
  const hasError = (editorMode === "template" && templateError) || (editorMode === "record" && editorError);
  const templateTriggerRef = useRef<HTMLButtonElement | null>(null);
  const templateOptionsRef = useRef<HTMLDivElement | null>(null);
  const [templateSelectWidth, setTemplateSelectWidth] = useState(156);
  const [templateMenuDirection, setTemplateMenuDirection] = useState<"down" | "up">("down");
  const [templateMenuMaxHeight, setTemplateMenuMaxHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!templateTriggerRef.current) {
      return;
    }

    const labels = [templateTriggerLabel, ...templates.map((template) => (template.isDefault ? `${template.title}（默认）` : template.title))];
    const computedStyle = window.getComputedStyle(templateTriggerRef.current);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.font = [
      computedStyle.fontStyle,
      computedStyle.fontVariant,
      computedStyle.fontWeight,
      computedStyle.fontSize,
      computedStyle.fontFamily,
    ].join(" ");

    const widestLabel = labels.reduce((maxWidth, label) => Math.max(maxWidth, context.measureText(label).width), 0);
    const nextWidth = Math.min(Math.max(Math.ceil(widestLabel + 54), 156), 320);
    setTemplateSelectWidth(nextWidth);
  }, [templateTriggerLabel, templates]);

  useLayoutEffect(() => {
    if (!templateMenuOpen || !templateTriggerRef.current || !templateOptionsRef.current) {
      return;
    }

    const triggerRect = templateTriggerRef.current.getBoundingClientRect();
    const menuHeight = templateOptionsRef.current.offsetHeight;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - triggerRect.bottom - 12;
    const spaceAbove = triggerRect.top - 12;
    const shouldOpenUp = spaceBelow < Math.min(menuHeight, 260) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, Math.floor((shouldOpenUp ? spaceAbove : spaceBelow) - 4));

    setTemplateMenuDirection(shouldOpenUp ? "up" : "down");
    setTemplateMenuMaxHeight(Math.min(260, availableHeight));
  }, [templateMenuOpen, templates.length]);

  return (
    <section className="record-editor-shell">
      {importNotice ? (
        <div className="record-import-toast" role="status" aria-live="polite">
          <span>{importNotice}</span>
        </div>
      ) : null}
      {pageNotice ? (
        <div className="record-import-toast" role="status" aria-live="polite">
          <span>{pageNotice}</span>
        </div>
      ) : null}

      <div className="editor-form">
        <div className="editor-head">
          <label className="editor-title-row">
            <span>标题</span>
            <input
              onChange={(event) =>
                editorMode === "template"
                  ? onTemplateTitleDraftChange(event.target.value)
                  : onTitleDraftChange(event.target.value)
              }
              placeholder={editorMode === "template" ? "请输入模板标题" : "请输入记录标题"}
              value={editorMode === "template" ? templateTitleDraft : titleDraft}
            />
          </label>
        </div>

        {showTemplateToolbar ? (
          <div className="template-toolbar template-toolbar--inline">
            <div className="template-select-wrap" ref={templateMenuRef} style={{ width: `${templateSelectWidth}px` }}>
              <button
                aria-expanded={templateMenuOpen}
                aria-haspopup="listbox"
                className="template-select-trigger"
                disabled={isDemoMode || templates.length === 0}
                onClick={onToggleTemplateMenu}
                ref={templateTriggerRef}
                style={{ width: `${templateSelectWidth}px` }}
                type="button"
              >
                <span className="template-select-trigger__label">{templateTriggerLabel}</span>
                <span
                  aria-hidden="true"
                  className={templateMenuOpen ? "template-select-trigger__caret template-select-trigger__caret--open" : "template-select-trigger__caret"}
                />
              </button>
              {templateMenuOpen ? (
                <div
                  className={`template-select-menu${templateMenuDirection === "up" ? " template-select-menu--up" : ""}`}
                  ref={templateOptionsRef}
                  role="listbox"
                  style={templateMenuMaxHeight ? { maxHeight: `${templateMenuMaxHeight}px` } : undefined}
                >
                  {templates.map((template) => {
                    const title = template.isDefault ? `${template.title}（默认）` : template.title;

                    return (
                      <button
                        className="template-select-option"
                        key={template.id}
                        onClick={() => onImportTemplate(template)}
                        role="option"
                        title={title}
                        type="button"
                      >
                        {title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <label className="editor-form__field editor-form__field--content editor-form__field--legacy-content">
          <textarea
            onChange={(event) =>
              editorMode === "template"
                ? onTemplateContentDraftChange(event.target.value)
                : onContentDraftChange(event.target.value)
            }
            placeholder={editorMode === "template" ? "请输入模板内容" : "自由记录当天的想法、事件、情绪和行为"}
            value={editorMode === "template" ? templateContentDraft : contentDraft}
          />
        </label>

        <div className="editor-footer">
          <p className={hasError ? "auth-form__error editor-footer__status" : "editor-footer__status"}>{footerStatusText}</p>
          <div className="editor-footer__actions">
            {(selectedRecord || (editorMode === "template" && selectedTemplate && !creatingTemplate)) ? (
              <button
                className="shell__nav-button"
                disabled={editorMode === "template" ? deletingTemplate : deletingRecord}
                onClick={editorMode === "template" ? onDeleteTemplate : onDeleteRecord}
                type="button"
              >
                {editorMode === "template" ? (deletingTemplate ? "删除中" : "删除") : deletingRecord ? "删除中" : "删除"}
              </button>
            ) : null}
            {editorMode === "template" && !templateDefaultDraft ? (
              <button
                className="shell__nav-button"
                disabled={savingTemplate}
                onClick={onSaveTemplateAsDefault}
                type="button"
              >
                保存为默认模板
              </button>
            ) : null}
            {editorMode === "template" && templateDefaultDraft && selectedTemplate && !creatingTemplate ? (
              <button
                className="shell__nav-button"
                disabled={savingTemplate}
                onClick={onCancelDefaultTemplate}
                type="button"
              >
                取消默认模板
              </button>
            ) : null}
            <button
              className="shell__nav-button shell__nav-button--active"
              disabled={editorMode === "template" ? savingTemplate : savingRecord}
              onClick={editorMode === "template" ? onSaveTemplate : onSaveRecord}
              type="button"
            >
              {editorMode === "template" ? (savingTemplate ? "保存中" : "保存模板") : savingRecord ? "保存中" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
