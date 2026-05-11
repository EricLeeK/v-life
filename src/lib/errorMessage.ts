export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const details = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const message = typeof details.message === "string" ? details.message : "";
    const code = typeof details.code === "string" ? details.code : "";
    const extra = typeof details.details === "string" ? details.details : typeof details.hint === "string" ? details.hint : "";

    if (message && code) return `${message} (${code})`;
    if (message) return message;
    if (extra) return extra;
  }

  return String(error);
}
