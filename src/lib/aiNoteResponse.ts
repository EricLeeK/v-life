function stripEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*/gu, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function noteTextFromAiChat(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const payload = data as { content?: unknown };
  if (typeof payload.content !== "string") return "";
  return stripEmoji(
    payload.content
      .replace(/^```markdown\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim(),
  );
}
