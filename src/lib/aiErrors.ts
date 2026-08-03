import { FunctionsHttpError } from "@supabase/supabase-js";

const MAP: Record<string, string> = {
  AI_NOT_CONFIGURED: "请开通托管 AI，或在设置中填写自己的 API Key",
  HOSTED_DISABLED: "托管 AI 已停用，请使用自己的 API Key 或联系管理员",
  HOSTED_RATE_LIMIT: "请求过于频繁，请稍后再试",
  HOSTED_QUOTA_EXCEEDED: "今日或本月托管额度已用完。可在设置中填写自己的 API Key 继续使用",
  HOSTED_NOT_PROVISIONED: "托管 AI 暂未配置完成，请稍后或改用自己的 API Key",
  UPSTREAM_ERROR: "AI 服务暂时不可用，请稍后重试",
};

export function formatAiError(payload: { error?: string; code?: string } | null | undefined): string {
  if (payload?.code && MAP[payload.code]) return MAP[payload.code];
  return payload?.error || "AI 调用失败";
}

/** Normalize supabase.functions.invoke data/error into a user-facing message. */
export async function messageFromAiInvoke(
  data: { error?: string; code?: string } | null | undefined,
  error: unknown,
): Promise<string | null> {
  if (data?.error || data?.code) return formatAiError(data);
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return formatAiError(body);
    } catch {
      return error.message || "AI 调用失败";
    }
  }
  if (error instanceof Error) return error.message;
  if (error) return String(error);
  return null;
}
