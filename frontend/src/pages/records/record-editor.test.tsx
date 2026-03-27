import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TemplateItem } from "../../entities/template/types";
import { RecordEditor } from "./record-editor";

const templates: TemplateItem[] = [
  {
    id: 1,
    userId: 1,
    title: "晨间复盘模板",
    content: "模板内容 A",
    isDefault: true,
    createdAt: "2026-03-24T08:00:00Z",
    updatedAt: "2026-03-24T08:00:00Z",
  },
  {
    id: 2,
    userId: 1,
    title: "晚间记录模板",
    content: "模板内容 B",
    isDefault: false,
    createdAt: "2026-03-24T09:00:00Z",
    updatedAt: "2026-03-24T09:00:00Z",
  },
];

function buildProps(overrides: Partial<ComponentProps<typeof RecordEditor>> = {}): ComponentProps<typeof RecordEditor> {
  return {
    contentDraft: "",
    creatingTemplate: false,
    deletingRecord: false,
    deletingTemplate: false,
    editorError: null,
    editorMode: "record",
    footerStatusText: "当前为新增记录",
    importNotice: null,
    isDemoMode: false,
    pageNotice: null,
    savingRecord: false,
    savingTemplate: false,
    selectedRecord: null,
    selectedTemplate: null,
    showTemplateToolbar: true,
    templateContentDraft: "",
    templateDefaultDraft: false,
    templateError: null,
    templateMenuOpen: true,
    templateMenuRef: createRef<HTMLDivElement>(),
    templateTitleDraft: "",
    templateTriggerLabel: "导入模板",
    templates,
    titleDraft: "",
    titleFocusSignal: 0,
    onContentDraftChange: vi.fn(),
    onDeleteRecord: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onImportTemplate: vi.fn(),
    onCancelDefaultTemplate: vi.fn(),
    onSaveRecord: vi.fn(),
    onSaveTemplate: vi.fn(),
    onSaveTemplateAsDefault: vi.fn(),
    onTemplateContentDraftChange: vi.fn(),
    onTemplateTitleDraftChange: vi.fn(),
    onTitleDraftChange: vi.fn(),
    onToggleTemplateMenu: vi.fn(),
    ...overrides,
  };
}

describe("RecordEditor", () => {
  it("renders template import options and imports selected template", async () => {
    const user = userEvent.setup();
    const onImportTemplate = vi.fn();

    render(<RecordEditor {...buildProps({ onImportTemplate })} />);

    expect(screen.getByRole("button", { name: "导入模板" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "晨间复盘模板（默认）" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "晚间记录模板" }));

    expect(onImportTemplate).toHaveBeenCalledWith(templates[1]);
  });

  it("disables template import trigger in demo mode", () => {
    render(<RecordEditor {...buildProps({ isDemoMode: true, templateMenuOpen: false })} />);

    expect(screen.getByRole("button", { name: "导入模板" })).toBeDisabled();
  });

  it("shows cancel default button only for default template editing", () => {
    render(
      <RecordEditor
        {...buildProps({
          creatingTemplate: false,
          editorMode: "template",
          selectedTemplate: templates[0],
          showTemplateToolbar: false,
          templateDefaultDraft: true,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "取消默认模板" })).toBeInTheDocument();
  });

  it("focuses title input when the focus signal changes", () => {
    render(<RecordEditor {...buildProps({ templateMenuOpen: false, titleFocusSignal: 1 })} />);

    expect(screen.getByPlaceholderText("请输入记录标题")).toHaveFocus();
  });

  it("uses pressable button styling for editor actions", () => {
    render(
      <RecordEditor
        {...buildProps({
          templateMenuOpen: false,
          selectedRecord: { id: 1 },
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "删除" }).className).toContain("shell__nav-button--pressable");
    expect(screen.getByRole("button", { name: "保存" }).className).toContain("shell__nav-button--pressable");
  });
});
