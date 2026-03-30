import type { TemplateItem } from "../../entities/template/types";
import { formatDate } from "./record-workspace-utils";

type TemplateSidebarProps = {
  currentUserName?: string;
  isCollapsed: boolean;
  newButtonPressed: boolean;
  onNewTemplatePressStart: () => void;
  onNewTemplate: () => void;
  onSelectTemplate: (templateId: number) => void;
  onToggleCollapsed: () => void;
  selectedTemplateId: number | null;
  templateError: string | null;
  templates: TemplateItem[];
  templatesLoading: boolean;
};

export function TemplateSidebar({
  currentUserName,
  isCollapsed,
  newButtonPressed,
  onNewTemplatePressStart,
  onNewTemplate,
  onSelectTemplate,
  onToggleCollapsed,
  selectedTemplateId,
  templateError,
  templates,
  templatesLoading,
}: TemplateSidebarProps) {
  return (
    <aside className={isCollapsed ? "template-sidebar-shell template-sidebar-shell--collapsed" : "template-sidebar-shell"}>
      <button
        aria-controls="template-sidebar-panel"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "\u5c55\u5f00\u6a21\u677f\u5217\u8868" : "\u6536\u8d77\u6a21\u677f\u5217\u8868"}
        className="template-sidebar-shell__toggle"
        onClick={onToggleCollapsed}
        type="button"
      >
        {" "}
        {isCollapsed ? "\u2304" : "\u2303"}
      </button>
      <div className="template-sidebar-shell__inner" id="template-sidebar-panel">
        <div className="record-sidebar__header">
          <div>
            <h2 className="record-sidebar__title">{"\u6a21\u677f\u5217\u8868"}</h2>
          </div>
          <div className="sidebar-header-actions">
            <button
              className={newButtonPressed ? "shell__nav-button shell__nav-button--pressed" : "shell__nav-button"}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onNewTemplatePressStart();
                }
              }}
              onClick={onNewTemplate}
              onPointerDown={onNewTemplatePressStart}
              type="button"
            >
              {"\u65b0\u589e"}
            </button>
          </div>
        </div>

        {templateError ? <p className="auth-form__error">{templateError}</p> : null}
        {!templateError && !templates.length && !templatesLoading ? (
          <p className="panel__hint">{currentUserName ? "\u5f53\u524d\u6ca1\u6709\u6a21\u677f" : "Demo \u6a21\u5f0f\u6682\u65f6\u6ca1\u6709\u793a\u4f8b\u6a21\u677f"}</p>
        ) : null}

        <ul className="template-sidebar-shell__list" role="list">
          {templates.map((template) => {
            const active = template.id === selectedTemplateId;
            const title = template.isDefault ? `${template.title}\uff08\u9ed8\u8ba4\uff09` : template.title;

            return (
              <li key={template.id}>
                <button
                  className={active ? "template-list-card template-list-card--active" : "template-list-card"}
                  onClick={() => onSelectTemplate(template.id)}
                  type="button"
                >
                  <span className="template-list-card__title">{title}</span>
                  <small className="template-list-card__time">{formatDate(template.updatedAt)}</small>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="record-sidebar__footer">
          <span className="record-sidebar__count">{templatesLoading ? "\u52a0\u8f7d\u4e2d" : `${templates.length} \u6761`}</span>
        </div>
      </div>
    </aside>
  );
}
