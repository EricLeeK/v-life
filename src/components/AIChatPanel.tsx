import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, X, Send, Loader2, Check, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type Message = {
  role: "user" | "assistant";
  content: string;
  operations?: Operation[];
  status?: "pending" | "executed" | "error";
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
};

// Map AI operation data to actual table columns
function mapOperationToRow(module: string, data: Record<string, any>): Record<string, any> {
  const today = format(new Date(), "yyyy-MM-dd");

  switch (module) {
    case "finance":
      return {
        name: data.name || data.title || "未命名",
        amount: Number(data.amount) || 0,
        currency: data.currency || "CNY",
        category: data.category || "其他",
        date: data.date || today,
        amount_cny: data.currency === "JPY" ? Number(data.amount) * 0.048 : Number(data.amount),
        exchange_rate: data.currency === "JPY" ? 0.048 : 1,
        notes: data.notes || null,
      };
    case "calories":
      return {
        food_name: data.food_name || data.name || "未命名",
        calories: Number(data.calories) || 0,
        meal_type: data.meal_type || "lunch",
        date: data.date || today,
        notes: data.notes || null,
      };
    case "schedule":
      return {
        title: data.title || "未命名事件",
        start_time: data.start_time || new Date().toISOString(),
        end_time: data.end_time || new Date(Date.now() + 3600000).toISOString(),
        importance: data.importance || "普通",
        status: "未开始",
        notes: data.notes || null,
      };
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
    default:
      return data;
  }
}

export function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const executeOperations = useCallback(
    async (operations: Operation[]) => {
      const results: string[] = [];
      for (const op of operations) {
        const table = MODULE_TABLE_MAP[op.module];
        if (!table) {
          results.push(`❌ 未知模块: ${op.module}`);
          continue;
        }
        const label = MODULE_LABELS[op.module] || op.module;
        const itemName = op.data.name || op.data.title || op.data.food_name || op.data.match?.name || op.data.match?.title || "";
        try {
          if (op.action === "create") {
            const row = mapOperationToRow(op.module, op.data);
            const { error } = await (supabase.from as any)(table).insert(row);
            if (error) throw error;
            results.push(`✅ ${label}: 已添加「${itemName}」`);
          } else if (op.action === "delete" && op.data.match) {
            let query = (supabase.from as any)(table).delete();
            for (const [key, val] of Object.entries(op.data.match)) {
              query = query.eq(key, val);
            }
            const { error, count } = await query;
            if (error) throw error;
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
      // Invalidate all relevant queries
      for (const key of ["calories", "finance", "todos", "schedule", "pantry", "thoughts", "belongings"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      return results;
    },
    [qc]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.result;
      const operations: Operation[] = result?.operations || [];
      const summary: string = result?.summary || data?.raw || "无法理解请求";

      if (operations.length > 0) {
        // Execute operations
        const execResults = await executeOperations(operations);
        const assistantMsg: Message = {
          role: "assistant",
          content: `${summary}\n\n${execResults.join("\n")}`,
          operations,
          status: execResults.every((r) => r.startsWith("✅")) ? "executed" : "error",
        };
        setMessages((prev) => [...prev, assistantMsg]);
        toast({ title: "AI 操作完成", description: summary });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: summary },
        ]);
      }
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
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">AI 助手</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
            <Bot className="h-10 w-10 mx-auto opacity-30" />
            <p>试试说：</p>
            <div className="space-y-1 text-xs">
              <p className="bg-muted/50 rounded px-2 py-1">"午饭吃了拉面，花了30元，大概600卡"</p>
              <p className="bg-muted/50 rounded px-2 py-1">"明天下午3点开会，大概1小时"</p>
              <p className="bg-muted/50 rounded px-2 py-1">"买了洗发水和牙膏"</p>
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

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="描述你要记录的内容..."
            className="flex-1 text-sm"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
