export const PLATFORM_URLS: Record<string, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  siliconflow: "https://api.siliconflow.cn/v1",
  custom: "",
};

const VISION_PLATFORMS = new Set(["gemini", "openai", "siliconflow", "custom"]);

export type EnvReader = {
  get: (key: string) => string | undefined;
};

export type HostedConfig = {
  enabled: boolean;
  apiKey: string;
  platform: string;
  model: string;
  baseUrl: string;
};

export type ByokSettings = {
  ai_api_key?: string | null;
  ai_platform?: string | null;
  ai_model?: string | null;
  ai_base_url?: string | null;
  ai_vision_api_key?: string | null;
  ai_vision_platform?: string | null;
  ai_vision_model?: string | null;
  ai_vision_base_url?: string | null;
} | null;

export type ByokCreds = {
  mode: "byok";
  apiKey: string;
  platform: string;
  model: string;
  baseUrl: string;
};

function read(env: EnvReader, key: string): string {
  return env.get(key) || "";
}

export function getHostedConfig(isVision = false, env: EnvReader): HostedConfig {
  const enabled = read(env, "HOSTED_AI_ENABLED") !== "false";

  if (isVision) {
    const apiKey = read(env, "HOSTED_AI_VISION_API_KEY") || read(env, "HOSTED_AI_API_KEY");
    const platform = read(env, "HOSTED_AI_VISION_PLATFORM") || read(env, "HOSTED_AI_PLATFORM") || "gemini";
    const model =
      read(env, "HOSTED_AI_VISION_MODEL") || read(env, "HOSTED_AI_MODEL") || "gemini-3.1-flash-lite";
    const baseUrlOverride = read(env, "HOSTED_AI_VISION_BASE_URL") || read(env, "HOSTED_AI_BASE_URL");
    const baseUrl = baseUrlOverride || PLATFORM_URLS[platform] || PLATFORM_URLS.gemini;
    return { enabled, apiKey, platform, model, baseUrl };
  }

  const apiKey = read(env, "HOSTED_AI_TEXT_API_KEY") || read(env, "HOSTED_AI_DEEPSEEK_API_KEY");
  const platform = read(env, "HOSTED_AI_TEXT_PLATFORM") || "deepseek";
  const model = read(env, "HOSTED_AI_TEXT_MODEL") || "deepseek-v4-flash";
  const baseUrlOverride = read(env, "HOSTED_AI_TEXT_BASE_URL");
  const baseUrl = baseUrlOverride || PLATFORM_URLS[platform] || PLATFORM_URLS.deepseek;
  return { enabled, apiKey, platform, model, baseUrl };
}

export function pickByokCreds(settings: ByokSettings, isVision = false): ByokCreds | null {
  if (isVision) {
    const visionKey = settings?.ai_vision_api_key || "";
    const generalPlatform = settings?.ai_platform || "";
    const generalKey = VISION_PLATFORMS.has(generalPlatform) ? settings?.ai_api_key || "" : "";
    const apiKey = visionKey || generalKey;
    if (!apiKey) return null;
    const platform = settings?.ai_vision_platform || (visionKey ? "gemini" : generalPlatform) || "gemini";
    const defaultModel = platform === "deepseek" ? "deepseek-chat" : "gemini-2.5-flash";
    const model = settings?.ai_vision_model || (visionKey ? defaultModel : settings?.ai_model) || defaultModel;
    const baseUrl =
      settings?.ai_vision_base_url ||
      (visionKey ? "" : settings?.ai_base_url) ||
      PLATFORM_URLS[platform] ||
      PLATFORM_URLS.gemini;
    return { mode: "byok", apiKey, platform, model, baseUrl };
  }

  const apiKey = settings?.ai_api_key || "";
  if (!apiKey) return null;
  const platform = settings?.ai_platform || "deepseek";
  const defaultModel = platform === "deepseek" ? "deepseek-chat" : "gemini-2.5-flash";
  const model = settings?.ai_model || defaultModel;
  const baseUrl = settings?.ai_base_url || PLATFORM_URLS[platform] || PLATFORM_URLS.deepseek;
  return { mode: "byok", apiKey, platform, model, baseUrl };
}
