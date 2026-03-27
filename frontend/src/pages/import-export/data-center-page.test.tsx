import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../../app/providers/auth-provider";
import type { ApiSession } from "../../shared/api/client";
import { DataCenterPage } from "./data-center-page";
import * as dataCenterApi from "../../features/data-center/api";

function renderWithAuth(overrides: Partial<React.ContextType<typeof AuthContext>> = {}) {
  const value = {
    backendReady: false,
    authRegistrationEnabled: false,
    currentUser: null,
    session: null as ApiSession | null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={value}>
      <DataCenterPage />
    </AuthContext.Provider>,
  );
}

describe("DataCenterPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows login notice when guest tries to create export", async () => {
    const user = userEvent.setup();

    renderWithAuth();

    await user.click(screen.getByRole("button", { name: "导出记录" }));

    expect(await screen.findByText("请先登录或注册")).toBeInTheDocument();
  });

  it("allows guest to download import template zip", async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(dataCenterApi, "downloadRecordImportTemplateZip").mockResolvedValue();

    renderWithAuth();

    await user.click(screen.getByRole("button", { name: "下载模板" }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalled();
    });
    expect(await screen.findByText("已开始下载记录导入模板")).toBeInTheDocument();
  });

  it("prevents duplicate clicks on template zip download", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const downloadSpy = vi.spyOn(dataCenterApi, "downloadRecordImportTemplateZip").mockResolvedValue();

    renderWithAuth();

    const button = screen.getByRole("button", { name: "下载模板" });

    await user.click(button);
    await user.click(button);

    expect(downloadSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1200);
    await user.click(screen.getByRole("button", { name: "下载模板" }));
    expect(downloadSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps create-backup button stable while restore is running", async () => {
    const user = userEvent.setup();
    const restoreSpy = vi.spyOn(dataCenterApi, "restoreBackupFile").mockImplementation(
      () => new Promise(() => undefined),
    );

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const file = new File(["backup"], "backup.zip", { type: "application/zip" });
    await user.upload(screen.getByLabelText("备份文件"), file);
    await user.click(screen.getByRole("button", { name: "开始恢复" }));

    expect(restoreSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "恢复中..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "备份全部数据" })).toBeEnabled();
  });

  it("shows complete restore toast with AI analyses label", async () => {
    const user = userEvent.setup();
    vi.spyOn(dataCenterApi, "restoreBackupFile").mockResolvedValue({
      recordsImported: 0,
      templatesImported: 0,
      analysesImported: 0,
    });

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const file = new File(["backup"], "backup.zip", { type: "application/zip" });
    await user.upload(screen.getByLabelText("备份文件"), file);
    await user.click(screen.getByRole("button", { name: "开始恢复" }));

    expect(await screen.findByText("备份已恢复：记录 0，模板 0，AI分析 0")).toBeInTheDocument();
  });

  it("shows localized import error in toast", async () => {
    const user = userEvent.setup();
    vi.spyOn(dataCenterApi, "uploadImportFile").mockRejectedValue(new Error('{"detail":"Import file exceeds the 20MB upload limit"}'));

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const file = new File(["import"], "records.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("导入文件"), file);
    await user.click(screen.getByRole("button", { name: "开始导入" }));

    expect(await screen.findByText("导入文件超过 20MB 限制")).toBeInTheDocument();
  });

  it("shows localized restore error in toast", async () => {
    const user = userEvent.setup();
    vi.spyOn(dataCenterApi, "restoreBackupFile").mockRejectedValue(new Error('{"detail":"Backup file is not a valid ZIP archive"}'));

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const file = new File(["backup"], "backup.zip", { type: "application/zip" });
    await user.upload(screen.getByLabelText("备份文件"), file);
    await user.click(screen.getByRole("button", { name: "开始恢复" }));

    expect(await screen.findByText("备份文件不是有效的 ZIP 压缩包")).toBeInTheDocument();
  });

  it("renders AI analysis export label", () => {
    renderWithAuth();

    expect(screen.getByText("AI分析导出")).toBeInTheDocument();
  });

  it("prevents duplicate clicks on record export", async () => {
    const user = userEvent.setup();
    const exportSpy = vi.spyOn(dataCenterApi, "createExportTask").mockResolvedValue({
      id: 1,
      userId: 1,
      exportType: "records",
      format: "json",
      status: "pending",
      filePath: null,
      fileSize: null,
      createdAt: "",
      updatedAt: "",
      finishedAt: null,
      expiresAt: null,
    });

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const button = screen.getByRole("button", { name: "导出记录" });
    await user.click(button);
    await user.click(button);

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledWith("access", { exportType: "records", format: "json" });
    expect(screen.getByRole("button", { name: "处理中..." })).toBeDisabled();
  });

  it("prevents duplicate clicks on AI analysis export", async () => {
    const user = userEvent.setup();
    const exportSpy = vi.spyOn(dataCenterApi, "createExportTask").mockResolvedValue({
      id: 2,
      userId: 1,
      exportType: "analyses",
      format: "json",
      status: "pending",
      filePath: null,
      fileSize: null,
      createdAt: "",
      updatedAt: "",
      finishedAt: null,
      expiresAt: null,
    });

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const button = screen.getByRole("button", { name: "导出AI分析" });
    await user.click(button);
    await user.click(button);

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledWith("access", { exportType: "analyses", format: "json" });
    expect(screen.getByRole("button", { name: "处理中..." })).toBeDisabled();
  });

  it("prevents duplicate clicks on create backup", async () => {
    const user = userEvent.setup();
    const backupSpy = vi.spyOn(dataCenterApi, "createBackupTask").mockResolvedValue({
      id: 3,
      userId: 1,
      format: "zip",
      status: "pending",
      storagePath: null,
      checksum: null,
      createdAt: "",
      updatedAt: "",
      finishedAt: null,
    });

    renderWithAuth({
      backendReady: true,
      currentUser: { id: 1, username: "tester" },
      session: { accessToken: "access", refreshToken: "refresh" },
    });

    const button = screen.getByRole("button", { name: "备份全部数据" });
    await user.click(button);
    await user.click(button);

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(backupSpy).toHaveBeenCalledWith("access");
    expect(screen.getByRole("button", { name: "处理中..." })).toBeDisabled();
  });
});
