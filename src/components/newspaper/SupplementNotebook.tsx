import { useCallback, useEffect, useRef, useState } from "react";
import { useNewspaperDrafts } from "./NewspaperDraftContext";
import { DateTimeField } from "@/components/arc/DateField";
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
            occurred_at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(next.occurred)
              ? (row && next.occurred === saved.current.occurred
                ? row.occurred_at
                : inputIso(next.occurred.slice(0, 16), timezone))
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
  const statusText = status === "saved"
    ? <><Check size={13} />已保存</>
    : status === "saving"
    ? "保存中…"
    : status === "dirty"
    ? "待保存…"
    : <><AlertCircle size={13} />保存失败</>;
  return (
    <div className={item ? "np-slip" : "np-slip np-slip-new"}>
      <label className="np-slip-text">
        <span className={item ? "sr-only" : "np-slip-label"}>
          {item ? "补充原文" : "这一天，还有什么想留下？"}
        </span>
        <textarea
          autoFocus={!item}
          value={body}
          rows={item ? 3 : 4}
          placeholder="一次谈话、一段散步、心情变化……这里保留你写下的每一个字。"
          onChange={(e) => {
            setBody(e.target.value);
            setStatus("dirty");
          }}
          onBlur={() => void save()}
        />
      </label>
      <div className="np-slip-meta">
        <div className="np-slip-time">
          <DateTimeField
            label={`发生时间（${timezone}，可选）`}
            value={occurred}
            onChange={(next) => {
              setOccurred(next);
              setStatus("dirty");
            }}
          />
        </div>
        <span
          className={status === "error" ? "np-slip-status np-error" : "np-slip-status"}
          role="status"
        >
          {statusText}
        </span>
        {item
          ? (
            <button
              type="button"
              className="np-icon-button np-icon-quiet np-icon-danger"
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
              <Trash2 size={15} />
            </button>
          )
          : (
            <button
              type="button"
              className="np-text-link"
              onClick={() => {
                discarded.current = true;
                onCancel?.();
              }}
            >
              取消
            </button>
          )}
      </div>
      {status === "error" && (
        <p className="np-error" role="alert">
          {error}{" "}
          <button type="button" className="np-text-link" onClick={() => void save()}>
            重试保存
          </button>
        </p>
      )}
    </div>
  );
}
export function SupplementNotebook(
  { report, addSignal = 0 }: { report: NewspaperReport; addSignal?: number },
) {
  const [adding, setAdding] = useState(false);
  const command = useNewspaperCommand();
  const startRef = useRef<(() => Promise<void>) | undefined>(undefined);
  startRef.current = async () => {
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
  };
  useEffect(() => {
    if (addSignal) void startRef.current?.();
  }, [addSignal]);
  return (
    <section
      id="np-supplements"
      tabIndex={-1}
      className="np-mod np-mod-notes"
      aria-labelledby="np-supplement-heading"
    >
      <header className="np-mod-head">
        <h2 id="np-supplement-heading">生活的另一面</h2>
        <span className="np-mod-kicker">我的补充 · 原文保存</span>
      </header>
      {!report.supplements.length && !adding && (
        <p className="np-notes-intro">
          没有出现在待办和账单里的片刻，也值得留下。写下即自动保存，一字不改。
        </p>
      )}
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
          onCancel={() => setAdding(false)}
        />
      )}
      {!adding && (
        <button
          type="button"
          className="np-add-row"
          onClick={() => void startRef.current?.()}
          disabled={command.isPending}
        >
          <Plus size={15} />补充记录
        </button>
      )}
    </section>
  );
}
