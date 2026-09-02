import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Bot, X, Send, Loader2, Check, AlertCircle, Image, Plus, History, Trash2, Undo2, Camera } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/hooks/useData";
import { useLang } from "@/contexts/LanguageContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { messageFromAiInvoke } from "@/lib/aiErrors";
import { useClipboardImagePaste } from "@/hooks/useClipboardImagePaste";
import { moduleByKey, tableOf, getModuleLabels, allQueryKeys } from "@modules";
import { chartPalette } from "@/lib/chartTokens";
import { parseAgentChatContent, sanitizeAssistantContent } from "../../supabase/functions/_shared/parseAgentChat";
import { formatOpPreview, normalizeHabitCreate, rewriteCompleteOp, shouldSkipDailyTask } from "@/lib/habitAi";
import { isPersistentKind } from "@/lib/habits";

type MessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type Message = {
  role: "user" | "assistant";
  content: string;
  contentRaw?: MessageContent;
  imageUrls?: string[];
  operations?: Operation[];
  status?: "pending" | "executed" | "error" | "preview";
};

type Operation = {
  module: string;
  action: string;
  data: Record<string, any>;
};

// React Query keys invalidated after any write. Single source: the canonical
// module registry (shared with the Supabase edge functions). Previously two
// hand-written lists here disagreed (20 keys vs 16 keys); both now derive
// from the registry plus the shared composite keys below.
const WRITE_QUERY_KEYS = allQueryKeys();
const COMPOSITE_QUERY_KEYS: ReadonlyArray<[string, string]> = [
  ["schedule", "today"],
  ["calories", "today_summary"],
  ["finance", "summary"],
  ["todos", "pending"],
];

/**
 * Resolve a model-supplied name to a foreign-key id, e.g. project_name → project_id.
 * Driven by `executor.resolves` on the module registry entry, so adding a new
 * name-resolved module needs no changes here.
 */
async function resolveByName(
  spec: { targetTable: string; targetField: string },
  value: string,
  throwOnMissing: boolean,
): Promise<string | null> {
  const { data } = await (supabase.from as any)(spec.targetTable)
    .select("id")
    .ilike(spec.targetField, `%${value}%`)
    .limit(1)
    .maybeSingle();
  if (data) return data.id as string;
  if (throwOnMissing) throw new Error(`未找到「${value}」`);
  return null;
}

const MAX_SESSIONS = 30;

function mapOperationToRow(module: string, data: Record<string, any>, exchangeRate?: number): Record<string, any> {
  const today = format(new Date(), "yyyy-MM-dd");
  const jpyRate = exchangeRate || 0.048;

  switch (module) {
    case "finance": {
      const VALID_FINANCE_CATS = ["餐饮","日用","交通","住房","通讯/订阅","医疗","服饰","娱乐","学习","电子","大额","税费","其他"];
      const cat = VALID_FINANCE_CATS.includes(data.category) ? data.category : "其他";
      return {
        name: data.name || data.title || "未命名",
        amount: Number(data.amount) || 0,
        currency: data.currency || "CNY",
        category: cat,
        date: data.date || today,
        amount_cny: data.currency === "JPY" ? Number(data.amount) * jpyRate : Number(data.amount),
        exchange_rate: data.currency === "JPY" ? jpyRate : 1,
        notes: data.notes || null,
      };
    }
    case "calories":
      return {
        food_name: data.food_name || data.name || "未命名",
        calories: Number(data.calories) || 0,
        meal_type: data.meal_type || "lunch",
        date: data.date || today,
        notes: data.notes || null,
      };
    case "schedule": {
      const parseLocalTime = (t: string) => {
        if (!t) return new Date().toISOString();
        if (/[Zz]$/.test(t) || /[+-]\d{2}:\d{2}$/.test(t)) return t;
        const [datePart, timePart] = t.split("T");
        const [y, m, d] = datePart.split("-").map(Number);
        const [h, min, s] = (timePart || "00:00:00").split(":").map(Number);
        return new Date(y, m - 1, d, h || 0, min || 0, s || 0).toISOString();
      };
      return {
        title: data.title || "未命名事件",
        start_time: parseLocalTime(data.start_time),
        end_time: parseLocalTime(data.end_time),
        importance: data.importance || "普通",
        status: "未开始",
        notes: data.notes || null,
      };
    }
    case "todo": {
      const habit = normalizeHabitCreate(data);
      return {
        title: habit.title,
        category: habit.category || data.category || "未分类",
        importance: data.importance === "低" ? "低优先" : (data.importance || "普通"),
        detail: data.detail || null,
        is_completed: false,
        kind: habit.kind || "once",
        habit_type: habit.habit_type ?? null,
        habit_target: habit.habit_target ?? null,
        habit_unit: habit.habit_unit ?? null,
        is_paused: habit.is_paused === true,
      };
    }
    case "pantry":
      return {
        name: data.name || "未命名",
        category: data.category || "其他",
        quantity: data.quantity || null,
        expiry_date: data.expiry_date || null,
        purchase_date: today,
        notes: data.notes || null,
      };
    case "thought":
      return {
        title: data.title || null,
        content: data.content || data.title || "",
        tags: data.tags || [],
      };
    case "belongings_daily":
      return {
        name: data.name || "未命名",
        category: data.category || "其他",
        purchase_date: data.purchase_date || today,
        notes: data.notes || null,
      };
    case "belongings_durable":
      return {
        name: data.name || "未命名",
        category: data.category || "其他",
        purchase_price: Number(data.purchase_price) || 0,
        purchase_date: data.purchase_date || today,
        expected_lifespan_days: Number(data.expected_lifespan_days) || 365,
        notes: data.notes || null,
      };
    case "weight":
      return {
        date: data.date || today,
        weight: Number(data.weight) || 0,
        notes: data.notes || null,
      };
    case "measurement":
      return {
        date: data.date || today,
        waist: data.waist ? Number(data.waist) : null,
        hip: data.hip ? Number(data.hip) : null,
        chest: data.chest ? Number(data.chest) : null,
        arm: data.arm ? Number(data.arm) : null,
        thigh: data.thigh ? Number(data.thigh) : null,
        notes: data.notes || null,
      };
    case "goal":
      return {
        title: data.title || "未命名目标",
        type: data.type || "week",
        period_start: data.period_start || today,
        is_completed: data.is_completed || false,
      };
    case "project":
      return {
        name: data.name || "未命名项目",
        description: data.description || null,
        status: data.status || "planning",
        priority: data.priority || "medium",
        target_date: data.target_date || null,
      };
    case "project_task":
      return {
        title: data.title || "未命名任务",
        type: data.type || "task",
        status: data.status || "todo",
        description: data.description || null,
        due_date: data.due_date || null,
        weight: data.weight || 1,
      };
    case "learning_course":
      return {
        name: data.name || "未命名课程",
        description: data.description || null,
        color: data.color || chartPalette.blue(),
      };
    case "learning_note":
      return {
        course_id: data.course_id,
        title: data.title || "未命名笔记",
        content: data.content || "",
        tags: data.tags || [],
        note_date: data.note_date || today,
      };
    case "civil_exam":
      return {
        name: data.name || "未命名考试",
        exam_date: data.exam_date || today,
        exam_type: data.exam_type || "自定义",
        is_primary: !!data.is_primary,
        is_archived: !!data.is_archived,
        notes: data.notes || null,
      };
    case "civil_plan":
      return {
        title: data.title || "未命名计划",
        detail: data.detail || null,
        plan_date: data.plan_date || today,
        subject_group: data.subject_group || "xingce",
        subject_tag: data.subject_tag || null,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        source: data.source || "plan",
        is_completed: !!data.is_completed,
        completed_at: data.is_completed ? new Date().toISOString() : null,
      };
    case "civil_checkin":
      return {
        date: data.date || today,
        studied_minutes: Number(data.studied_minutes) || 0,
        note: data.note || null,
      };
    case "civil_wrong": {
      const sourceDate = data.source_date || today;
      const status = data.review_status || "pending";
      const review =
        status === "mastered"
          ? { review_status: "mastered", next_review_date: null, review_interval_days: 1, last_reviewed_at: null }
          : {
              review_status: "pending",
              review_interval_days: 1,
              next_review_date: sourceDate, // client will still work; better set +1 day
              last_reviewed_at: null,
            };
      // next day review
      try {
        const d = new Date(sourceDate + "T00:00:00");
        d.setDate(d.getDate() + 1);
        if (status !== "mastered") {
          review.next_review_date = format(d, "yyyy-MM-dd");
        }
      } catch { /* keep */ }
      return {
        title: data.title || "未命名错题",
        content: data.content || null,
        wrong_reason: data.wrong_reason || null,
        knowledge_point: data.knowledge_point || null,
        subject_group: data.subject_group || "xingce",
        subject_tag: data.subject_tag || null,
        source_date: sourceDate,
        image_url: data.image_url || null,
        ...review,
      };
    }
    case "civil_xingce_paper":
      return {
        taken_date: data.taken_date || today,
        source: data.source || "未命名套卷",
        is_mock: data.is_mock !== false,
        verbal_total: Number(data.verbal_total) || 0,
        verbal_correct: Number(data.verbal_correct) || 0,
        data_total: Number(data.data_total) || 0,
        data_correct: Number(data.data_correct) || 0,
        graphic_total: Number(data.graphic_total) || 0,
        graphic_correct: Number(data.graphic_correct) || 0,
        logic_total: Number(data.logic_total) || 0,
        logic_correct: Number(data.logic_correct) || 0,
        analogy_total: Number(data.analogy_total) || 0,
        analogy_correct: Number(data.analogy_correct) || 0,
        quantity_total: Number(data.quantity_total) || 0,
        quantity_correct: Number(data.quantity_correct) || 0,
        common_total: Number(data.common_total) || 0,
        common_correct: Number(data.common_correct) || 0,
        duration_minutes: data.duration_minutes != null ? Number(data.duration_minutes) : null,
        total_score: data.total_score != null ? Number(data.total_score) : null,
        beat_rate: data.beat_rate != null ? Number(data.beat_rate) : null,
        notes: data.notes || null,
      };
    default:
      return data;
  }
}

export function AIChatPanel({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recentlyCreatedIds, setRecentlyCreatedIds] = useState<Array<{ table: string; id: string }>>([]);
  const [undoTimer, setUndoTimer] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-ai-chat", handler);
    return () => window.removeEventListener("open-ai-chat", handler);
  }, []);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { isDemo } = useDemoMode();
  const aiMode = settings?.ai_mode || "confirm";
  const { t, lang } = useLang();
  const moduleLabels = getModuleLabels(t);

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["ai_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_sessions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(MAX_SESSIONS);
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !isDemo,
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (sessions.length > MAX_SESSIONS) {
      const toDelete = sessions.slice(MAX_SESSIONS).map((s: any) => s.id);
      toDelete.forEach((id: string) => {
        supabase.from("ai_messages").delete().eq("session_id", id).then(() => {
          supabase.from("ai_sessions").delete().eq("id", id);
        });
      });
    }
  }, [sessions]);

  const loadSession = async (sessionId: string) => {
    const { data: msgs } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    setMessages(
      (msgs || []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        imageUrls: m.images || undefined,
        operations: m.actions ? (m.actions as any).operations : undefined,
        status: m.actions ? "executed" : undefined,
      }))
    );
    setCurrentSessionId(sessionId);
    setShowHistory(false);
  };

  const startNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
  };

  const saveMessage = async (sessionId: string, role: string, content: string, images?: string[], actions?: any) => {
    await supabase.from("ai_messages").insert({
      session_id: sessionId,
      role,
      content,
      images: images || null,
      actions: actions || null,
    });
    await supabase.from("ai_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
  };

  const ensureSession = async (firstMessage: string): Promise<string> => {
    if (currentSessionId) return currentSessionId;
    const title = firstMessage.slice(0, 50);
    const { data, error } = await supabase
      .from("ai_sessions")
      .insert({ title })
      .select()
      .single();
    if (error) throw error;
    setCurrentSessionId(data.id);
    refetchSessions();
    return data.id;
  };

  const addImageFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setImageFiles((prev) => [...prev, ...imageFiles]);
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addImageFiles(files);
    e.target.value = "";
  };

  const handlePaste = useClipboardImagePaste(addImageFiles);

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const executeOperations = useCallback(
    async (operations: Operation[]) => {
      let exchangeRate = 0.048;
      const hasFinanceJpy = operations.some(op => op.module === "finance" && op.data?.currency === "JPY");
      if (hasFinanceJpy) {
        const { data: settingsData } = await supabase.from("settings").select("exchange_rate_jpy_to_cny").limit(1).single();
        if (settingsData?.exchange_rate_jpy_to_cny) {
          exchangeRate = Number(settingsData.exchange_rate_jpy_to_cny);
        }
      }

      const results: string[] = [];
      const createdIds: Array<{ table: string; id: string }> = [];
      let hasError = false;

      const findTodo = async (match: { id?: string; title?: string; todo_id?: string }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const id = String(match.id || match.todo_id || "").trim();
        const title = String(match.title || "").trim();
        if (id) {
          const { data } = await (supabase.from as any)("todos")
            .select("id,title,kind,habit_type,habit_target,is_archived")
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (data) return data;
        }
        if (!title) return null;
        const { data } = await (supabase.from as any)("todos")
          .select("id,title,kind,habit_type,habit_target,is_archived")
          .eq("user_id", user.id)
          .eq("title", title)
          .order("is_archived", { ascending: true })
          .limit(1)
          .maybeSingle();
        return data;
      };

      for (const rawOp of operations) {
        let op: Operation = rawOp;
        if (op.module === "todo" && op.action === "update" && op.data?.update?.is_completed === true) {
          const parent = await findTodo(op.data.match || { title: op.data.title });
          op = rewriteCompleteOp(op, parent);
        }
        const table = tableOf(op.module);
        if (!table) {
          hasError = true;
          results.push(`${t("未知模块", "Unknown module")}: ${op.module}`);
          continue;
        }
        const mod = moduleByKey[op.module];
        const ex = mod?.executor;
        const label = moduleLabels[op.module] || op.module;
        const itemName = op.data.name || op.data.title || op.data.food_name || op.data.weight || op.data.match?.name || op.data.match?.title || "";
        try {
          if (op.action === "create") {
            // daily_task（今日待办）：优先用 todo_id 直接引用，否则按标题找/建 todo，再加入今天
            if (op.module === "daily_task") {
              const { data: { user: dtUser } } = await supabase.auth.getUser();
              if (!dtUser) throw new Error("未登录");
              const dtTitle = String(op.data.title || "").trim();
              const dtTodoId = String(op.data.todo_id || "").trim();
              if (!dtTitle && !dtTodoId) throw new Error("缺少任务标题 title 或 todo_id");
              const dtDiff = op.data.difficulty === "easy" || op.data.difficulty === "hard" ? op.data.difficulty : "medium";
              const dtPts = op.data.base_points != null ? Number(op.data.base_points)
                : dtDiff === "easy" ? 10 : dtDiff === "hard" ? 30 : 20;
              const dtToday = new Date().toISOString().split("T")[0];
              let dtTodo: any = null;
              // 1) 优先：直接引用已命中的 todo（校验归属）
              if (dtTodoId) {
                const { data: byId } = await (supabase.from as any)("todos")
                  .select("id,title,kind").eq("id", dtTodoId).eq("user_id", dtUser.id).maybeSingle();
                dtTodo = byId;
              }
              // 2) 兜底：按标题找现有 todo（未完成，优先未归档）；找不到则新建
              if (!dtTodo) {
                if (!dtTitle) throw new Error("缺少任务标题 title");
                const { data: byTitle } = await (supabase.from as any)("todos")
                  .select("id,title,kind")
                  .eq("user_id", dtUser.id)
                  .eq("title", dtTitle)
                  .eq("is_completed", false)
                  .order("is_archived", { ascending: true })
                  .limit(1).maybeSingle();
                dtTodo = byTitle;
                if (!dtTodo) {
                  const { data: newTodo, error: te } = await (supabase.from as any)("todos").insert({
                    user_id: dtUser.id, title: dtTitle, category: "未分类", importance: "普通",
                    kind: "once", is_completed: false, is_archived: false,
                  }).select().single();
                  if (te) throw te;
                  dtTodo = newTodo;
                  if (newTodo?.id) createdIds.push({ table: "todos", id: newTodo.id });
                }
              }
              const dtDisplay = dtTodo.title || dtTitle;
              if (shouldSkipDailyTask(dtTodo)) {
                results.push(`${label}: 「${dtDisplay}」${t("是习惯，已在今日顶部", "is a habit already pinned today")}`);
                continue;
              }
              // 已在今天则跳过（complete: true 时补勾）
              const { data: dtExist } = await (supabase.from as any)("daily_tasks")
                .select("id").eq("todo_id", dtTodo.id).eq("task_date", dtToday).maybeSingle();
              if (dtExist) {
                if (op.data.complete === true) {
                  await (supabase.from as any)("daily_tasks").update({
                    is_completed: true, completed_at: new Date().toISOString(),
                  }).eq("id", dtExist.id);
                  results.push(`${label}: ${t("已完成今日", "Completed today")}「${dtDisplay}」`);
                } else {
                  results.push(`${label}: 「${dtDisplay}」${t("已在今日待办", "already in today's list")}`);
                }
                continue;
              }
              const { data: dtRow, error: dtErr } = await (supabase.from as any)("daily_tasks").insert({
                user_id: dtUser.id, todo_id: dtTodo.id, task_date: dtToday,
                difficulty: dtDiff, base_points: dtPts,
                is_completed: op.data.complete === true,
                completed_at: op.data.complete === true ? new Date().toISOString() : null,
                metadata: {},
              }).select().single();
              if (dtErr) throw dtErr;
              if (dtRow?.id) createdIds.push({ table: "daily_tasks", id: dtRow.id });
              results.push(
                op.data.complete === true
                  ? `${label}: ${t("已加入今日并完成", "Added and completed")}「${dtDisplay}」`
                  : `${label}: ${t("已加入今日待办", "Added to today")}「${dtDisplay}」`,
              );
              continue;
            }

            if (op.module === "habit_log") {
              const { data: { user: logUser } } = await supabase.auth.getUser();
              if (!logUser) throw new Error("未登录");
              const habit = await findTodo({ id: op.data.todo_id, title: op.data.title });
              if (!habit || habit.kind !== "habit") throw new Error(`未找到习惯「${op.data.title || ""}」`);
              const logDate = new Date().toISOString().split("T")[0];
              const value = op.data.value != null ? Number(op.data.value) : 1;
              const { data: logRow, error: logErr } = await (supabase.from as any)("todo_habit_logs").upsert(
                {
                  user_id: logUser.id,
                  todo_id: habit.id,
                  log_date: logDate,
                  value,
                  broken: false,
                },
                { onConflict: "todo_id,log_date" },
              ).select().single();
              if (logErr) throw logErr;
              if (logRow?.id) createdIds.push({ table: "todo_habit_logs", id: logRow.id });
              results.push(`${label}: ${t("已记录打卡", "Logged check-in")}「${habit.title}」`);
              continue;
            }

            const row = mapOperationToRow(op.module, op.data, exchangeRate);

            if (op.module === "todo" && isPersistentKind(row.kind)) {
              const { data: { user: todoUser } } = await supabase.auth.getUser();
              if (todoUser) {
                const { data: dup } = await (supabase.from as any)("todos")
                  .select("id")
                  .eq("user_id", todoUser.id)
                  .eq("title", row.title)
                  .eq("kind", row.kind)
                  .eq("is_archived", false)
                  .limit(1)
                  .maybeSingle();
                if (dup) {
                  results.push(`${label}: 「${row.title}」${t("已存在，未重复创建", "already exists, skipped")}`);
                  continue;
                }
              }
            }

            if (ex?.needsUserId) {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("未登录");
              row.user_id = user.id;
            }

            if (op.module === "civil_exam" && row.is_primary) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from("civil_exams").update({ is_primary: false }).eq("user_id", user.id);
              }
            }

            // Foreign-key-by-name resolution (project_name → project_id, course_name → course_id, …)
            if (ex?.resolves) {
              const r = ex.resolves;
              const val = op.data[r.from];
              if (val == null || val === "") {
                if (r.required) throw new Error(`缺少${r.from}`);
              } else {
                const id = await resolveByName(r, String(val), !!r.required);
                if (id) row[r.toColumn] = id;
              }
            }

            const conflict = ex?.upsert;
            const { data: inserted, error } = conflict
              ? await (supabase.from as any)(table).upsert(row, { onConflict: conflict.join(",") }).select().single()
              : await (supabase.from as any)(table).insert(row).select().single();
            if (error) throw error;
            if (inserted?.id) createdIds.push({ table, id: inserted.id });
            results.push(`${label}: ${t("已添加", "Added")}「${itemName}」`);
          } else if (op.action === "delete") {
            // daily_task：按标题找到今天的任务并移出今日待办
            if (op.module === "daily_task") {
              const rmTitle = String(op.data.match?.title || op.data.title || "").trim();
              if (!rmTitle) throw new Error("缺少任务标题 title");
              const { data: { user: rmUser } } = await supabase.auth.getUser();
              if (!rmUser) throw new Error("未登录");
              const rmToday = new Date().toISOString().split("T")[0];
              const { data: rmTodo } = await (supabase.from as any)("todos")
                .select("id").eq("user_id", rmUser.id).eq("title", rmTitle).limit(1).maybeSingle();
              if (!rmTodo) throw new Error(`未找到任务「${rmTitle}」`);
              const { error: rmErr } = await (supabase.from as any)("daily_tasks")
                .delete().eq("todo_id", rmTodo.id).eq("task_date", rmToday);
              if (rmErr) throw rmErr;
              results.push(`${label}: ${t("已移出今日待办", "Removed from today")}「${rmTitle}」`);
              continue;
            }
            const match = op.data.match || {};
            const matchEntries = Object.entries(match).filter(([_, v]) => v !== undefined && v !== null && v !== "");

            if (ex?.resolves && match[ex.resolves.from] != null) {
              const id = await resolveByName(ex.resolves, String(match[ex.resolves.from]), false);
              if (id) match[ex.resolves.toColumn] = id;
              delete match[ex.resolves.from];
            }

            if (matchEntries.length === 0) {
              const searchName = op.data.name || op.data.title || op.data.food_name || "";
              if (!searchName) throw new Error("删除操作缺少匹配条件");
              const nameField = ex?.nameField ?? "title";
              const { data: found } = await (supabase.from as any)(table).select("id").ilike(nameField, `%${searchName}%`).limit(1).single();
              if (!found) throw new Error(`未找到匹配「${searchName}」的记录`);
              const { error } = await (supabase.from as any)(table).delete().eq("id", found.id);
              if (error) throw error;
            } else {
              if (match.id) {
                const { error } = await (supabase.from as any)(table).delete().eq("id", match.id);
                if (error) throw error;
              } else {
                let searchQuery = (supabase.from as any)(table).select("id");
                for (const [key, val] of Object.entries(match)) {
                  if (key.endsWith("_id")) {
                    searchQuery = searchQuery.eq(key, val);
                  } else {
                    searchQuery = searchQuery.ilike(key, `%${val}%`);
                  }
                }
                const { data: found } = await searchQuery.limit(1).single();
                if (!found) throw new Error(`未找到匹配的记录`);
                const { error } = await (supabase.from as any)(table).delete().eq("id", found.id);
                if (error) throw error;
              }
            }
            results.push(`${label}: ${t("已删除", "Deleted")}「${itemName}」`);
          } else if (op.action === "update" && op.data.match && op.data.update) {
            if (op.module === "todo") {
              const parent = await findTodo(op.data.match);
              if (isPersistentKind(parent?.kind) && Object.prototype.hasOwnProperty.call(op.data.update, "is_completed")) {
                const { is_completed: _ignored, ...rest } = op.data.update;
                if (Object.keys(rest).length === 0) {
                  results.push(`${label}: ${t("习惯/例行不能勾完成母卡", "Cannot complete habit/routine cards")}`);
                  continue;
                }
                op = { ...op, data: { ...op.data, update: rest } };
              }
            }
            const match = { ...op.data.match };

            if (ex?.resolves && match[ex.resolves.from] != null) {
              const id = await resolveByName(ex.resolves, String(match[ex.resolves.from]), false);
              if (id) match[ex.resolves.toColumn] = id;
              delete match[ex.resolves.from];
            }

            let searchQuery = (supabase.from as any)(table).select("id");
            for (const [key, val] of Object.entries(match)) {
              if (key.endsWith("_id")) {
                searchQuery = searchQuery.eq(key, val);
              } else {
                searchQuery = searchQuery.ilike(key, `%${val}%`);
              }
            }
            const { data: found } = await searchQuery.limit(1).single();
            if (!found) throw new Error(`未找到匹配的记录`);
            const { error } = await (supabase.from as any)(table).update(op.data.update).eq("id", found.id);
            if (error) throw error;
            results.push(`${label}: ${t("已更新", "Updated")}「${itemName}」`);
          } else {
            // Non-CRUD actions (e.g. a stray read_data the model misrouted) —
            // the edge function should have fulfilled reads server-side; silently
            // skip anything that isn't create/update/delete instead of erroring.
            continue;
          }
        } catch (e: any) {
          hasError = true;
          results.push(`${label}: ${e.message}`);
        }
      }

      for (const key of WRITE_QUERY_KEYS) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      for (const key of COMPOSITE_QUERY_KEYS) {
        qc.invalidateQueries({ queryKey: key });
      }

      return { results, createdIds, hasError };
    },
    [qc, t]
  );

  const handleUndo = async () => {
    if (recentlyCreatedIds.length === 0) return;
    for (const { table, id } of recentlyCreatedIds) {
      await (supabase.from as any)(table).delete().eq("id", id);
    }
    for (const key of WRITE_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    for (const key of COMPOSITE_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: key });
    }
    setRecentlyCreatedIds([]);
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(null);
    toast({ title: t("已撤销操作", "Operation undone") });
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && imageFiles.length === 0) || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const currentImages = [...imagePreviews];
    let contentRaw: MessageContent;
    if (currentImages.length > 0) {
      const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
      if (text) parts.push({ type: "text", text });
      currentImages.forEach((url) => {
        parts.push({ type: "image_url", image_url: { url } });
      });
      contentRaw = parts;
    } else {
      contentRaw = text;
    }

    const userMsg: Message = {
      role: "user",
      content: text || "(图片)",
      contentRaw,
      imageUrls: currentImages.length > 0 ? currentImages : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setImageFiles([]);
    setImagePreviews([]);
    setLoading(true);

    try {
      const sessionId = await ensureSession(text || "图片输入");

      await saveMessage(sessionId, "user", text || "(图片)", currentImages.length > 0 ? currentImages : undefined);

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.contentRaw || m.content,
          })),
          session_id: sessionId,
        },
      });

      const invokeMsg = await messageFromAiInvoke(data, error);
      if (invokeMsg) throw new Error(invokeMsg);

      const parsed = parseAgentChatContent({ result: data?.result, raw: data?.raw });
      const operations: Operation[] = parsed.operations || [];
      const summary: string = parsed.summary || "无法理解请求";

      if (operations.length > 0) {
        if (aiMode === "direct") {
          const { results: execResults, createdIds, hasError } = await executeOperations(operations);
          const assistantMsg: Message = {
            role: "assistant",
            content: `${summary}\n\n${execResults.join("\n")}`,
            operations,
            status: hasError ? "error" : "executed",
          };
          setMessages((prev) => [...prev, assistantMsg]);
          await saveMessage(sessionId, "assistant", assistantMsg.content, undefined, { operations });

          if (createdIds.length > 0) {
            setRecentlyCreatedIds(createdIds);
            const timer = window.setTimeout(() => {
              setRecentlyCreatedIds([]);
              setUndoTimer(null);
            }, 8000);
            setUndoTimer(timer);
          }

          toast({ title: t("AI 操作完成", "AI operation complete"), description: summary });
        } else {
          const previewLines = operations.map((op) => {
            const label = moduleLabels[op.module] || op.module;
            const action = { create: t("新增", "Create"), update: t("更新", "Update"), delete: t("删除", "Delete") }[op.action] || op.action;
            if ((op.module === "todo" && (op.data.kind === "habit" || op.data.kind === "routine")) || op.module === "habit_log") {
              return `• ${formatOpPreview(op, action, label)}`;
            }
            const name = op.data.name || op.data.title || op.data.food_name || op.data.match?.name || op.data.match?.title || "";
            return `• ${action} ${label}「${name}」`;
          });
          const assistantMsg: Message = {
            role: "assistant",
            content: `${summary}\n\n${t("将执行以下操作：", "Will execute:")}\n${previewLines.join("\n")}`,
            operations,
            status: "preview",
          };
          setMessages((prev) => [...prev, assistantMsg]);
          await saveMessage(sessionId, "assistant", assistantMsg.content, undefined, { operations, preview: true });
        }
      } else {
        const assistantMsg: Message = { role: "assistant", content: summary };
        setMessages((prev) => [...prev, assistantMsg]);
        await saveMessage(sessionId, "assistant", summary);
      }

      refetchSessions();
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: e.message },
      ]);
      toast({ title: t("AI 调用失败", "AI call failed"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExecute = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.operations) return;
    setLoading(true);
    try {
      const { results: execResults, hasError } = await executeOperations(msg.operations);
      const updatedMsg: Message = {
        ...msg,
        content: `${sanitizeAssistantContent(msg.content.split(/\n\n将执行以下操作|\n\nWill execute:/)[0])}\n\n${execResults.join("\n")}`,
        status: hasError ? "error" : "executed",
      };
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? updatedMsg : m)));
      toast({ title: t("操作已执行", "Operation executed") });
    } catch (e: any) {
      toast({ title: t("执行失败", "Execution failed"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    await supabase.from("ai_messages").delete().eq("session_id", sessionId);
    await supabase.from("ai_sessions").delete().eq("id", sessionId);
    if (currentSessionId === sessionId) {
      startNewSession();
    }
    refetchSessions();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus trap for accessible dialog navigation
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const container = dialogRef.current;
    if (!container) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const currentFocusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

      if (currentFocusables.length === 0) return;
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleTabKey);
    return () => window.removeEventListener("keydown", handleTabKey);
  }, [isOpen, showHistory]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        aria-label={t("打开 AI 助手", "Open AI Assistant")}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <>
      {/* 遮罩：点击外部关闭 */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={() => setIsOpen(false)}
      />
      {/* 居中弹窗 */}
      <div
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[720px] max-w-[calc(100vw-2rem)] h-[800px] max-h-[calc(100vh-4rem)] bg-card border border-border rounded-xl shadow-[var(--shadow-overlay)] flex flex-col overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("AI 助手", "AI Assistant")}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm text-foreground">{t("AI 助手", "AI Assistant")}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {aiMode === "direct" ? t("直接模式", "Direct mode") : t("确认模式", "Confirm mode")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setShowHistory(!showHistory)} aria-label={t("历史会话", "History")} title={t("历史会话", "History")}>
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={startNewSession} aria-label={t("新对话", "New chat")} title={t("新对话", "New chat")}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setIsOpen(false)} aria-label={t("关闭", "Close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-2">{lang === "zh" ? `最近 ${sessions.length} 个会话` : `${sessions.length} recent sessions`}</p>
          {sessions.map((s: any) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={s.title || t("无标题", "Untitled")}
              className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors ${
                currentSessionId === s.id ? "bg-muted font-medium" : ""
              }`}
              onClick={() => loadSession(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  loadSession(s.id);
                }
              }}
            >
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm truncate text-foreground">{s.title || t("无标题", "Untitled")}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(s.updated_at), "MM/dd HH:mm")}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("删除会话", "Delete session")}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t("暂无历史会话", "No history")}</p>}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
                <Bot className="h-10 w-10 mx-auto opacity-30" />
                <p>{t("试试说：", "Try saying:")}</p>
                <div className="space-y-1 text-xs">
                  <p className="bg-muted rounded-lg px-3 py-1.5 font-normal">"午饭吃了拉面，花了30元，大概600卡"</p>
                  <p className="bg-muted rounded-lg px-3 py-1.5 font-normal">"明天下午3点开会，大概1小时"</p>
                  <p className="bg-muted rounded-lg px-3 py-1.5 flex items-center justify-center gap-1.5 font-normal"><Camera className="h-4 w-4 shrink-0" />{t("拍小票自动识别记账", "Snap receipt for auto-expense")}</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex animate-stream-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap transition-colors ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="flex gap-1 mb-1 flex-wrap">
                      {msg.imageUrls.map((url, idx) => (
                        <img key={idx} src={url} alt="上传图片" className="h-16 w-16 object-cover rounded" />
                      ))}
                    </div>
                  )}
                  {sanitizeAssistantContent(msg.content)}
                  {msg.status === "executed" && (
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                      <Check className="h-3 w-3" /> {t("已执行", "Executed")}
                    </div>
                  )}
                  {msg.status === "error" && (
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                      <AlertCircle className="h-3 w-3" /> {t("部分失败", "Partial failure")}
                    </div>
                  )}
                  {msg.status === "preview" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => handleConfirmExecute(i)} disabled={loading}>
                        <Check className="h-3 w-3 mr-1" /> {t("确认执行", "Confirm")}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:bg-muted" onClick={() => {
                        setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, status: undefined, content: m.content + `\n\n${t("已取消", "Cancelled")}` } : m));
                      }}>
                        {t("取消", "Cancel")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-stream-in">
                <div className="bg-muted rounded-lg px-3 py-2.5 flex items-end gap-[3px] h-8">
                  {[0, 1, 2].map((b) => (
                    <span
                      key={b}
                      className="w-[3px] rounded-full bg-primary animate-eq-bounce"
                      style={{ height: "100%", transformOrigin: "bottom", animationDelay: `${b * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Undo bar */}
          {recentlyCreatedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("刚刚执行了操作", "Operation just executed")}</span>
              <Button size="sm" variant="secondary" className="h-7 text-xs bg-background border border-border text-foreground hover:bg-muted" onClick={handleUndo}>
                <Undo2 className="h-3 w-3 mr-1" /> {t("撤销", "Undo")}
              </Button>
            </div>
          )}

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="px-3 py-1 border-t border-border flex gap-1 flex-wrap">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-12 w-12 object-cover rounded" />
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-6 w-6 min-h-[24px] min-w-[24px] flex items-center justify-center text-[10px]"
                    onClick={() => removeImage(i)}
                    aria-label={t("移除图片", "Remove image")}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border shrink-0">
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("添加图片", "Attach image")}
              >
                <Image className="h-4 w-4" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 200) + "px";
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("描述你要记录的内容...（可粘贴图片）", "Describe what to record... (paste images)")}
                className="flex-1 text-sm min-h-[36px] max-h-[200px] resize-y py-2 overflow-y-auto border-border focus-visible:ring-primary/20"
                rows={1}
                disabled={loading}
                aria-label={t("消息输入", "Message input")}
              />
              <Button
                type="button"
                size="icon"
                disabled={loading || (!input.trim() && imageFiles.length === 0)}
                className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSend}
                aria-label={t("发送", "Send")}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}
