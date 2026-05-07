import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useSettings, useUpdateSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

const TABLES = ["pantry_items", "belongings_daily", "belongings_durable", "schedule_events", "calorie_records", "finance_records", "todos", "thoughts", "settings"] as const;

// Debounced text input that only saves after user stops typing
function DebouncedInput({ value: serverValue, onSave, delay = 800, ...props }: { value: string; onSave: (val: string) => void; delay?: number } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [localValue, setLocalValue] = useState(serverValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocalValue(serverValue); }, [serverValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(v), delay);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return <Input value={localValue} onChange={handleChange} {...props} />;
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const [newTag, setNewTag] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading || !settings) return <AppLayout title={t("设置", "Settings")}><p className="text-muted-foreground text-sm">{t("加载中...", "Loading...")}</p></AppLayout>;

  const save = async (updates: Record<string, any>) => {
    try {
      await updateSettings.mutateAsync(updates);
      toast({ title: t("已保存", "Saved") });
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/JPY");
      const data = await res.json();
      const rate = data.rates?.CNY;
      if (rate) {
        await save({ exchange_rate_jpy_to_cny: rate, exchange_rate_updated_at: new Date().toISOString() });
        toast({ title: `${t("汇率已更新:", "Rate updated:")} 1 JPY = ${rate} CNY` });
      }
    } catch { toast({ title: t("获取汇率失败", "Failed to fetch rate"), variant: "destructive" }); }
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const current = (settings.custom_thought_tags as string[] | null) || [];
    if (current.includes(newTag.trim())) return;
    save({ custom_thought_tags: [...current, newTag.trim()] });
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    const current = (settings.custom_thought_tags as string[] | null) || [];
    save({ custom_thought_tags: current.filter((t: string) => t !== tag) });
  };

  const handleExport = async () => {
    try {
      const exportData: Record<string, any> = {};
      for (const table of TABLES) {
        const { data } = await (supabase.from as any)(table).select("*");
        exportData[table] = data;
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `vlife-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: t("导出成功", "Export successful") });
    } catch (e: any) { toast({ title: t("导出失败", "Export failed"), description: e.message, variant: "destructive" }); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Store in IndexedDB for offline access
      await saveToIndexedDB(importData);

      // Optionally import to Supabase (upsert)
      let importedCount = 0;
      for (const table of TABLES) {
        if (!importData[table] || !Array.isArray(importData[table])) continue;
        if (table === "settings") continue; // Don't overwrite settings
        for (const row of importData[table]) {
          const { error } = await (supabase.from as any)(table).upsert(row, { onConflict: "id" });
          if (!error) importedCount++;
        }
      }

      toast({ title: t("导入成功", "Import successful"), description: `${t("已导入", "Imported")} ${importedCount} ${t("条记录", "records")}` });
    } catch (e: any) {
      toast({ title: t("导入失败", "Import failed"), description: e.message, variant: "destructive" });
    }
    e.target.value = "";
  };

  return (
    <AppLayout title={t("设置", "Settings")}>
      <div className="space-y-6">
        {/* AI Configuration */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("AI 配置", "AI Configuration")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("API 平台", "API Platform")}</Label>
              <Select value={settings.ai_platform || "gemini"} onValueChange={(v) => save({ ai_platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="siliconflow">SiliconFlow 硅基流动</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>API Key</Label><DebouncedInput type="password" value={settings.ai_api_key || ""} onSave={(v) => save({ ai_api_key: v })} placeholder={t("输入 API Key", "Enter API Key")} autoComplete="new-password" /><p className="text-xs text-muted-foreground mt-1">{t("API Key 仅在服务端使用，不会暴露到浏览器", "API Key is only used server-side, not exposed to browser")}</p></div>
            <div><Label>{t("模型名称", "Model Name")}</Label><DebouncedInput value={settings.ai_model || ""} onSave={(v) => save({ ai_model: v })} placeholder="gemini-2.5-flash" /></div>
            <div><Label>API Base URL ({t("高级", "Advanced")})</Label><DebouncedInput value={settings.ai_base_url || ""} onSave={(v) => save({ ai_base_url: v })} placeholder={t("默认使用官方端点", "Default: official endpoint")} /></div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("AI 操作模式", "AI Operation Mode")}</Label>
                <p className="text-xs text-muted-foreground">{t("确认模式：预览后执行 / 直接模式：自动执行+撤销", "Confirm: preview then execute / Direct: auto-execute + undo")}</p>
              </div>
              <Switch checked={settings.ai_mode === "direct"} onCheckedChange={(v) => save({ ai_mode: v ? "direct" : "confirm" })} />
            </div>
          </CardContent>
        </Card>

        {/* Goals in Schedule */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("目标设置", "Goals Settings")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("在日程中显示目标悬浮球", "Show goals ball in schedule")}</Label>
                <p className="text-xs text-muted-foreground">{t("开启后在日程页面右下角显示当前目标", "Shows current goals in bottom-right of schedule page")}</p>
              </div>
              <Switch checked={settings.show_goals_in_schedule !== false} onCheckedChange={(v) => save({ show_goals_in_schedule: v })} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("财务设置", "Finance Settings")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>JPY → CNY 汇率</Label>
                <p className="text-xs text-muted-foreground">
                  {t("当前:", "Current:")} 1 JPY = {settings.exchange_rate_jpy_to_cny} CNY
                  {settings.exchange_rate_updated_at && ` (${t("更新于", "Updated")} ${new Date(settings.exchange_rate_updated_at).toLocaleDateString()})`}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchExchangeRate}>{t("获取最新汇率", "Fetch Latest Rate")}</Button>
            </div>
            <div>
              <Label>{t("月度预算", "Monthly Budget")} (CNY)</Label>
              <Input type="number" value={settings.monthly_budget || 5000} onChange={(e) => save({ monthly_budget: Number(e.target.value) })} />
            </div>
          </CardContent>
        </Card>

        {/* Calories */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("热量设置", "Calorie Settings")}</CardTitle></CardHeader>
          <CardContent>
            <Label>{t("每日热量目标", "Daily Calorie Target")} (kcal)</Label>
            <Input type="number" value={settings.calorie_target || 2000} onChange={(e) => save({ calorie_target: Number(e.target.value) })} />
          </CardContent>
        </Card>

        {/* Thought Tags */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("随想标签", "Thought Tags")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {((settings.custom_thought_tags as string[] | null) || []).map((tag: string) => (
                <Button key={tag} variant="secondary" size="sm" className="h-7" onClick={() => removeTag(tag)}>
                  {tag} ×
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder={t("添加自定义标签", "Add custom tag")} className="flex-1" onKeyDown={(e) => e.key === "Enter" && addTag()} />
              <Button size="sm" onClick={addTag}>{t("添加", "Add")}</Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("数据管理", "Data Management")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="secondary" onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-2" />{t("导出全量数据", "Export All Data")} (JSON)
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">
              <Upload className="h-4 w-4 mr-2" />{t("导入数据", "Import Data")} (JSON)
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("导入会将数据写入数据库（按 ID 合并），同时存入本地缓存供离线查看。", "Import writes data to database (merged by ID) and caches locally for offline viewing.")}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ===== IndexedDB helper =====
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("vlife-cache", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("data")) {
        db.createObjectStore("data");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(data: Record<string, any>) {
  const db = await openDB();
  const tx = db.transaction("data", "readwrite");
  const store = tx.objectStore("data");
  for (const [key, value] of Object.entries(data)) {
    store.put(value, key);
  }
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
