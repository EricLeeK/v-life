export type NewspaperPaidAction = "image_generate" | "review_generate";
export type PaidRequestStatus =
  | "pending"
  | "queued"
  | "submitting"
  | "running"
  | "saving"
  | "unknown";
export interface NewspaperPaidRequest {
  scope: string;
  action: NewspaperPaidAction;
  date: string;
  fingerprint: string;
  key: string;
  status: PaidRequestStatus;
  jobId?: string;
  createdAt: string;
}
const PREFIX = "vlife-newspaper-paid-v1:";
export const NEWSPAPER_PAID_REQUEST_EVENT = "newspaper-paid-request-change";
const activeStatuses = new Set([
  "pending",
  "queued",
  "submitting",
  "running",
  "saving",
  "unknown",
]);
// These codes are emitted before a fresh request reaches a paid provider.
// A later replay can fail authentication while its original request is still
// running, so they must not release an already persisted, uncertain identity.
const preSubmissionErrors = new Set([
  "MODEL_UNAVAILABLE",
  "IMAGE_KEY_REQUIRED",
  "AI_NOT_CONFIGURED",
  "HOSTED_NOT_PROVISIONED",
  "HOSTED_DISABLED",
  "HOSTED_RATE_LIMIT",
  "HOSTED_QUOTA_EXCEEDED",
  "INVALID_INPUT",
  "REPORT_TOO_LARGE",
  "FUTURE_DATE",
  "REPORT_NOT_FOUND",
  "SOURCE_UNAVAILABLE",
  "NOT_FOUND",
  "SERVER_CONTEXT_REQUIRED",
  "SERVER_CONFIGURATION",
  "UNAUTHORIZED",
  "PERMISSION_DENIED",
  "BROWSER_SESSION_REQUIRED",
  "ORIGIN_NOT_ALLOWED",
  "ACTION_NOT_ALLOWED",
  "METHOD_NOT_ALLOWED",
]);
const terminalReviewErrors = new Set([
  "REVIEW_FAILED",
  "REVIEW_STALE",
  "UPSTREAM_ERROR",
  "INVALID_AI_RESPONSE",
]);
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonical(v ?? null)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${
      Object.entries(value).filter(([, v]) => v !== undefined).sort((
        [a],
        [b],
      ) => a.localeCompare(b)).map(([key, v]) =>
        `${JSON.stringify(key)}:${canonical(v)}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value) ?? "null";
}
async function fingerprint(value: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(
    new Uint8Array(hash),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function statusOf(result: any, action: NewspaperPaidAction): string {
  const job = result?.job ?? result;
  if (
    activeStatuses.has(job?.status) ||
    ["succeeded", "failed"].includes(job?.status)
  ) return job.status;
  if (
    action === "review_generate" &&
    (result?.review || typeof result?.overview === "string")
  ) return "succeeded";
  return "unknown";
}
export function createNewspaperPaidRequestStore(
  storage: Storage,
  notify: () => void = () => {},
) {
  const write = (id: string, record: NewspaperPaidRequest) => {
    try {
      storage.setItem(id, JSON.stringify(record));
    } catch {
      throw new Error("浏览器无法保存生成请求标识，请允许本站会话存储后重试。");
    }
    notify();
  };
  const remove = (id: string) => {
    storage.removeItem(id);
    notify();
  };
  const all = () => {
    const records: Array<{ id: string; record: NewspaperPaidRequest }> = [];
    try {
      for (let n = 0; n < storage.length; n++) {
        const id = storage.key(n);
        if (!id?.startsWith(PREFIX)) continue;
        try {
          const record = JSON.parse(storage.getItem(id) || "");
          if (record?.key && record?.scope && record?.action) {
            records.push({ id, record });
          }
        } catch {
          /* Corrupt records are blocked when their request is retried. */
        }
      }
    } catch { /* Display can remain readable when storage is blocked. */ }
    return records;
  };
  return {
    pending(scope: string, action?: string, date?: string) {
      return all().filter(({ record: r }) =>
        r.scope === scope && (!action || r.action === action) &&
        (!date || r.date === date)
      ).map(({ record }) => record);
    },
    reconcileImages(
      scope: string,
      date: string,
      jobs: Array<{ id: string; status: string }>,
    ) {
      for (const { id, record } of all()) {
        if (
          record.scope !== scope || record.date !== date ||
          record.action !== "image_generate" || !record.jobId
        ) continue;
        const job = jobs.find((j) => j.id === record.jobId);
        if (!job) continue;
        if (["succeeded", "failed"].includes(job.status)) remove(id);
        else if (
          activeStatuses.has(job.status) && job.status !== record.status
        ) write(id, { ...record, status: job.status as PaidRequestStatus });
      }
    },
    async run<T>(
      scope: string,
      action: NewspaperPaidAction,
      input: Record<string, unknown>,
      invoke: (key: string) => Promise<T>,
      preferredKey?: string,
    ): Promise<T> {
      const identity = action === "image_generate"
        ? { ...input, section_id: input.section_id ?? "main" }
        : input;
      const digest = await fingerprint({ scope, action, input: identity });
      const id = PREFIX + digest;
      let stored: string | null;
      try {
        stored = storage.getItem(id);
      } catch {
        throw new Error(
          "浏览器无法读取生成请求标识，请允许本站会话存储后重试。",
        );
      }
      let record: NewspaperPaidRequest;
      if (stored) {
        try {
          record = JSON.parse(stored);
          if (!record.key || record.fingerprint !== digest) throw new Error();
        } catch {
          throw new Error(
            "生成请求记录无法读取，请先检查已有任务状态，避免重复提交。",
          );
        }
      } else {
        record = {
          scope,
          action,
          date: String(input.date || ""),
          fingerprint: digest,
          key: preferredKey || crypto.randomUUID(),
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        write(id, record);
      }
      try {
        const result = await invoke(record.key);
        const status = statusOf(result, action);
        if (status === "succeeded" || status === "failed") remove(id);
        else {
          const job = (result as any)?.job ?? result;
          write(id, {
            ...record,
            status: status as PaidRequestStatus,
            ...(typeof job?.id === "string" ? { jobId: job.id } : {}),
          });
        }
        return result;
      } catch (error) {
        const code = (error as { code?: string }).code;
        const terminal = action === "review_generate" &&
          terminalReviewErrors.has(code || "");
        const rejectedBeforeSubmission = !stored &&
          preSubmissionErrors.has(code || "");
        if (terminal || rejectedBeforeSubmission) remove(id);
        else {
          write(id, {
            ...record,
            status: code === "REVIEW_IN_PROGRESS" ? "pending" : "unknown",
          });
        }
        throw error;
      }
    },
  };
}
export function newspaperPaidRequestStore() {
  return createNewspaperPaidRequestStore(
    {
      get length() {
        return window.sessionStorage.length;
      },
      clear: () => window.sessionStorage.clear(),
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: (key) => window.sessionStorage.removeItem(key),
      key: (index) => window.sessionStorage.key(index),
    },
    () => window.dispatchEvent(new Event(NEWSPAPER_PAID_REQUEST_EVENT)),
  );
}
