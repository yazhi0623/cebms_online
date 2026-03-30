import type { MutableRefObject } from "react";

import type { RecordItem } from "../../entities/record/types";
import { formatCreatedUpdatedTime } from "./record-workspace-utils";

type RecordSidebarProps = {
  allVisibleSelected: boolean;
  currentUserName?: string;
  deletingSelected: boolean;
  error: string | null;
  filteredRecords: RecordItem[];
  isDemoMode: boolean;
  newButtonPressed: boolean;
  onNewRecordPressStart: () => void;
  onNewRecord: () => void;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSelectRecord: (recordId: number) => void;
  onToggleRecordSelection: (recordId: number, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onDeleteSelected: () => void;
  records: RecordItem[];
  recordsLoading: boolean;
  searchDraft: string;
  selectedRecordId: number | null;
  selectedRecordIds: number[];
  selectAllRef: MutableRefObject<HTMLInputElement | null>;
};

export function RecordSidebar({
  allVisibleSelected,
  currentUserName,
  deletingSelected,
  error,
  filteredRecords,
  isDemoMode,
  newButtonPressed,
  onNewRecordPressStart,
  onDeleteSelected,
  onNewRecord,
  onSearchDraftChange,
  onSearchSubmit,
  onSelectRecord,
  onToggleRecordSelection,
  onToggleSelectAll,
  records,
  recordsLoading,
  searchDraft,
  selectedRecordId,
  selectedRecordIds,
  selectAllRef,
}: RecordSidebarProps) {
  return (
    <aside className="record-sidebar">
      <div className="record-sidebar__header">
        <div>
          <h2 className="record-sidebar__title">记录列表</h2>
        </div>
        <div className="sidebar-header-actions">
          <button
            className={newButtonPressed ? "shell__nav-button shell__nav-button--pressed" : "shell__nav-button"}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                onNewRecordPressStart();
              }
            }}
            onClick={onNewRecord}
            onPointerDown={onNewRecordPressStart}
            type="button"
          >
            新增
          </button>
        </div>
      </div>

      <div className="record-toolbar">
        <div className="record-search-bar">
          <input
            onChange={(event) => onSearchDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearchSubmit();
              }
            }}
            placeholder="按标题或内容搜索"
            type="text"
            value={searchDraft}
          />
          <button aria-label="搜索记录" className="record-search-button" onClick={onSearchSubmit} type="button">
            <span aria-hidden="true" className="record-search-button__icon" />
          </button>
        </div>
        {!isDemoMode && filteredRecords.length > 0 ? (
          <div className="record-batch-toolbar">
            <label className="record-batch-check">
              <input
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
                ref={selectAllRef}
                type="checkbox"
              />
              <span>全选</span>
            </label>
            <button
              className="record-batch-link"
              disabled={!selectedRecordIds.length || deletingSelected}
              hidden={!selectedRecordIds.length}
              onClick={onDeleteSelected}
              type="button"
            >
              {/* 批量删除期间锁住按钮，避免重复提交同一批记录。 */}
              {deletingSelected ? "删除中" : "批量删除"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="auth-form__error">{error}</p> : null}

      <ul className="record-sidebar__list record-sidebar__list--legacy" role="list">
        {!error && !filteredRecords.length && !recordsLoading ? (
          <p className="panel__hint">{currentUserName ? "没有匹配的记录" : "Demo 模式暂时没有匹配的示例记录"}</p>
        ) : null}
        {filteredRecords.map((record) => {
          const active = record.id === selectedRecordId;
          const checked = selectedRecordIds.includes(record.id);

          return (
            <li key={record.id} className="record-list-row">
              <label className="record-card__check" onClick={(event) => event.stopPropagation()}>
                <input checked={checked} onChange={(event) => onToggleRecordSelection(record.id, event.target.checked)} type="checkbox" />
              </label>
              <button
                className={active ? "record-list-card record-list-card--active" : "record-list-card"}
                onClick={() => onSelectRecord(record.id)}
                type="button"
              >
                <span className="record-list-card__title">{record.title || "未命名记录"}</span>
                <small className="record-list-card__time">{formatCreatedUpdatedTime(record.createdAt, record.updatedAt)}</small>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="record-sidebar__footer">
        <span className="record-sidebar__count">{recordsLoading ? "加载中" : `${filteredRecords.length} / ${records.length} 条`}</span>
      </div>
    </aside>
  );
}
