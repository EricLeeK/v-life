import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Bot, X, Send, Loader2, Check, AlertCircle, Image, Plus, History, Trash2, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/hooks/useData";

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
};

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
      // AI outputs times like "2026-03-31T14:00:00" meaning local time
      // We must convert to proper ISO with timezone so DB stores correctly
      const parseLocalTime = (t: string) => {
        if (!t) return new Date().toISOString();
        // If already has timezone info (Z or +/-), use as-is
        if (/[Zz]$/.test(t) || /[+-]\d{2}:\d{2}$/.test(t)) return t;
        // Parse as local time: "2026-03-31T14:00:00" → new Date(2026, 2, 31, 14, 0, 0)
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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const aiMode = settings?.ai_mode || "confirm";

  // Fetch sessions
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

  // Auto-resize textarea based on content
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

  // Cleanup old sessions beyond limit
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
    // Update session timestamp
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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
    addImageFiles(files);
  }, [addImageFiles]);

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

      for (const op of operations) {
        const table = MODULE_TABLE_MAP[op.module];
        if (!table) {
          results.push(`❌ 未知模块: ${op.module}`);
          continue;
        }
        const label = MODULE_LABELS[op.module] || op.module;
        const itemName = op.data.name || op.data.title || op.data.food_name || op.data.weight || op.data.match?.name || op.data.match?.title || "";
        try {
          if (op.action === "create") {
            const row = mapOperationToRow(op.module, op.data, exchangeRate);
            // Use upsert for weight and measurement (unique per user+date)
            const useUpsert = op.module === "weight" || op.module === "measurement";
            const { data: inserted, error } = useUpsert
              ? await (supabase.from as any)(table).upsert(row, { onConflict: "user_id,date" }).select().single()
              : await (supabase.from as any)(table).insert(row).select().single();
            if (error) throw error;
            if (inserted?.id) createdIds.push({ table, id: inserted.id });
            results.push(`✅ ${label}: 已添加「${itemName}」`);
          } else if (op.action === "delete") {
            const match = op.data.match || {};
            const matchEntries = Object.entries(match).filter(([_, v]) => v !== undefined && v !== null && v !== "");
            if (matchEntries.length === 0) {
              // Try to find by name/title from op.data
              const searchName = op.data.name || op.data.title || op.data.food_name || "";
              if (!searchName) throw new Error("删除操作缺少匹配条件");
              const nameField = ["calorie_records"].includes(table) ? "food_name" : 
                               ["finance_records", "pantry_items", "belongings_daily", "belongings_durable"].includes(table) ? "name" : "title";
              const { data: found } = await (supabase.from as any)(table).select("id").ilike(nameField, `%${searchName}%`).limit(1).single();
              if (!found) throw new Error(`未找到匹配「${searchName}」的记录`);
              const { error } = await (supabase.from as any)(table).delete().eq("id", found.id);
              if (error) throw error;
            } else {
              // If match has an id, use it directly; otherwise search first then delete by id
              if (match.id) {
                const { error } = await (supabase.from as any)(table).delete().eq("id", match.id);
                if (error) throw error;
              } else {
                let searchQuery = (supabase.from as any)(table).select("id");
                for (const [key, val] of matchEntries) {
                  searchQuery = searchQuery.ilike(key, `%${val}%`);
                }
                const { data: found } = await searchQuery.limit(1).single();
                if (!found) throw new Error(`未找到匹配的记录`);
                const { error } = await (supabase.from as any)(table).delete().eq("id", found.id);
                if (error) throw error;
              }
            }
            results.push(`✅ ${label}: 已删除「${itemName}」`);
          } else if (op.action === "update" && op.data.match && op.data.update) {
            let query = (supabase.from as any)(table).update(op.data.update);
            for (const [key, val] of Object.entries(op.data.match)) {
              query = query.eq(key, val);
            }
            const { error } = await query;
            if (error) throw error;
            results.push(`✅ ${label}: 已更新「${itemName}」`);
          } else {
            results.push(`⚠️ ${label}: 不支持的操作 ${op.action}`);
          }
        } catch (e: any) {
          results.push(`❌ ${label}: ${e.message}`);
        }
      }

      for (const key of ["calories", "finance", "todos", "schedule", "pantry", "thoughts", "belongings", "weight_records", "measurement_records", "goals"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      // Also invalidate dashboard queries
      qc.invalidateQueries({ queryKey: ["schedule", "today"] });
      qc.invalidateQueries({ queryKey: ["calories", "today_summary"] });
      qc.invalidateQueries({ queryKey: ["finance", "summary"] });
      qc.invalidateQueries({ queryKey: ["todos", "pending"] });

      return { results, createdIds };
    },
    [qc]
  );

  const handleUndo = async () => {
    if (recentlyCreatedIds.length === 0) return;
    for (const { table, id } of recentlyCreatedIds) {
      await (supabase.from as any)(table).delete().eq("id", id);
    }
    for (const key of ["calories", "finance", "todos", "schedule", "pantry", "thoughts", "belongings"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    setRecentlyCreatedIds([]);
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(null);
    toast({ title: "已撤销操作" });
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && imageFiles.length === 0) || loading) return;
    setInput("");
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";

    // Build message content
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

      // Save user message
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

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.result;
      const operations: Operation[] = result?.operations || [];
      const summary: string = result?.summary || data?.raw || "无法理解请求";

      if (operations.length > 0) {
        if (aiMode === "direct") {
          // Direct mode: execute immediately, show undo button
          const { results: execResults, createdIds } = await executeOperations(operations);
          const assistantMsg: Message = {
            role: "assistant",
            content: `${summary}\n\n${execResults.join("\n")}`,
            operations,
            status: execResults.every((r) => r.startsWith("✅")) ? "executed" : "error",
          };
          setMessages((prev) => [...prev, assistantMsg]);
          await saveMessage(sessionId, "assistant", assistantMsg.content, undefined, { operations });

          // Set undo timer for created items
          if (createdIds.length > 0) {
            setRecentlyCreatedIds(createdIds);
            const timer = window.setTimeout(() => {
              setRecentlyCreatedIds([]);
              setUndoTimer(null);
            }, 8000);
            setUndoTimer(timer);
          }

          toast({ title: "AI 操作完成", description: summary });
        } else {
          // Confirm mode: show preview first
          const previewLines = operations.map((op) => {
            const label = MODULE_LABELS[op.module] || op.module;
            const action = { create: "新增", update: "更新", delete: "删除" }[op.action] || op.action;
            const name = op.data.name || op.data.title || op.data.food_name || op.data.match?.name || op.data.match?.title || "";
            return `• ${action} ${label}「${name}」`;
          });
          const assistantMsg: Message = {
            role: "assistant",
            content: `${summary}\n\n将执行以下操作：\n${previewLines.join("\n")}`,
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
        { role: "assistant", content: `⚠️ ${e.message}` },
      ]);
      toast({ title: "AI 调用失败", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExecute = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.operations) return;
    setLoading(true);
    try {
      const { results: execResults } = await executeOperations(msg.operations);
      const updatedMsg: Message = {
        ...msg,
        content: `${msg.content.split("\n\n将执行以下操作")[0]}\n\n${execResults.join("\n")}`,
        status: execResults.every((r) => r.startsWith("✅")) ? "executed" : "error",
      };
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? updatedMsg : m)));
      toast({ title: "操作已执行" });
    } catch (e: any) {
      toast({ title: "执行失败", description: e.message, variant: "destructive" });
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
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">AI 助手</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {aiMode === "direct" ? "直接" : "确认"}模式
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)} title="历史会话">
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewSession} title="新对话">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* Session history list */
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-2">最近 {sessions.length} 个会话</p>
          {sessions.map((s: any) => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                currentSessionId === s.id ? "bg-muted" : ""
              }`}
              onClick={() => loadSession(s.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{s.title || "无标题"}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(s.updated_at), "MM/dd HH:mm")}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无历史会话</p>}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
                <Bot className="h-10 w-10 mx-auto opacity-30" />
                <p>试试说：</p>
                <div className="space-y-1 text-xs">
                  <p className="bg-muted/50 rounded px-2 py-1">"午饭吃了拉面，花了30元，大概600卡"</p>
                  <p className="bg-muted/50 rounded px-2 py-1">"明天下午3点开会，大概1小时"</p>
                  <p className="bg-muted/50 rounded px-2 py-1">📷 拍小票自动识别记账</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {/* Show images if any */}
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
                      <Check className="h-3 w-3" /> 已执行
                    </div>
                  )}
                  {msg.status === "error" && (
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                      <AlertCircle className="h-3 w-3" /> 部分失败
                    </div>
                  )}
                  {msg.status === "preview" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleConfirmExecute(i)} disabled={loading}>
                        <Check className="h-3 w-3 mr-1" /> 确认执行
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, status: undefined, content: m.content + "\n\n❌ 已取消" } : m));
                      }}>
                        取消
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Undo bar */}
          {recentlyCreatedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">刚刚执行了操作</span>
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleUndo}>
                <Undo2 className="h-3 w-3 mr-1" /> 撤销
              </Button>
            </div>
          )}

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="px-3 py-1 border-t border-border flex gap-1 flex-wrap">
              {imagePreviews.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-12 w-12 object-cover rounded" />
                  <button className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px]"
                    onClick={() => removeImage(i)}>×</button>
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
              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => fileInputRef.current?.click()}>
                <Image className="h-4 w-4" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
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
                placeholder="描述你要记录的内容...（可粘贴图片）"
                className="flex-1 text-sm min-h-[36px] max-h-[200px] resize-y py-2 overflow-y-auto"
                rows={1}
                disabled={loading}
              />
              <Button type="button" size="icon" disabled={loading || (!input.trim() && imageFiles.length === 0)} className="shrink-0" onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
