import { describe, expect, it } from "vitest";
import {
  parseAgentChatContent,
  sanitizeAssistantContent,
} from "./parseAgentChat";

const HAKODATE_TOKYO_JSON =
  '{"operations":[{"module":"todo","action":"update","data":{"match":{"title":"处理函馆照片"},"update":{"category":"生活"}}},{"module":"todo","action":"update","data":{"match":{"title":"处理东京照片"},"update":{"category":"生活"}}}],"summary":"已将两个未分类的照片处理待办「处理函馆照片」和「处理东京照片」的分类改为「生活」"}';

describe("parseAgentChatContent", () => {
  it("parses a clean JSON object", () => {
    const parsed = parseAgentChatContent(HAKODATE_TOKYO_JSON);
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.operations[0]).toMatchObject({
      module: "todo",
      action: "update",
    });
    expect(parsed.summary).toBe(
      "已将两个未分类的照片处理待办「处理函馆照片」和「处理东京照片」的分类改为「生活」",
    );
  });

  it("extracts operations when the model appends confirmation prose", () => {
    const raw = `${HAKODATE_TOKYO_JSON}

用户: 帮我把未分类的两个处理照片的待办改成生活分类
让我确认一下这两条：处理函馆照片、处理东京照片。确认后我帮你改成「生活」分类。`;

    const parsed = parseAgentChatContent(raw);

    expect(parsed.operations).toHaveLength(2);
    expect(parsed.summary).not.toMatch(/\{\s*"operations"/);
    expect(parsed.summary).toContain("让我确认一下这两条");
    expect(parsed.summary).not.toMatch(/^用户[:：]/m);
  });

  it("recovers operations when the server fell back to dumping raw JSON into summary", () => {
    const raw = `${HAKODATE_TOKYO_JSON}\n\n用户: 帮我把未分类的两个处理照片的待办改成生活分类`;
    const parsed = parseAgentChatContent({
      result: { operations: [], summary: raw.slice(0, 500) },
      raw,
    });
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.summary).not.toMatch(/\{\s*"operations"/);
    expect(parsed.summary).toContain("生活");
  });

  it("never uses the raw JSON payload as the visible summary", () => {
    const parsed = parseAgentChatContent(
      '{"operations":[{"module":"todo","action":"update","data":{"match":{"title":"买菜"},"update":{"is_completed":true}}}]}',
    );
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.summary.trim().startsWith("{")).toBe(false);
    expect(parsed.summary).not.toMatch(/"operations"/);
  });

  it("unwraps JSON dumped into the summary field", () => {
    const parsed = parseAgentChatContent({
      operations: [{ module: "todo", action: "update", data: { match: { title: "买菜" }, update: { is_completed: true } } }],
      summary: '{"operations":[],"summary":"将待办「买菜」标记为已完成"}',
    });
    expect(parsed.summary).toBe("将待办「买菜」标记为已完成");
  });

  it("extracts JSON from a markdown fence with trailing text", () => {
    const parsed = parseAgentChatContent(
      '```json\n{"operations":[],"summary":"你好，我可以帮你记账"}\n```\n还有别的问题吗？',
    );
    expect(parsed.operations).toEqual([]);
    expect(parsed.summary).toContain("你好，我可以帮你记账");
    expect(parsed.summary).not.toMatch(/```/);
  });

  it("keeps ordinary chat text when there is no JSON", () => {
    const parsed = parseAgentChatContent("今天天气不错，要不要记一笔账？");
    expect(parsed.operations).toEqual([]);
    expect(parsed.summary).toBe("今天天气不错，要不要记一笔账？");
  });

  it("prefers result.summary over raw when both are present and summary is human text", () => {
    const parsed = parseAgentChatContent({
      result: { operations: [], summary: "冰箱里还有 3 个鸡蛋" },
      raw: HAKODATE_TOKYO_JSON,
    });
    expect(parsed.summary).toBe("冰箱里还有 3 个鸡蛋");
  });
});

describe("sanitizeAssistantContent", () => {
  it("strips a leading operations JSON blob from a chat bubble", () => {
    const leaked = `${HAKODATE_TOKYO_JSON}

让我确认一下这两条：处理函馆照片、处理东京照片。`;
    const visible = sanitizeAssistantContent(leaked);
    expect(visible).not.toMatch(/\{\s*"operations"/);
    expect(visible).toContain("处理函馆照片");
  });

  it("leaves already-human preview text unchanged", () => {
    const preview =
      "已将待办分类改为「生活」\n\n将执行以下操作：\n• 更新 待办「处理函馆照片」";
    expect(sanitizeAssistantContent(preview)).toBe(preview);
  });
});
