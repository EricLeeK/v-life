export function noteTextFromAiChat(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const payload = data as { content?: unknown };
  if (typeof payload.content !== "string") return "";
  return payload.content
    .replace(/^```markdown\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
