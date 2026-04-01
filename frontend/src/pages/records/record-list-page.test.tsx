import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppRouter } from "../../app/router";
import { ConfirmProvider } from "../../app/providers/confirm-provider";
import { NavigationProvider } from "../../app/providers/navigation-provider";
import { RecordListPage } from "./record-list-page";

vi.mock("../../shared/hooks/use-auth", () => ({
  useAuth: () => ({
    backendReady: false,
    currentUser: null,
    session: null,
  }),
}));

describe("RecordListPage", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/records");
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

  it("does not open confirm dialog when the selected record has no changes", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: /情绪起伏的一天/ }));
    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens save-or-discard confirm dialog when the selected record has changes", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: /情绪起伏的一天/ }));
    await user.type(screen.getByPlaceholderText("请输入记录标题"), " updated");
    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("是否放弃未保存的修改？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("opens unified confirm dialog when the new record draft already has text", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);
    await user.type(screen.getByPlaceholderText("请输入记录标题"), "新的草稿");
    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("是否放弃未保存的修改？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("opens unified confirm dialog when switching template with unsaved text", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "展开模板列表" }));
    await user.click(screen.getAllByRole("button", { name: "新增" })[1]);
    await user.type(screen.getByPlaceholderText("请输入模板标题"), "新的模板草稿");
    await user.click(screen.getByRole("button", { name: /夜间复盘模板/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("是否放弃未保存的修改？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("opens unified confirm dialog when navigating away with unsaved text", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <AppRouter />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);
    await user.type(screen.getByPlaceholderText("请输入记录标题"), "未保存草稿");
    await user.click(screen.getByRole("button", { name: "AI分析" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("是否放弃未保存的修改？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("shows record validation in footer and toast when saving with empty title", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);
    await user.type(screen.getByPlaceholderText("自由记录当天的想法、事件、情绪和行为"), "只有内容");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getAllByText("请输入记录标题").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("status")).toHaveTextContent("请输入记录标题");
  });

  it("shows template validation in footer and toast, but not in template sidebar", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "展开模板列表" }));
    await user.click(screen.getAllByRole("button", { name: "新增" })[1]);
    await user.type(screen.getByPlaceholderText("请输入模板内容"), "只有模板内容");
    await user.click(screen.getByRole("button", { name: "保存模板" }));

    expect(screen.getAllByText("请输入模板标题").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("status")).toHaveTextContent("请输入模板标题");

    const templateSidebar = screen.getByRole("heading", { name: "模板列表" }).closest("aside");
    expect(templateSidebar).not.toBeNull();
    expect(within(templateSidebar!).queryByText("请输入模板标题")).not.toBeInTheDocument();
  });

  it("shows template validation toast when confirm-save is pressed with missing title", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <AppRouter />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "展开模板列表" }));
    await user.click(screen.getAllByRole("button", { name: "新增" })[1]);
    await user.type(screen.getByPlaceholderText("请输入模板内容"), "只有模板内容");
    await user.click(screen.getByRole("button", { name: "AI分析" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "保存" }));

    expect(screen.getAllByText("请输入模板标题").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("status")).toHaveTextContent("请输入模板标题");

    const templateSidebar = screen.getByRole("heading", { name: "模板列表" }).closest("aside");
    expect(templateSidebar).not.toBeNull();
    expect(within(templateSidebar!).queryByText("请输入模板标题")).not.toBeInTheDocument();
  });

  it("keeps the record title and appends template content when importing into the editor", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);
    await user.type(screen.getByPlaceholderText("请输入记录标题"), "我的记录标题");
    const originalContent = (screen.getByPlaceholderText("自由记录当天的想法、事件、情绪和行为") as HTMLTextAreaElement).value;
    await user.click(screen.getByRole("button", { name: "导入模板" }));
    await user.click(screen.getByRole("option", { name: "夜间复盘模板" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("请输入记录标题")).toHaveValue("我的记录标题");
      expect(screen.getByPlaceholderText("自由记录当天的想法、事件、情绪和行为")).toHaveValue(
        `${originalContent}\n\n今天最值得记录的事：\n情绪起伏：\n我的反应：\n可以调整的地方：\n明天的一件小任务：`,
      );
    });
  });

  it("opens confirm dialog when leaving after importing template content", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);
    await user.click(screen.getByRole("button", { name: "导入模板" }));
    await user.click(screen.getByRole("option", { name: "夜间复盘模板" }));
    await user.click(screen.getByRole("button", { name: "展开模板列表" }));
    await user.click(screen.getAllByRole("button", { name: /夜间复盘模板/ })[1]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("是否放弃未保存的修改？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("shows pressed state immediately on pointer interaction", async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <ConfirmProvider>
          <RecordListPage />
        </ConfirmProvider>
      </NavigationProvider>,
    );

    const newButton = screen.getAllByRole("button", { name: "新增" })[0];
    await user.pointer([{ target: newButton, keys: "[MouseLeft>]" }]);

    await waitFor(() => {
      expect(newButton.className).toContain("shell__nav-button--pressed");
    });
  });
});
