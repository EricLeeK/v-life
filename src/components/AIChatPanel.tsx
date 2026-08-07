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
import { messageFromAiInvoke } from "@/lib/aiErrors";
import { useClipboardImagePaste } from "@/hooks/useClipboardImagePaste";

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

const MODULE_TABLE_MAP: Record<string, string> = {
  finance: "finance_records",
  calories: "calorie_records",
  schedule: "schedule_events",
  todo: "todos",
  pantry: "pantry_items",
  thought: "thoughts",
  belongings_daily: "belongings_daily",
  belongings_durable: "belongings_durable",
  weight: "weight_records",
  measurement: "measurement_records",
  goal: "goals",
  project: "projects",
  project_task: "project_tasks",
  learning_course: "learning_courses",
  learning_note: "learning_notes",
  civil_exam: "civil_exams",
  civil_plan: "civil_plan_items",
  civil_checkin: "civil_checkins",
  civil_wrong: "civil_wrong_answers",
  civil_xingce_paper: "civil_xingce_papers",
};

const MODULE_LABELS: Record<string, string> = {
  finance: "记账",
  calories: "热量",
  schedule: "日程",
  todo: "待办",
  pantry: "食材",
  thought: "随想",
  belongings_daily: "日用品",
  belongings_durable: "耐用品",
  weight: "体重",
  measurement: "围度",
  goal: "目标",
  project: "项目",
  project_task: "项目任务",
  learning_course: "课程",
  learning_note: "学习笔记",
  civil_exam: "考公考试",
  civil_plan: "考公计划",
  civil_checkin: "考公打卡",
  civil_wrong: "考公错题",
  civil_xingce_paper: "行测套卷",
};

const getModuleLabels = (t: (zh: string, en: string) => string) => ({
  finance: t("记账", "Finance"), calories: t("热量", "Calories"), schedule: t("日程", "Schedule"),
  todo: t("待办", "To-Do"), pantry: t("食材", "Pantry"), thought: t("随想", "Thought"),
  belongings_daily: t("日用品", "Daily"), belongings_durable: t("耐用品", "Durable"),
  weight: t("体重", "Weight"), measurement: t("围度", "Measurement"),
  goal: t("目标", "Goal"), project: t("项目", "Project"), project_task: t("项目任务", "Task"),
  learning_course: t("课程", "Course"), learning_note: t("学习笔记", "Learning Note"),
  civil_exam: t("考公考试", "Civil Exam"), civil_plan: t("考公计划", "Civil Plan"),
  civil_checkin: t("考公打卡", "Civil Check-in"), civil_wrong: t("考公错题", "Civil Wrong"),
  civil_xingce_paper: t("行测套卷", "Xingce Paper"),
});

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
    case "todo":
      return {
        title: data.title || "未命名待办",
        category: data.category || "未分类",
        importance: data.importance || "普通",
        detail: data.detail || null,
        is_completed: false,
      };
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
        color: data.color || "#5b88b5",
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

export function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
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
    enabled: isOpen,
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

      for (const op of operations) {
        const table = MODULE_TABLE_MAP[op.module];
        if (!table) {
          hasError = true;
          results.push(`${t("未知模块", "Unknown module")}: ${op.module}`);
          continue;
        }
        const label = moduleLabels[op.module] || op.module;
        const itemName = op.data.name || op.data.title || op.data.food_name || op.data.weight || op.data.match?.name || op.data.match?.title || "";
        try {
          if (op.action === "create") {
            const row = mapOperationToRow(op.module, op.data, exchangeRate);

            if (op.module === "project" || op.module === "learning_course" || op.module === "civil_exam" || op.module === "civil_plan" || op.module === "civil_checkin" || op.module === "civil_wrong" || op.module === "civil_xingce_paper") {
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

            if (op.module === "project_task") {
              const projectName = op.data.project_name;
              if (!projectName) throw new Error("缺少项目名称 project_name");
              const { data: proj } = await (supabase.from as any)("projects")
                .select("id")
                .ilike("name", `%${projectName}%`)
                .limit(1)
                .single();
              if (!proj) throw new Error(`未找到项目「${projectName}」`);
              row.project_id = proj.id;
            }

            const useUpsert = op.module === "weight" || op.module === "measurement" || op.module === "civil_checkin";
            const { data: inserted, error } = useUpsert
              ? await (supabase.from as any)(table).upsert(row, { onConflict: "user_id,date" }).select().single()
              : await (supabase.from as any)(table).insert(row).select().single();
            if (error) throw error;
            if (inserted?.id) createdIds.push({ table, id: inserted.id });
            results.push(`${label}: ${t("已添加", "Added")}「${itemName}」`);
          } else if (op.action === "delete") {
            const match = op.data.match || {};
            const matchEntries = Object.entries(match).filter(([_, v]) => v !== undefined && v !== null && v !== "");

            if (op.module === "project_task" && match.project_name) {
              const { data: proj } = await (supabase.from as any)("projects")
                .select("id")
                .ilike("name", `%${match.project_name}%`)
                .limit(1)
                .single();
              if (proj) {
                match.project_id = proj.id;
              }
              delete match.project_name;
            }

            if (matchEntries.length === 0) {
              const searchName = op.data.name || op.data.title || op.data.food_name || "";
              if (!searchName) throw new Error("删除操作缺少匹配条件");
              const nameField = ["calorie_records"].includes(table) ? "food_name" :
                               ["finance_records", "pantry_items", "belongings_daily", "belongings_durable"].includes(table) ? "name" : "title";
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
                for (const [key, val] of Object.entries(match).filter(([k]) => k !== "project_name")) {
                  if (key === "project_id") {
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
            const match = { ...op.data.match };

            if (op.module === "project_task" && match.project_name) {
              const { data: proj } = await (supabase.from as any)("projects")
                .select("id")
                .ilike("name", `%${match.project_name}%`)
                .limit(1)
                .single();
              if (proj) {
                match.project_id = proj.id;
              }
              delete match.project_name;
            }

            let searchQuery = (supabase.from as any)(table).select("id");
            for (const [key, val] of Object.entries(match)) {
              if (key === "project_id") {
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
            hasError = true;
            results.push(`${label}: ${t("不支持的操作", "Unsupported action")} ${op.action}`);
          }
        } catch (e: any) {
          hasError = true;
          results.push(`${label}: ${e.message}`);
        }
      }

      for (const key of ["calories", "finance", "todos", "schedule", "pantry", "thoughts", "belongings", "weight_records", "measurement_records", "goals", "projects", "project_tasks", "learning_courses", "learning_notes", "civil_exams", "civil_plan_items", "civil_checkins", "civil_wrong_answers", "civil_xingce_papers"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      qc.invalidateQueries({ queryKey: ["schedule", "today"] });
      qc.invalidateQueries({ queryKey: ["calories", "today_summary"] });
      qc.invalidateQueries({ queryKey: ["finance", "summary"] });
      qc.invalidateQueries({ queryKey: ["todos", "pending"] });

      return { results, createdIds, hasError };
    },
    [qc, t]
  );

  const handleUndo = async () => {
    if (recentlyCreatedIds.length === 0) return;
    for (const { table, id } of recentlyCreatedIds) {
      await (supabase.from as any)(table).delete().eq("id", id);
    }
    for (const key of ["calories", "finance", "todos", "schedule", "pantry", "thoughts", "belongings", "projects", "project_tasks", "learning_courses", "learning_notes", "civil_exams", "civil_plan_items", "civil_checkins", "civil_wrong_answers", "civil_xingce_papers"]) {
      qc.invalidateQueries({ queryKey: [key] });
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

      const result = data?.result;
      const operations: Operation[] = result?.operations || [];
      const summary: string = result?.summary || data?.raw || "无法理解请求";

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
        content: `${msg.content.split("\n\n将执行以下操作")[0]}\n\n${execResults.join("\n")}`,
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

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-12 w-12 rounded-full bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white shadow-lg"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-white border border-[#e4e1d7] rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e4e1d7] bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#8b7bb8]" />
          <span className="font-medium text-sm text-[#1f1a14]">{t("AI 助手", "AI Assistant")}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f4f3ee] text-[#8a847a]">
            {aiMode === "direct" ? t("直接模式", "Direct mode") : t("确认模式", "Confirm mode")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8a847a] hover:text-[#1f1a14] hover:bg-[#f4f3ee]" onClick={() => setShowHistory(!showHistory)} title="历史会话">
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8a847a] hover:text-[#1f1a14] hover:bg-[#f4f3ee]" onClick={startNewSession} title="新对话">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8a847a] hover:text-[#1f1a14] hover:bg-[#f4f3ee]" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs text-[#8a847a] mb-2">{lang === "zh" ? `最近 ${sessions.length} 个会话` : `${sessions.length} recent sessions`}</p>
          {sessions.map((s: any) => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-[#f4f3ee] transition-colors ${
                currentSessionId === s.id ? "bg-[#f4f3ee]" : ""
              }`}
              onClick={() => loadSession(s.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate text-[#1f1a14]">{s.title || t("无标题", "Untitled")}</p>
                <p className="text-[10px] text-[#8a847a]">{format(new Date(s.updated_at), "MM/dd HH:mm")}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-[#8a847a] hover:text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-[#8a847a] text-center py-4">{t("暂无历史会话", "No history")}</p>}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-[#8a847a] text-sm py-8 space-y-2">
                <Bot className="h-10 w-10 mx-auto opacity-30" />
                <p>{t("试试说：", "Try saying:")}</p>
                <div className="space-y-1 text-xs">
                  <p className="bg-[#f4f3ee] rounded-lg px-3 py-1.5">"午饭吃了拉面，花了30元，大概600卡"</p>
                  <p className="bg-[#f4f3ee] rounded-lg px-3 py-1.5">"明天下午3点开会，大概1小时"</p>
                  <p className="bg-[#f4f3ee] rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Camera className="h-4 w-4 shrink-0" />{t("拍小票自动识别记账", "Snap receipt for auto-expense")}</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#1f1a14] text-white"
                      : "bg-[#f4f3ee] text-[#1f1a14]"
                  }`}
                >
                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="flex gap-1 mb-1 flex-wrap">
                      {msg.imageUrls.map((url, idx) => (
                        <img key={idx} src={url} alt="上传图片" className="h-16 w-16 object-cover rounded" />
                      ))}
                    </div>
                  )}
                  {msg.content}
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
                      <Button size="sm" className="h-7 text-xs bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white" onClick={() => handleConfirmExecute(i)} disabled={loading}>
                        <Check className="h-3 w-3 mr-1" /> {t("确认执行", "Confirm")}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-[#8a847a] hover:bg-[#f4f3ee]" onClick={() => {
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
              <div className="flex justify-start">
                <div className="bg-[#f4f3ee] rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#8a847a]" />
                </div>
              </div>
            )}
          </div>

          {/* Undo bar */}
          {recentlyCreatedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-[#e4e1d7] bg-[#f4f3ee] flex items-center justify-between">
              <span className="text-xs text-[#8a847a]">{t("刚刚执行了操作", "Operation just executed")}</span>
              <Button size="sm" variant="secondary" className="h-7 text-xs bg-white border border-[#e4e1d7] text-[#1f1a14] hover:bg-[#f4f3ee]" onClick={handleUndo}>
                <Undo2 className="h-3 w-3 mr-1" /> {t("撤销", "Undo")}
              </Button>
            </div>
          )}

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="px-3 py-1 border-t border-[#e4e1d7] flex gap-1 flex-wrap">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-12 w-12 object-cover rounded" />
                  <button className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                    onClick={() => removeImage(i)}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-[#e4e1d7] shrink-0">
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-[#8a847a] hover:text-[#1f1a14] hover:bg-[#f4f3ee]" onClick={() => fileInputRef.current?.click()}>
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
                className="flex-1 text-sm min-h-[36px] max-h-[200px] resize-y py-2 overflow-y-auto border-[#e4e1d7] focus-visible:ring-[#1f1a14]/20"
                rows={1}
                disabled={loading}
              />
              <Button type="button" size="icon" disabled={loading || (!input.trim() && imageFiles.length === 0)} className="shrink-0 bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white" onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
