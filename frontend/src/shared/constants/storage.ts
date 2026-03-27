// localStorage keys are centralized here to avoid repeating string literals across pages.
export const storageKeys = {
  session: "cebms_api_session",
  recordImportNotice: "cebms_record_import_notice",
} as const;

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
};

export function loadStoredSession(): StoredSession | null {
  const raw = window.localStorage.getItem(storageKeys.session);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession | null) {
  if (!session) {
    window.localStorage.removeItem(storageKeys.session);
    return;
  }

  window.localStorage.setItem(storageKeys.session, JSON.stringify(session));
}

export type RecordImportNotice = {
  importedCount: number;
  timestamp: number;
};

export function loadRecordImportNotice(): RecordImportNotice | null {
  const raw = window.localStorage.getItem(storageKeys.recordImportNotice);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RecordImportNotice;
  } catch {
    return null;
  }
}

export function saveRecordImportNotice(notice: RecordImportNotice | null) {
  if (!notice) {
    window.localStorage.removeItem(storageKeys.recordImportNotice);
    return;
  }

  window.localStorage.setItem(storageKeys.recordImportNotice, JSON.stringify(notice));
}
