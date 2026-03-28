import type { AnalysisAggregate, AnalysisItem, TodayAnalysisCount } from "../../entities/analysis/types";
import type { RecordItem } from "../../entities/record/types";
import type { TemplateItem } from "../../entities/template/types";

// localStorage keys are centralized here to avoid repeating string literals across pages.
export const storageKeys = {
  session: "cebms_api_session",
  recordImportNotice: "cebms_record_import_notice",
  recordListCache: "cebms_record_list_cache",
  templateListCache: "cebms_template_list_cache",
  analysisPreviewCache: "cebms_analysis_preview_cache",
} as const;

const cacheTtlMs = 1000 * 60 * 15;

type CachedPayload<T> = {
  userId: number;
  savedAt: number;
  data: T;
};

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

type RecordListCache = {
  records: RecordItem[];
};

type TemplateListCache = {
  templates: TemplateItem[];
};

type AnalysisPreviewCache = {
  analyses: AnalysisItem[];
  aggregate: AnalysisAggregate | null;
  todayCount: TodayAnalysisCount | null;
};

function loadCachedPayload<T>(key: string, userId: number): T | null {
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (parsed.userId !== userId) {
      return null;
    }

    if (Date.now() - parsed.savedAt > cacheTtlMs) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function saveCachedPayload<T>(key: string, userId: number, data: T | null) {
  if (!data) {
    window.localStorage.removeItem(key);
    return;
  }

  const payload: CachedPayload<T> = {
    userId,
    savedAt: Date.now(),
    data,
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
}

export function loadRecordListCache(userId: number): RecordListCache | null {
  return loadCachedPayload<RecordListCache>(storageKeys.recordListCache, userId);
}

export function saveRecordListCache(userId: number, records: RecordItem[] | null) {
  saveCachedPayload<RecordListCache>(
    storageKeys.recordListCache,
    userId,
    records ? { records: records.slice(0, 10) } : null,
  );
}

export function loadTemplateListCache(userId: number): TemplateListCache | null {
  return loadCachedPayload<TemplateListCache>(storageKeys.templateListCache, userId);
}

export function saveTemplateListCache(userId: number, templates: TemplateItem[] | null) {
  saveCachedPayload<TemplateListCache>(
    storageKeys.templateListCache,
    userId,
    templates ? { templates } : null,
  );
}

export function loadAnalysisPreviewCache(userId: number): AnalysisPreviewCache | null {
  return loadCachedPayload<AnalysisPreviewCache>(storageKeys.analysisPreviewCache, userId);
}

export function saveAnalysisPreviewCache(
  userId: number,
  preview: { analyses: AnalysisItem[]; aggregate: AnalysisAggregate | null; todayCount: TodayAnalysisCount | null } | null,
) {
  saveCachedPayload<AnalysisPreviewCache>(
    storageKeys.analysisPreviewCache,
    userId,
    preview
      ? {
          analyses: preview.analyses.slice(0, 10),
          aggregate: preview.aggregate,
          todayCount: preview.todayCount,
        }
      : null,
  );
}
