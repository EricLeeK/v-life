import { describe, expect, it } from "vitest";
import {
  PLATFORM_URLS,
  getHostedConfig,
  pickByokCreds,
} from "../../supabase/functions/_shared/hostedRouting.ts";

function env(map: Record<string, string>) {
  return { get: (key: string) => map[key] };
}

describe("getHostedConfig", () => {
  it("routes text (non-vision) to DeepSeek and ignores legacy Gemini secrets", () => {
    const cfg = getHostedConfig(
      false,
      env({
        HOSTED_AI_API_KEY: "sk-gemini",
        HOSTED_AI_PLATFORM: "gemini",
        HOSTED_AI_MODEL: "gemini-3.1-flash-lite",
        HOSTED_AI_TEXT_API_KEY: "sk-deepseek",
      }),
    );
    expect(cfg.platform).toBe("deepseek");
    expect(cfg.model).toBe("deepseek-v4-flash");
    expect(cfg.apiKey).toBe("sk-deepseek");
    expect(cfg.baseUrl).toBe(PLATFORM_URLS.deepseek);
  });

  it("does not send Gemini legacy key as DeepSeek credentials", () => {
    const cfg = getHostedConfig(
      false,
      env({
        HOSTED_AI_API_KEY: "sk-gemini",
        HOSTED_AI_PLATFORM: "gemini",
      }),
    );
    expect(cfg.apiKey).toBe("");
    expect(cfg.platform).toBe("deepseek");
  });

  it("routes vision to Gemini using legacy HOSTED_AI_* secrets", () => {
    const cfg = getHostedConfig(
      true,
      env({
        HOSTED_AI_API_KEY: "sk-gemini",
        HOSTED_AI_PLATFORM: "gemini",
        HOSTED_AI_MODEL: "gemini-3.1-flash-lite",
      }),
    );
    expect(cfg.platform).toBe("gemini");
    expect(cfg.model).toBe("gemini-3.1-flash-lite");
    expect(cfg.apiKey).toBe("sk-gemini");
    expect(cfg.baseUrl).toBe(PLATFORM_URLS.gemini);
  });

  it("prefers explicit vision secrets over legacy ones", () => {
    const cfg = getHostedConfig(
      true,
      env({
        HOSTED_AI_API_KEY: "sk-old",
        HOSTED_AI_VISION_API_KEY: "sk-vision",
        HOSTED_AI_VISION_MODEL: "gemini-2.5-flash",
      }),
    );
    expect(cfg.apiKey).toBe("sk-vision");
    expect(cfg.model).toBe("gemini-2.5-flash");
    expect(cfg.platform).toBe("gemini");
  });
});

describe("pickByokCreds", () => {
  it("uses DeepSeek for text and Gemini for vision", () => {
    const settings = {
      ai_api_key: "sk-ds",
      ai_platform: "deepseek",
      ai_model: "deepseek-chat",
      ai_vision_api_key: "sk-gm",
      ai_vision_platform: "gemini",
      ai_vision_model: "gemini-2.5-flash",
    };
    const text = pickByokCreds(settings, false);
    const vision = pickByokCreds(settings, true);
    expect(text?.platform).toBe("deepseek");
    expect(text?.model).toBe("deepseek-chat");
    expect(text?.apiKey).toBe("sk-ds");
    expect(vision?.platform).toBe("gemini");
    expect(vision?.model).toBe("gemini-2.5-flash");
    expect(vision?.apiKey).toBe("sk-gm");
  });

  it("does not send images to a DeepSeek-only BYOK setup", () => {
    const vision = pickByokCreds(
      { ai_api_key: "sk-ds", ai_platform: "deepseek" },
      true,
    );
    expect(vision).toBeNull();
  });

  it("does not use a Gemini vision key for plain text", () => {
    const text = pickByokCreds(
      { ai_vision_api_key: "sk-gm", ai_vision_platform: "gemini" },
      false,
    );
    expect(text).toBeNull();
  });
});
