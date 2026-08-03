import { supabase } from "@/integrations/supabase/client";

export function buildFortuneUserPrompt(input: {
  kind: string;
  facts: Record<string, unknown>;
  question?: string;
  lang: "zh" | "en";
}): string {
  const dailyExtra =
    input.kind === "daily"
      ? input.lang === "en"
        ? "facts above are reference only (zodiac, almanac, moon, profile, scores). Write your own warm 80-150 word reading inspired by them—do not checklist every field. Plain text only."
        : "以上 facts 仅供参考（含星座日运、黄历、月相、生肖、分数等）。请你自己写一段 80–150 字温柔短文，吸收这些信息即可，不要逐条点名或堆砌字段。只输出纯文本。"
      : input.lang === "en"
        ? "Write a warm 80-150 word reading from the facts. Plain text only."
        : "请根据 facts 写 80-150 字温柔解读。只输出纯文本。";

  return [
    `kind: ${input.kind}`,
    `lang: ${input.lang}`,
    input.question ? `question: ${input.question}` : "",
    `facts: ${JSON.stringify(input.facts)}`,
    dailyExtra,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function requestFortuneReading(
  userPrompt: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: {
      mode: "fortune",
      messages: [{ role: "user", content: userPrompt }],
    },
  });

  if (error) {
    const msg =
      (data as { error?: string } | null)?.error ||
      error.message ||
      "AI request failed";
    return { ok: false, error: msg };
  }
  if ((data as { error?: string } | null)?.error) {
    return { ok: false, error: (data as { error: string }).error };
  }
  const text = String((data as { content?: string } | null)?.content || "").trim();
  if (!text) return { ok: false, error: "empty fortune reading" };
  return { ok: true, text };
}
