import { useCallback, useEffect, useRef, useState } from "react";
import { useNewspaperDrafts } from "./NewspaperDraftContext";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNewspaperCommand } from "@/hooks/useNewspapers";
import type {
  NewspaperReport,
  NewspaperSupplement,
} from "../../../supabase/functions/_shared/newspaperTypes";
function localInput(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso)).replace(" ", "T");
}
function inputIso(value: string, timezone: string) {
  const target = Date.parse(value + "Z");
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    const current = Date.parse(
      localInput(new Date(candidate).toISOString(), timezone) + "Z",
    );
    const delta = target - current;
    if (!delta) return new Date(candidate).toISOString();
    candidate += delta;
  }
  throw new Error("这个时间在所选时区不存在，请检查夏令时或换一个时间。");
}
function SupplementEditor(
  { date, timezone, item, onCreated, onCancel }: {
    date: string;
    timezone: string;
    item?: NewspaperSupplement;
    onCreated?: () => void;
    onCancel?: () => void;
  },
) {
  const drafts = useNewspaperDrafts();
  const discarded = useRef(false);
  const [body, setBody] = useState(item?.body || "");
  const [occurred, setOccurred] = useState(
    item?.occurred_at ? localInput(item.occurred_at, timezone) : "",
  );
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">(
    "saved",
  );
  const [error, setError] = useState("");
  const command = useNewspaperCommand();
  const current = useRef(item);
  const latest = useRef({ body, occurred });
  latest.current = { body, occurred };
  const saved = useRef({ body, occurred });
  const busy = useRef(false);
  const mounted = useRef(true);
  const created = useRef(onCreated);
  created.current = onCreated;
  const save = useCallback(async () => {
    if (discarded.current) return true;
    while (busy.current) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const value = latest.current;
    if (
      saved.current.body === value.body &&
      saved.current.occurred === value.occurred
    ) return true;
    if (!value.body.trim()) {
      if (mounted.current) {
        setStatus("error");
        setError("原文不能为空。可以填写内容，或删除这条补充。");
      }
      return false;
    }
    busy.current = true;
    if (mounted.current) setStatus("saving");
    try {
      while (
        saved.current.body !== latest.current.body ||
        saved.current.occurred !== latest.current.occurred
      ) {
        const next = { ...latest.current };
        if (!next.body.trim()) break;
        const row = current.current;
        const result = await command.mutateAsync({
          action: "supplement_save",
          input: {
            date,
            body: next.body,
            occurred_at: next.occurred
              ? (row && next.occurred === saved.current.occurred
                ? row.occurred_at
                : inputIso(next.occurred, timezone))
              : null,
            ...(row ? { id: row.id, expected_updated_at: row.updated_at } : {}),
          },
        });
        current.current = result;
        saved.current = next;
      }
      if (mounted.current) {
        setStatus("saved");
        setError("");
      }
      if (!item && current.current) created.current?.();
      return true;
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        setStatus("error");
      }
      return false;
    } finally {
      busy.current = false;
    }
  }, [command.mutateAsync, date, item, timezone]);
  useEffect(() => drafts.register(item?.id || `new-${date}`, save), [
    drafts.register,
    item?.id,
    date,
    save,
  ]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void save();
    };
  }, [save]);
  useEffect(() => {
    if (status !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [body, occurred, status, save]);
  useEffect(() => {
    if (status === "saved") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);
  return (
    <div className="np-supplement">
      <label className="np-field">
        {item ? "补充原文" : "这一天，还有什么想留下？"}
        <textarea
          autoFocus={!item}
          value={body}
          rows={item ? 4 : 5}
          placeholder="一次谈话、一段散步、心情变化……这里保留你写下的每一个字。"
          onChange={(e) => {
            setBody(e.target.value);
            setStatus("dirty");
          }}
          onBlur={() => void save()}
        />
      </label>
      <div className="np-split">
        <label className="np-field np-time-field">
          发生时间（{timezone}，可选）<input
            type="datetime-local"
            value={occurred}
            onChange={(e) => {
              setOccurred(e.target.value);
              setStatus("dirty");
            }}
          />
        </label>
        <div className="np-inline">
          <span
            className={status === "error" ? "np-error" : "np-muted"}
            role="status"
          >
            {status === "saved"
              ? (
                <>
                  <Check size={13} />已保存
                </>
              )
              : status === "saving"
              ? "保存中…"
              : status === "dirty"
              ? "待保存…"
              : (
                <>
                  <AlertCircle size={13} />保存失败
                </>
              )}
          </span>
          {item
            ? (
              <button
                className="np-icon-button"
                aria-label="删除这条补充"
                onClick={async () => {
                  if (!window.confirm("删除这条补充原文？")) return;
                  try {
                    await save();
                    const row = current.current!;
                    await command.mutateAsync({
                      action: "supplement_delete",
                      input: {
                        date,
                        id: row.id,
                        expected_updated_at: row.updated_at,
                      },
                    });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            )
            : (
              <button
                className="np-text-button"
                onClick={() => {
                  discarded.current = true;
                  onCancel?.();
                }}
              >
                取消
              </button>
            )}
        </div>
      </div>
      {item && (
        <p className="np-muted">
          首次记录于 {new Date(item.created_at).toLocaleString("zh-CN", {
            timeZone: timezone,
          })}
        </p>
      )}
      {status === "error" && (
        <p className="np-error" role="alert">
          {error}{" "}
          <button className="np-text-button" onClick={() => void save()}>
            重试保存
          </button>
        </p>
      )}
    </div>
  );
}
export function SupplementNotebook({ report }: { report: NewspaperReport }) {
  const [adding, setAdding] = useState(false);
  const command = useNewspaperCommand();
  return (
    <section className="np-notebook" aria-labelledby="np-supplement-heading">
      <div className="np-split">
        <div>
          <h2 id="np-supplement-heading">生活的另一面</h2>
          <p className="np-muted">
            网站之外的经历，也值得被记住。输入后自动保存原文。
          </p>
        </div>
        <button
          className="np-button"
          onClick={async () => {
            try {
              if (!report.id) {
                await command.mutateAsync({
                  action: "refresh",
                  input: { date: report.date },
                });
              }
              setAdding(true);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          disabled={adding || command.isPending}
        >
          <Plus size={16} />补充记录
        </button>
      </div>
      {report.supplements.map((item) => (
        <SupplementEditor
          key={item.id}
          date={report.date}
          timezone={report.timezone}
          item={item}
        />
      ))}
      {adding && (
        <SupplementEditor
          date={report.date}
          timezone={report.timezone}
          onCreated={() => setAdding(false)}
          onCancel={() =>
            setAdding(false)}
        />
      )} {!report.supplements.length && !adding && (
        <p className="np-empty-note">
          还没有额外补充。这里留给那些没有出现在待办和账单里的片刻。
        </p>
      )}
    </section>
  );
}
