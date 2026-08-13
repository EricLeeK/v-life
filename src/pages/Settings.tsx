import { useState, useRef, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSettings, useUpdateSettings } from "@/hooks/useData";
import { useHostedAiStatus } from "@/hooks/useHostedAiStatus";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, Save, ChevronDown } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import {
  zodiacDetailsFromBirthDate,
  zodiacFromBirthDate,
  zodiacFromSunLongitude,
  ZODIAC_LABELS,
  ZODIAC_SIGNS,
} from "@/lib/fortune/zodiac";
import { shengxiaoFromBirthDate, SHENGXIAO_LABELS, SHENGXIAO_ORDER } from "@/lib/fortune/shengxiao";
import type { FortuneProfile, Shengxiao, ZodiacSign } from "@/lib/fortune/types";

import { useTheme } from "next-themes";

function deriveZodiacSign(birthDate: string, birthHour?: number | null): ZodiacSign {
  if (birthHour != null && birthHour >= 0) {
    return zodiacFromSunLongitude(birthDate, birthHour).sign;
  }
  return zodiacFromBirthDate(birthDate);
}

const TABLES = ["pantry_items", "belongings_daily", "belongings_durable", "schedule_events", "calorie_records", "finance_records", "todos", "thoughts", "settings"] as const;

// Deep equality check to detect unsaved changes
function hasChanges(local: Record<string, any>, server: Record<string, any>): boolean {
  const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
  for (const key of keys) {
    const a = JSON.stringify(local[key]);
    const b = JSON.stringify(server[key]);
    if (a !== b) return true;
  }
  return false;
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: hostedAi } = useHostedAiStatus();
  const updateSettings = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { t, lang } = useLang();
  const [newTag, setNewTag] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local draft state — all edits go here first
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync draft with server when settings load
  const settingsRef = useRef(settings);
  if (settings && settings !== settingsRef.current) {
    settingsRef.current = settings;
    // Only reset draft if it's null (first load)
    if (!draft) setDraft({ ...settings });
  }

  // Initialize draft on first load
  if (settings && !draft) {
    setDraft({ ...settings });
  }

  const dirty = useMemo(() => {
    if (!draft || !settings) return false;
    return hasChanges(draft, settings);
  }, [draft, settings]);

  if (isLoading || !settings || !draft) {
    return <AppLayout title={t("设置", "Settings")}><p className="text-muted-foreground text-sm">{t("加载中...", "Loading...")}</p></AppLayout>;
  }

  const update = (key: string, value: any) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      // Only send changed keys — skip system fields
      const SKIP = new Set(["id", "created_at", "updated_at"]);
      const changes: Record<string, any> = {};
      const keys = new Set([...Object.keys(draft), ...Object.keys(settings)]);
      for (const key of keys) {
        if (SKIP.has(key)) continue;
        if (JSON.stringify(draft[key]) !== JSON.stringify(settings[key])) {
          changes[key] = draft[key];
        }
      }
      if (Object.keys(changes).length === 0) return;
      await updateSettings.mutateAsync(changes);
      toast({ title: t("保存成功", "Saved successfully") });
    } catch (e: any) {
      toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (settings) setDraft({ ...settings });
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/JPY");
      const data = await res.json();
      const rate = data.rates?.CNY;
      if (rate) {
        update("exchange_rate_jpy_to_cny", rate);
        update("exchange_rate_updated_at", new Date().toISOString());
        toast({ title: `${t("汇率已更新:", "Rate updated:")} 1 JPY = ${rate} CNY` });
      }
    } catch { toast({ title: t("获取汇率失败", "Failed to fetch rate"), variant: "destructive" }); }
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const current = (draft.custom_thought_tags as string[] | null) || [];
    if (current.includes(newTag.trim())) return;
    update("custom_thought_tags", [...current, newTag.trim()]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    const current = (draft.custom_thought_tags as string[] | null) || [];
    update("custom_thought_tags", current.filter((t: string) => t !== tag));
  };

  const handleExport = async () => {
    try {
      const exportData: Record<string, any> = {};
      for (const table of TABLES) {
        const { data, error } = await (supabase.from as any)(table).select("*");
        if (error) throw error;
        exportData[table] = data || [];
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `v-life-backup-${new Date().toISOString().split("T")[0]}.json`;
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
      let importedCount = 0;
      for (const table of TABLES) {
        if (!importData[table] || !Array.isArray(importData[table])) continue;
        if (table === "settings") continue;
        for (const row of importData[table]) {
          const { error } = await (supabase.from as any)(table).upsert(row, { onConflict: "id" });
          if (!error) importedCount++;
        }
      }
      toast({ title: t("导入成功", "Import successful"), description: `${t("已导入", "Imported")} ${importedCount} ${t("条记录", "records")}` });
    } catch (err: any) {
      toast({ title: t("导入失败", "Import failed"), description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  };

  return (
    <AppLayout title={t("设置", "Settings")}>
      {/* Sticky save bar */}
      {dirty && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-card/90 backdrop-blur-md border-b border-border flex items-center justify-between">
          <span className="text-[13px] text-[#d17847] font-medium">{t("有未保存的更改", "Unsaved changes")}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleDiscard}>
              {t("撤销", "Discard")}
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-6 mt-2">
        {/* Account & Appearance */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("账号与外观", "Account & Appearance")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="setting-display-name">{t("昵称", "Display Name")}</Label>
              <Input
                id="setting-display-name"
                value={draft.display_name || ""}
                onChange={(e) => update("display_name", e.target.value)}
                placeholder={t("输入你的昵称", "Enter your display name")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("设置后会在首页问候语中显示", "Shown in the greeting on your dashboard")}
              </p>
            </div>
            <div>
              <Label htmlFor="theme-select">{t("主题模式", "Theme Mode")}</Label>
              <Select value={theme || "system"} onValueChange={(v) => setTheme(v)}>
                <SelectTrigger id="theme-select" className="w-full sm:w-[200px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("浅色 (Cream)", "Light (Cream)")}</SelectItem>
                  <SelectItem value="dark">{t("深色 (Charcoal)", "Dark (Charcoal)")}</SelectItem>
                  <SelectItem value="system">{t("跟随系统", "System")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t("可以在浅色暖奶油与深色炭灰主题间自由切换", "Switch between Light Cream and Dark Charcoal themes")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fortune profile — collapsed by default */}
        <Collapsible defaultOpen={false}>
          <Card>
            <CardHeader className="py-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between text-left">
                  <CardTitle className="text-base">{t("运势档案", "Fortune Profile")}</CardTitle>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {t("展开", "Expand")}
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {(() => {
                  const fp = (draft.fortune_profile || {}) as FortuneProfile;
                  const setFp = (next: FortuneProfile) => update("fortune_profile", next);
                  const cusp =
                    fp.birth_date != null && fp.birth_date !== ""
                      ? fp.birth_hour != null && fp.birth_hour >= 0
                        ? zodiacFromSunLongitude(fp.birth_date, fp.birth_hour)
                        : zodiacDetailsFromBirthDate(fp.birth_date)
                      : null;
                  return (
                    <>
                      <div>
                        <Label htmlFor="fp-birth-date">{t("生日（公历）", "Birthday (Gregorian)")}</Label>
                        <Input
                          id="fp-birth-date"
                          type="date"
                          value={fp.birth_date || ""}
                          onChange={(e) => {
                            const birth_date = e.target.value;
                            setFp({
                              ...fp,
                              birth_date,
                              zodiac_sign: birth_date
                                ? deriveZodiacSign(birth_date, fp.birth_hour)
                                : fp.zodiac_sign,
                              shengxiao: birth_date ? shengxiaoFromBirthDate(birth_date) : fp.shengxiao,
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fp-birth-hour">{t("出生时辰（可选）", "Birth hour (optional)")}</Label>
                        <Select
                          value={fp.birth_hour == null ? "none" : String(fp.birth_hour)}
                          onValueChange={(v) => {
                            const birth_hour = v === "none" ? null : Number(v);
                            setFp({
                              ...fp,
                              birth_hour,
                              zodiac_sign: fp.birth_date
                                ? deriveZodiacSign(fp.birth_date, birth_hour)
                                : fp.zodiac_sign,
                            });
                          }}
                        >
                          <SelectTrigger id="fp-birth-hour"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("未知", "Unknown")}</SelectItem>
                            {Array.from({ length: 24 }, (_, h) => (
                              <SelectItem key={h} value={String(h)}>
                                {String(h).padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="fp-birth-place">{t("出生地（备注）", "Birth place (note)")}</Label>
                        <Input
                          id="fp-birth-place"
                          value={fp.birth_place || ""}
                          onChange={(e) => setFp({ ...fp, birth_place: e.target.value })}
                          placeholder={t("可选", "Optional")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fp-zodiac-sign">{t("星座", "Zodiac")}</Label>
                        <Select
                          value={fp.zodiac_sign || ""}
                          onValueChange={(v) => setFp({ ...fp, zodiac_sign: v as ZodiacSign })}
                        >
                          <SelectTrigger id="fp-zodiac-sign"><SelectValue placeholder={t("自动推导", "Auto")} /></SelectTrigger>
                          <SelectContent>
                            {ZODIAC_SIGNS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {lang === "zh" ? ZODIAC_LABELS[s].zh : ZODIAC_LABELS[s].en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {cusp?.cuspSensitive && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t(
                              "交界日：填写出生时辰可用太阳黄经更精确判定。",
                              "Cusp day: add birth hour for Sun-longitude precision.",
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="fp-shengxiao">{t("生肖", "Shengxiao")}</Label>
                        <Select
                          value={fp.shengxiao || ""}
                          onValueChange={(v) => setFp({ ...fp, shengxiao: v as Shengxiao })}
                        >
                          <SelectTrigger id="fp-shengxiao"><SelectValue placeholder={t("自动推导", "Auto")} /></SelectTrigger>
                          <SelectContent>
                            {SHENGXIAO_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>
                                {lang === "zh" ? SHENGXIAO_LABELS[s].zh : SHENGXIAO_LABELS[s].en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Hosted AI status */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("托管 AI", "Hosted AI")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {hostedAi?.active ? (
              <>
                <p className="text-sm">
                  {t("状态：已开通", "Status: Active")}
                  {hostedAi.entitlement?.expires_at
                    ? ` · ${t("到期", "Expires")} ${new Date(hostedAi.entitlement.expires_at).toLocaleDateString()}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("本月用量", "Monthly usage")}: {hostedAi.monthlyUsed.toLocaleString()} / {(hostedAi.entitlement?.monthly_token_limit ?? 0).toLocaleString()} tokens
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("今日请求", "Today's requests")}: {hostedAi.dailyUsed} / {hostedAi.entitlement?.daily_request_limit ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("开通后纯文本走 DeepSeek、看图走 Gemini；超额不会自动改用你自己的 Key。", "Hosted text uses DeepSeek and vision uses Gemini; over-quota does not auto-fall back to your own key.")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("未开通 · 可使用下方自带 Key", "Not active · use your own API key below")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Configuration (Dual Model BYOK Routing) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{t("AI 模型与 Key 配置", "AI Models & API Keys")}</span>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-normal">
                {t("智能路由 · 成本优化", "Auto Routing · Cost Saver")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-800 flex items-center gap-1">
                💡 {t("自动模型分流说明", "Smart Model Routing")}
              </p>
              <p>
                {t(
                  "• 常规模型：用于绝大部分纯文本对话、笔记润色、格式排版与计划生成，推荐 DeepSeek（高性价比）。",
                  "• General Model: For ordinary text chat, note polishing, and layout optimization (e.g. DeepSeek)."
                )}
              </p>
              <p>
                {t(
                  "• 视觉模型：当上传或分析图片时自动切换使用，推荐 Google Gemini 视觉模型（如 gemini-2.5-flash）。",
                  "• Vision Model: Auto-switched when images are uploaded or analyzed (e.g. Gemini 2.5 Flash)."
                )}
              </p>
            </div>

            {/* 1. 常规模型 */}
            <div className="space-y-3 pt-1 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h4 className="text-sm font-semibold text-foreground">
                  {t("常规文本模型（如 DeepSeek）", "General Text Model (e.g., DeepSeek)")}
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="settings-api-platform" className="text-xs">{t("API 平台", "API Platform")}</Label>
                  <Select value={draft.ai_platform || "deepseek"} onValueChange={(v) => update("ai_platform", v)}>
                    <SelectTrigger id="settings-api-platform" className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepseek">DeepSeek (官方)</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="siliconflow">SiliconFlow 硅基流动</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="custom">自定义 / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="settings-ai-model" className="text-xs">{t("模型名称", "Model Name")}</Label>
                  <Input
                    id="settings-ai-model"
                    value={draft.ai_model || ""}
                    onChange={(e) => update("ai_model", e.target.value)}
                    placeholder="deepseek-chat"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="settings-api-key" className="text-xs">{t("常规 API Key", "General API Key")}</Label>
                <Input
                  id="settings-api-key"
                  type="password"
                  value={draft.ai_api_key || ""}
                  onChange={(e) => update("ai_api_key", e.target.value)}
                  placeholder={t("输入 DeepSeek 或通用 API Key", "Enter General API Key")}
                  autoComplete="new-password"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="settings-api-base-url" className="text-xs">API Base URL ({t("可选高级项", "Optional Advanced")})</Label>
                <Input
                  id="settings-api-base-url"
                  value={draft.ai_base_url || ""}
                  onChange={(e) => update("ai_base_url", e.target.value)}
                  placeholder={t("默认使用平台官方端点", "Default: official endpoint")}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* 2. 视觉模型 */}
            <div className="space-y-3 pt-3 border-t border-stone-200/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <h4 className="text-sm font-semibold text-foreground">
                  {t("视觉多模态模型（如 Gemini）", "Vision Multimodal Model (e.g., Gemini)")}
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="settings-vision-platform" className="text-xs">{t("视觉 API 平台", "Vision Platform")}</Label>
                  <Select value={draft.ai_vision_platform || "gemini"} onValueChange={(v) => update("ai_vision_platform", v)}>
                    <SelectTrigger id="settings-vision-platform" className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Google Gemini (推荐)</SelectItem>
                      <SelectItem value="openai">OpenAI (gpt-4o)</SelectItem>
                      <SelectItem value="siliconflow">SiliconFlow 硅基流动</SelectItem>
                      <SelectItem value="custom">自定义 / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="settings-vision-model" className="text-xs">{t("视觉模型名称", "Vision Model Name")}</Label>
                  <Input
                    id="settings-vision-model"
                    value={draft.ai_vision_model || ""}
                    onChange={(e) => update("ai_vision_model", e.target.value)}
                    placeholder="gemini-2.5-flash"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="settings-vision-api-key" className="text-xs">{t("视觉 API Key", "Vision API Key")}</Label>
                <Input
                  id="settings-vision-api-key"
                  type="password"
                  value={draft.ai_vision_api_key || ""}
                  onChange={(e) => update("ai_vision_api_key", e.target.value)}
                  placeholder={t("输入 Gemini 或视觉 Key (若为空则复用常规 Key)", "Enter Vision API Key")}
                  autoComplete="new-password"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="settings-vision-base-url" className="text-xs">视觉 API Base URL ({t("可选", "Optional")})</Label>
                <Input
                  id="settings-vision-base-url"
                  value={draft.ai_vision_base_url || ""}
                  onChange={(e) => update("ai_vision_base_url", e.target.value)}
                  placeholder={t("默认使用官方端点", "Default: official endpoint")}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <div>
                <Label htmlFor="settings-ai-mode">{t("AI 操作模式", "AI Operation Mode")}</Label>
                <p className="text-xs text-muted-foreground">{t("确认模式：预览后执行 / 直接模式：自动执行+撤销", "Confirm: preview then execute / Direct: auto-execute + undo")}</p>
              </div>
              <Switch id="settings-ai-mode" checked={draft.ai_mode === "direct"} onCheckedChange={(v) => update("ai_mode", v ? "direct" : "confirm")} />
            </div>
          </CardContent>
        </Card>

        {/* Goals in Schedule */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("目标设置", "Goals Settings")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="settings-show-goals-ball">{t("在日程中显示目标悬浮球", "Show goals ball in schedule")}</Label>
                <p className="text-xs text-muted-foreground">{t("开启后在日程页面右下角显示当前目标", "Shows current goals in bottom-right of schedule page")}</p>
              </div>
              <Switch id="settings-show-goals-ball" checked={draft.show_goals_in_schedule !== false} onCheckedChange={(v) => update("show_goals_in_schedule", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Day Start Time */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("跨天结算时间", "Day Reset Time")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-day-start">{t("新的一天从几点开始？", "When does a new day start?")}</Label>
              <p className="text-xs text-muted-foreground">{t("如果你经常熬夜，可以设置凌晨几点才算新的一天（比如设置 2:00，那么凌晨 1 点还是算昨天）。", "If you stay up late, you can shift the start of the day (e.g., set to 2:00 AM, and 1:00 AM will still count towards yesterday).")}</p>
              <Select value={String(draft.day_start_hour || 0)} onValueChange={(v) => update("day_start_hour", Number(v))}>
                <SelectTrigger id="settings-day-start" className="w-full sm:w-[200px] mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("午夜 00:00", "Midnight 00:00")}</SelectItem>
                  <SelectItem value="1">01:00 AM</SelectItem>
                  <SelectItem value="2">02:00 AM</SelectItem>
                  <SelectItem value="3">03:00 AM</SelectItem>
                  <SelectItem value="4">04:00 AM</SelectItem>
                  <SelectItem value="5">05:00 AM</SelectItem>
                  <SelectItem value="6">06:00 AM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Module Visibility Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("导航栏与模块控制", "Navigation & Module Control")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 pb-2 border-b border-border">
              <Label htmlFor="settings-focus-mode" className="font-medium text-sm text-foreground">
                {t("专注模式", "Focus mode")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  "「仅考公」会隐藏主模块入口与同步按钮，数据不会删除；可随时切回全功能。",
                  "Civil-only hides main modules and sync UI; data is kept. Switch back anytime."
                )}
              </p>
              <Select
                value={(draft.app_focus_mode as string) || "full"}
                onValueChange={(v) => update("app_focus_mode", v)}
              >
                <SelectTrigger id="settings-focus-mode" className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t("全功能", "Full app")}</SelectItem>
                  <SelectItem value="civil_service">{t("仅考公", "Civil service only")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "在此选择要在侧边栏和手机导航中显示的非核心模块。关闭某个模块仅做视觉隐藏，您存过的历史数据不会受到任何影响。",
                "Choose which modules to display in the sidebar and mobile nav. Disabling a module only hides it visually; your historical data remains completely safe."
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[
                { id: "pantry", name: t("食材管理", "Pantry") },
                { id: "belongings", name: t("用品管理", "Belongings") },
                { id: "calories", name: t("热量记录", "Calories") },
                { id: "finance", name: t("记账", "Finance") },
                { id: "projects", name: t("项目管理", "Projects") },
                { id: "goals", name: t("目标管理", "Goals") },
                { id: "thoughts", name: t("随想", "Thoughts") },
                { id: "learning-notes", name: t("学习笔记", "Learning Notes") },
                { id: "weight-loss", name: t("减肥专项", "Weight Loss") },
                { id: "civil-service", name: t("考公", "Civil Service") },
                { id: "fortune", name: t("运势", "Fortune") },
              ].map((feature) => {
                const isHidden = ((draft.hidden_features as string[] | null) || []).includes(feature.id);
                return (
                  <div key={feature.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-[#fbfbfa]">
                    <div>
                      <Label htmlFor={`settings-feature-${feature.id}`} className="font-medium text-sm text-foreground">{feature.name}</Label>
                    </div>
                    <Switch
                      id={`settings-feature-${feature.id}`}
                      checked={!isHidden}
                      onCheckedChange={(checked) => {
                        const current = (draft.hidden_features as string[] | null) || [];
                        if (!checked) {
                          // Hide: add to hidden_features
                          update("hidden_features", [...current.filter(x => x !== feature.id), feature.id]);
                        } else {
                          // Show: remove from hidden_features
                          update("hidden_features", current.filter(x => x !== feature.id));
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>


        {/* Finance */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("财务设置", "Finance Settings")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label id="settings-exchange-rate-label">JPY → CNY 汇率</Label>
                <p className="text-xs text-muted-foreground">
                  {t("当前:", "Current:")} 1 JPY = {draft.exchange_rate_jpy_to_cny} CNY
                  {draft.exchange_rate_updated_at && ` (${t("更新于", "Updated")} ${new Date(draft.exchange_rate_updated_at).toLocaleDateString()})`}
                </p>
              </div>
              <Button variant="secondary" size="sm" aria-labelledby="settings-exchange-rate-label" onClick={fetchExchangeRate}>{t("获取最新汇率", "Fetch Latest Rate")}</Button>
            </div>
            <div>
              <Label htmlFor="settings-budget">{t("月度预算", "Monthly Budget")} (CNY)</Label>
              <Input id="settings-budget" type="number" value={draft.monthly_budget || 5000} onChange={(e) => update("monthly_budget", Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        {/* Calories */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("热量设置", "Calorie Settings")}</CardTitle></CardHeader>
          <CardContent>
            <Label htmlFor="settings-calorie-target">{t("每日热量目标", "Daily Calorie Target")} (kcal)</Label>
            <Input id="settings-calorie-target" type="number" value={draft.calorie_target || 2000} onChange={(e) => update("calorie_target", Number(e.target.value))} />
          </CardContent>
        </Card>

        {/* Thought Tags */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("随想标签", "Thought Tags")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {((draft.custom_thought_tags as string[] | null) || []).map((tag: string) => (
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
