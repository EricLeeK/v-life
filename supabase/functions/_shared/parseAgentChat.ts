export type AgentOperation = {
  module: string;
  action: string;
  data: Record<string, any>;
};

export type AgentChatResult = {
  operations: AgentOperation[];
  summary: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeAgentJsonText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && /"operations"\s*:/.test(trimmed);
}

function tryJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Brace-match the first JSON object, respecting strings and escapes. */
export function extractFirstJsonObject(text: string): { json: string; rest: string } | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { json: text.slice(start, i + 1), rest: text.slice(i + 1).trim() };
      }
    }
  }
  return null;
}

function fenceJson(text: string): { json: string; rest: string } | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!match) return null;
  return { json: match[1].trim(), rest: (text.slice(0, match.index) + text.slice((match.index ?? 0) + match[0].length)).trim() };
}

function asOperations(value: unknown): AgentOperation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((op) => isRecord(op) && typeof op.module === "string") as AgentOperation[];
}

function stripPromptEcho(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^(用户|输出|User|Output)\s*[:：]/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unwrapSummary(summary: string): string {
  let current = summary.trim();
  for (let i = 0; i < 3 && looksLikeAgentJsonText(current); i++) {
    const extracted = extractFirstJsonObject(current);
    const parsed = tryJsonParse(extracted?.json ?? current);
    if (isRecord(parsed) && typeof parsed.summary === "string" && parsed.summary.trim()) {
      current = parsed.summary.trim();
      continue;
    }
    break;
  }
  return looksLikeAgentJsonText(current) ? "" : current;
}

function fallbackFromOperations(operations: AgentOperation[]): string {
  if (operations.length === 0) return "";
  const names = operations
    .map((op) => op.data?.name || op.data?.title || op.data?.food_name || op.data?.match?.name || op.data?.match?.title)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  if (names.length === 1) return `准备更新「${names[0]}」`;
  if (names.length > 1) return `准备处理「${names[0]}」等 ${operations.length} 项`;
  return `准备执行 ${operations.length} 项操作`;
}

function humanSummary(parsed: Record<string, unknown>, rest: string): string {
  const operations = asOperations(parsed.operations);
  let summary = typeof parsed.summary === "string" ? unwrapSummary(parsed.summary) : "";
  const restClean = stripPromptEcho(rest);

  if (restClean && restClean !== summary) {
    if (!summary) return restClean;
    if (!summary.includes(restClean) && !restClean.includes(summary)) {
      return `${summary}\n\n${restClean}`;
    }
    if (restClean.length > summary.length && restClean.includes(summary)) return restClean;
  }
  if (summary) return summary;
  return fallbackFromOperations(operations);
}

function parseJsonCandidate(jsonText: string, rest: string): AgentChatResult | null {
  const parsed = tryJsonParse(jsonText);
  if (!isRecord(parsed)) return null;
  if (!("operations" in parsed) && !("summary" in parsed)) return null;
  if (!Array.isArray(parsed.operations)) parsed.operations = [];
  return {
    operations: asOperations(parsed.operations),
    summary: humanSummary(parsed, rest),
  };
}

function parseFromText(text: string): AgentChatResult {
  const trimmed = text.trim();
  if (!trimmed) return { operations: [], summary: "" };

  const direct = tryJsonParse(trimmed);
  if (isRecord(direct) && ("operations" in direct || "summary" in direct)) {
    if (!Array.isArray(direct.operations)) direct.operations = [];
    return {
      operations: asOperations(direct.operations),
      summary: humanSummary(direct, ""),
    };
  }

  const fenced = fenceJson(trimmed);
  if (fenced) {
    const fromFence = parseJsonCandidate(fenced.json, fenced.rest);
    if (fromFence) return fromFence;
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (extracted) {
    const fromExtract = parseJsonCandidate(extracted.json, extracted.rest);
    if (fromExtract) return fromExtract;
  }

  return { operations: [], summary: stripPromptEcho(trimmed) };
}

/**
 * Normalize an ai-chat model payload into operations + a user-facing summary.
 * Accepts a raw string, a parsed `{ operations, summary }` object, or the
 * `{ result, raw }` envelope returned by the edge function.
 */
export function parseAgentChatContent(input: unknown): AgentChatResult {
  if (input == null) return { operations: [], summary: "" };

  if (typeof input === "string") return parseFromText(input);

  if (Array.isArray(input)) {
    const text = input
      .map((part) => (typeof part === "string" ? part : isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("");
    return parseFromText(text);
  }

  if (!isRecord(input)) return { operations: [], summary: "" };

  if ("result" in input || "raw" in input || "content" in input) {
    const result = isRecord(input.result) ? input.result : null;
    const rawText =
      typeof input.raw === "string"
        ? input.raw
        : typeof input.content === "string"
          ? input.content
          : "";

    const fromRaw = rawText ? parseFromText(rawText) : { operations: [] as AgentOperation[], summary: "" };
    const resultOps = result ? asOperations(result.operations) : [];
    const resultSummary = result && typeof result.summary === "string" ? unwrapSummary(result.summary) : "";

    const operations = resultOps.length > 0 ? resultOps : fromRaw.operations;
    let summary = "";
    if (resultSummary && !looksLikeAgentJsonText(resultSummary)) {
      summary = resultSummary;
    } else if (fromRaw.summary && !looksLikeAgentJsonText(fromRaw.summary)) {
      summary = fromRaw.summary;
    } else {
      summary = resultSummary || fromRaw.summary || fallbackFromOperations(operations);
    }
    return { operations, summary };
  }

  if ("operations" in input || "summary" in input) {
    const rest = "";
    return {
      operations: asOperations(input.operations),
      summary: humanSummary(input, rest),
    };
  }

  return { operations: [], summary: "" };
}

/** Strip leaked agent JSON from a bubble so history/preview never show payloads. */
export function sanitizeAssistantContent(content: string): string {
  if (!content || !/"operations"\s*:/.test(content)) return content;
  const parsed = parseFromText(content);
  if (!parsed.summary || looksLikeAgentJsonText(parsed.summary)) {
    return fallbackFromOperations(parsed.operations) || content;
  }
  return parsed.summary;
}
