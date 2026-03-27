import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmProvider } from "../../app/providers/confirm-provider";
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
      <ConfirmProvider>
        <RecordListPage />
      </ConfirmProvider>,
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
      <ConfirmProvider>
        <RecordListPage />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: /情绪起伏的一天/ }));
    await user.type(screen.getByPlaceholderText("请输入记录标题"), " updated");
    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("是否更新该记录？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  it("opens keep-or-discard confirm dialog when the new record draft already has text", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmProvider>
        <RecordListPage />
      </ConfirmProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);
    await user.type(screen.getByPlaceholderText("请输入记录标题"), "新的草稿");
    await user.click(screen.getAllByRole("button", { name: "新增" })[0]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("正在编辑记录，需要保留该记录吗？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保留" })).toBeInTheDocument();
  });

  it("opens keep-or-discard confirm dialog when the new template draft already has text", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmProvider>
        <RecordListPage />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "展开模板列表" }));
    await user.click(screen.getAllByRole("button", { name: "新增" })[1]);
    await user.click(screen.getByRole("button", { name: "舍弃" }));
    await user.type(screen.getByPlaceholderText("请输入模板标题"), "新的模板草稿");
    await user.click(screen.getAllByRole("button", { name: "新增" })[1]);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("正在编辑模板，需要保留该模板吗？")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "舍弃" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "保留" })).toBeInTheDocument();
  });

  it("shows pressed state immediately on pointer interaction", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmProvider>
        <RecordListPage />
      </ConfirmProvider>,
    );

    const newButton = screen.getAllByRole("button", { name: "新增" })[0];
    await user.pointer([{ target: newButton, keys: "[MouseLeft>]" }]);

    await waitFor(() => {
      expect(newButton.className).toContain("shell__nav-button--pressed");
    });
  });
});
