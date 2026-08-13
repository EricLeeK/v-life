import {
  PLATFORM_URLS,
  getHostedConfig as readHostedConfig,
  pickByokCreds,
  type ByokSettings,
} from "./hostedRouting.ts";

export { PLATFORM_URLS };

export const GLOBAL_HOSTED_RPM = 120;

export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "HOSTED_DISABLED"
  | "HOSTED_RATE_LIMIT"
  | "HOSTED_QUOTA_EXCEEDED"
  | "HOSTED_NOT_PROVISIONED"
  | "UPSTREAM_ERROR";

export type ResolvedAi =
  | {
      mode: "hosted";
      apiKey: string;
      platform: string;
      model: string;
      baseUrl: string;
      entitlement: {
        monthly_token_limit: number;
        daily_request_limit: number;
        per_minute_limit: number;
      };
    }
  | {
      mode: "byok";
      apiKey: string;
      platform: string;
      model: string;
      baseUrl: string;
    };

export type ResolveFailure = {
  ok: false;
  status: number;
  code: AiErrorCode;
  message: string;
};

export type ResolveSuccess = { ok: true; creds: ResolvedAi };

type AdminClient = {
  from: (table: string) => any;
};

type SettingsRow = ByokSettings;

type EntitlementRow = {
  status: string;
  monthly_token_limit: number;
  daily_request_limit: number;
  per_minute_limit: number;
  expires_at: string | null;
};

export function jsonError(
  code: AiErrorCode,
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getHostedConfig(isVision = false) {
  return readHostedConfig(isVision, Deno.env);
}

function shanghaiDatePrefix(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function startOfShanghaiDay(d = new Date()): Date {
  return new Date(`${shanghaiDatePrefix(d)}T00:00:00+08:00`);
}

function startOfShanghaiMonth(d = new Date()): Date {
  const [y, m] = shanghaiDatePrefix(d).split("-");
  return new Date(`${y}-${m}-01T00:00:00+08:00`);
}

async function countUsage(
  adminSb: AdminClient,
  filters: { userId?: string; since: Date },
): Promise<number> {
  let q = adminSb
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("source", "hosted")
    .gte("created_at", filters.since.toISOString());
  if (filters.userId) q = q.eq("user_id", filters.userId);
  const { count, error } = await q;
  if (error) {
    console.error("countUsage error:", error);
    return 0;
  }
  return count ?? 0;
}

async function sumMonthlyTokens(adminSb: AdminClient, userId: string): Promise<number> {
  const since = startOfShanghaiMonth();
  const { data, error } = await adminSb
    .from("ai_usage_logs")
    .select("total_tokens")
    .eq("source", "hosted")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) {
    console.error("sumMonthlyTokens error:", error);
    return 0;
  }
  return (data || []).reduce(
    (sum: number, row: { total_tokens: number | null }) => sum + (row.total_tokens || 0),
    0,
  );
}

export async function assertHostedQuota(
  adminSb: AdminClient,
  userId: string,
  entitlement: EntitlementRow,
): Promise<ResolveFailure | null> {
  const minuteAgo = new Date(Date.now() - 60_000);
  const dayStart = startOfShanghaiDay();

  const [userMinute, userDay, monthlyTokens, globalMinute] = await Promise.all([
    countUsage(adminSb, { userId, since: minuteAgo }),
    countUsage(adminSb, { userId, since: dayStart }),
    sumMonthlyTokens(adminSb, userId),
    countUsage(adminSb, { since: minuteAgo }),
  ]);

  if (userMinute >= entitlement.per_minute_limit || globalMinute >= GLOBAL_HOSTED_RPM) {
    return {
      ok: false,
      status: 429,
      code: "HOSTED_RATE_LIMIT",
      message: "请求过于频繁，请稍后再试",
    };
  }
  if (userDay >= entitlement.daily_request_limit) {
    return {
      ok: false,
      status: 402,
      code: "HOSTED_QUOTA_EXCEEDED",
      message: "今日托管请求次数已用完。可在设置中填写自己的 API Key 继续使用",
    };
  }
  if (monthlyTokens >= entitlement.monthly_token_limit) {
    return {
      ok: false,
      status: 402,
      code: "HOSTED_QUOTA_EXCEEDED",
      message: "本月托管额度已用完。可在设置中填写自己的 API Key 继续使用",
    };
  }
  return null;
}

export async function resolveAiCredentials(
  adminSb: AdminClient,
  userId: string,
  settings: SettingsRow,
  isVision = false,
): Promise<ResolveSuccess | ResolveFailure> {
  const hosted = getHostedConfig(isVision);
  let entitlement: EntitlementRow | null = null;

  if (hosted.enabled) {
    const { data } = await adminSb
      .from("ai_entitlements")
      .select("status, monthly_token_limit, daily_request_limit, per_minute_limit, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    entitlement = data as EntitlementRow | null;
  }

  const now = Date.now();
  const entitlementActive =
    !!entitlement &&
    entitlement.status === "active" &&
    (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() > now);

  if (entitlementActive && entitlement && hosted.apiKey) {
    const quotaFail = await assertHostedQuota(adminSb, userId, entitlement);
    if (quotaFail) return quotaFail;
    return {
      ok: true,
      creds: {
        mode: "hosted",
        apiKey: hosted.apiKey,
        platform: hosted.platform,
        model: hosted.model,
        baseUrl: hosted.baseUrl,
        entitlement: {
          monthly_token_limit: entitlement.monthly_token_limit,
          daily_request_limit: entitlement.daily_request_limit,
          per_minute_limit: entitlement.per_minute_limit,
        },
      },
    };
  }

  const byok = pickByokCreds(settings, isVision);
  if (byok) return { ok: true, creds: byok };

  if (entitlementActive && !hosted.apiKey) {
    return {
      ok: false,
      status: 503,
      code: "HOSTED_NOT_PROVISIONED",
      message: isVision
        ? "托管视觉模型暂未配置完成，请稍后或在设置中填写 Gemini API Key"
        : "托管文本模型暂未配置完成，请稍后或在设置中填写 DeepSeek API Key",
    };
  }

  if (entitlement?.status === "disabled") {
    return {
      ok: false,
      status: 403,
      code: "HOSTED_DISABLED",
      message: "托管 AI 已停用，请使用自己的 API Key 或联系管理员",
    };
  }

  return {
    ok: false,
    status: 400,
    code: "AI_NOT_CONFIGURED",
    message: isVision
      ? "请配置视觉模型（Gemini），或开通托管 AI"
      : "请开通托管 AI，或在设置中填写 DeepSeek API Key",
  };
}

type UsagePayload = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
} | null | undefined;

export async function recordHostedUsage(
  adminSb: AdminClient,
  opts: {
    userId: string;
    functionName: string;
    model: string;
    usage?: UsagePayload;
    estimateFrom?: string;
  },
) {
  let input = opts.usage?.prompt_tokens ?? 0;
  let output = opts.usage?.completion_tokens ?? 0;
  let total = opts.usage?.total_tokens ?? 0;
  let tokenEstimate = false;

  if (!total && !input && !output) {
    const estimate = Math.ceil((opts.estimateFrom || "").length / 4);
    input = estimate;
    total = estimate;
    tokenEstimate = true;
  } else if (!total) {
    total = input + output;
  }

  const { error } = await adminSb.from("ai_usage_logs").insert({
    user_id: opts.userId,
    source: "hosted",
    function_name: opts.functionName,
    model: opts.model,
    input_tokens: input,
    output_tokens: output,
    total_tokens: total,
    token_estimate: tokenEstimate,
  });
  if (error) console.error("recordHostedUsage error:", error);
}
