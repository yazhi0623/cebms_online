import type { TemplateItem } from "../../entities/template/types";
import { formatDate } from "./record-workspace-utils";

type TemplateSidebarProps = {
  currentUserName?: string;
  isCollapsed: boolean;
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
        aria-label={isCollapsed ? "展开模板列表" : "收起模板列表"}
        className="template-sidebar-shell__toggle"
        onClick={onToggleCollapsed}
        type="button"
      >
        {/* 侧边栏始终挂载，只切换折叠态，避免模板列表状态被重置。 */}
        {isCollapsed ? "‹" : "›"}
      </button>
      <div className="template-sidebar-shell__inner" id="template-sidebar-panel">
        <div className="record-sidebar__header">
          <div>
            <h2 className="record-sidebar__title">模板列表</h2>
          </div>
          <div className="sidebar-header-actions">
            <button className="shell__nav-button" onClick={onNewTemplate} type="button">
              新增
            </button>
          </div>
        </div>

        {templateError ? <p className="auth-form__error">{templateError}</p> : null}
        {!templateError && !templates.length && !templatesLoading ? (
          <p className="panel__hint">{currentUserName ? "当前没有模板" : "Demo 模式暂时没有示例模板"}</p>
        ) : null}

        <ul className="template-sidebar-shell__list" role="list">
          {templates.map((template) => {
            const active = template.id === selectedTemplateId;
            const title = template.isDefault ? `${template.title}（默认）` : template.title;

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
          <span className="record-sidebar__count">{templatesLoading ? "加载中" : `${templates.length} 条`}</span>
        </div>
      </div>
    </aside>
  );
}
