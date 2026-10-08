import { submitPrepAttempt } from "./prepService.ts";
import { AgentDataError } from "./agentDataService.ts";
export const PREP_ENTITIES = [
  "exams",
  "banks",
  "questions",
  "materials",
  "exam_banks",
  "bank_questions",
  "exam_questions",
  "papers",
  "paper_questions",
  "note_links",
  "pitfalls",
  "pitfall_questions",
  "review_states",
  "attempts",
  "content_versions",
] as const;
const writable: Record<string, string[]> = {
  exams: ["name", "exam_date", "template", "is_primary", "is_archived"],
  banks: ["name", "description_md"],
  questions: [
    "stem_md",
    "question_type",
    "options",
    "correct_answer",
    "explanation_md",
    "analysis_md",
    "tags",
    "target_seconds",
    "material_id",
    "status",
  ],
  materials: ["title", "content_md"],
  exam_banks: ["exam_id", "bank_id"],
  bank_questions: ["bank_id", "question_id"],
  exam_questions: ["exam_id", "question_id", "mode"],
  papers: [
    "name",
    "exam_id",
    "taken_date",
    "source",
    "is_mock",
    "sections",
    "total_questions",
    "total_correct",
    "duration_minutes",
    "total_score",
    "notes",
    "metadata",
  ],
  paper_questions: ["paper_id", "question_id", "source_number", "section_key"],
  note_links: ["question_id", "note_id"],
  pitfalls: ["title", "content_md", "tags", "is_archived"],
  pitfall_questions: ["pitfall_id", "question_id"],
};
export const PREP_GUIDE = {
  workflow:
    "创建考试和共享题库 → 上传图片 → 创建共享材料 → 逐子题创建草稿 → 核对后设 active → 关联题库/套卷。题目 ID 是跨考试与 V 记共用的身份。",
  images:
    "上传 PNG/JPEG/WebP。图推选项建议 1:1 同组同画布；题干 4:3 或 3:2；图表保留自然比例，不裁内容。图片以 ![说明](asset:资产ID) 嵌入 content_md，渲染时解析签名地址。",
  review:
    "submit_attempt 必须传 idempotency_key、expected_revision、content_revision、answer、duration_seconds、mode、rating。服务端判断红黄标和 FSRS，不接受下一次排期。",
  examples: [
    {
      kind: "图推",
      question_type: "single",
      stem_md: "观察规律，选择下一幅图。",
      options: [
        { key: "A", content_md: "![选项 A](asset:已上传A图的资产ID)" },
        { key: "B", content_md: "![选项 B](asset:已上传B图的资产ID)" },
        { key: "C", content_md: "![选项 C](asset:已上传C图的资产ID)" },
        { key: "D", content_md: "![选项 D](asset:已上传D图的资产ID)" },
      ],
      correct_answer: ["A"],
    },
    {
      kind: "资料分析",
      workflow:
        "一条 materials(content_md) + 五条 questions(material_id 相同)，五道题分别有答案和复习状态。",
    },
    {
      kind: "常识政治",
      explanation_md:
        "## 正确答案与依据\n…\n## 必背要点\n- 主体\n- 条件\n## 易混辨析\n…\n## 记忆提示\n…",
    },
    {
      kind: "主观题",
      question_type: "text",
      explanation_md:
        "## 评分要点\n…\n## 参考作答\n…\n## 我的遗漏\n…\n## 改写建议\n…",
    },
  ],
};
export async function executePrepOperation(
  ctx: any,
  action: string,
  input: Record<string, any> = {},
): Promise<any> {
  const read = ["list", "get", "guide", "due", "asset_url"].includes(action);
  if (!ctx.permissions.read || (!read && !ctx.permissions.write))
    throw new AgentDataError("PERMISSION_DENIED", "需要备考读取及相应写入权限");
  if (["user_id", "userId", "admin", "permissions"].some((k) => k in input))
    throw new AgentDataError("INVALID_INPUT", "不接受身份字段");
  const check = (r: any) => {
    if (r.error)
      throw new AgentDataError(
        r.error.code === "40001" ? "CONFLICT" : "INVALID_INPUT",
        r.error.message,
      );
    return r.data;
  };
  if (action === "guide") return PREP_GUIDE;
  if (action === "submit_attempt")
    return submitPrepAttempt(ctx.admin, ctx.userId, input as any);
  if (action === "batch_create") {
    if (
      !Array.isArray(input.items) ||
      input.items.length < 1 ||
      input.items.length > 50 ||
      input.items.some((i: any) => !i.id)
    )
      throw new AgentDataError(
        "INVALID_INPUT",
        "批量需 1–50 条，每条提供稳定 UUID id 供重试",
      );
    const results = [];
    for (const item of input.items) {
      try {
        results.push({
          id: item.id,
          ok: true,
          data: await executePrepOperation(ctx, "create", item),
        });
      } catch (e) {
        results.push({
          id: item.id,
          ok: false,
          error: e instanceof Error ? e.message : "保存失败",
        });
      }
    }
    return { results };
  }
  if (action === "due")
    return check(
      await ctx.db
        .from("prep_review_states")
        .select("*,prep_questions!inner(status)")
        .eq("prep_questions.status", "active")
        .eq("paused", false)
        .lte("due_at", new Date().toISOString())
        .order("due_at")
        .range(
          input.offset || 0,
          (input.offset || 0) + Math.min(input.limit || 50, 200) - 1,
        ),
    );
  if (action === "asset_upload") {
    if (
      typeof input.base64 !== "string" ||
      input.base64.length > 14_000_000 ||
      !["image/png", "image/jpeg", "image/webp"].includes(input.mime_type)
    )
      throw new AgentDataError("INVALID_INPUT", "图片格式或大小无效");
    const bytes = Uint8Array.from(atob(input.base64), (c) => c.charCodeAt(0));
    const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71,
      jpeg = bytes[0] === 255 && bytes[1] === 216,
      webp =
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (
      !(input.mime_type === "image/png"
        ? png
        : input.mime_type === "image/jpeg"
          ? jpeg
          : webp)
    )
      throw new AgentDataError("INVALID_INPUT", "文件内容与图片格式不符");
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const path = `${ctx.userId}/${hash}.${png ? "png" : jpeg ? "jpg" : "webp"}`;
    const uploaded = await ctx.admin.storage
      .from("prep-assets")
      .upload(path, bytes, { contentType: input.mime_type, upsert: false });
    if (
      uploaded.error &&
      String(uploaded.error.statusCode) !== "409" &&
      !uploaded.error.message.includes("already exists")
    )
      throw new AgentDataError("INVALID_INPUT", "图片上传失败");
    const record = check(
      await ctx.db
        .from("prep_assets")
        .insert({
          user_id: ctx.userId,
          question_id: input.question_id || null,
          material_id: input.material_id || null,
          paper_id: input.paper_id || null,
          storage_path: path,
          sha256: hash,
          mime_type: input.mime_type,
          metadata: {
            alt: input.alt || "",
            width: input.width,
            height: input.height,
          },
        })
        .select()
        .single(),
    );
    return {
      asset_id: record.id,
      markdown: `![${input.alt || "配图"}](asset:${record.id})`,
    };
  }
  if (action === "asset_url") {
    const asset = check(
      await ctx.db.from("prep_assets").select("*").eq("id", input.id).single(),
    );
    if (!asset.storage_path) return { url: asset.url };
    if (!asset.storage_path.startsWith(`${ctx.userId}/`))
      throw new AgentDataError("PERMISSION_DENIED", "图片不属于当前账户");
    const result = await ctx.admin.storage
      .from("prep-assets")
      .createSignedUrl(asset.storage_path, 3600);
    return check(result);
  }
  if (!PREP_ENTITIES.includes(input.entity))
    throw new AgentDataError("INVALID_INPUT", "未知备考对象");
  const table = `prep_${input.entity}`;
  if (action === "list") {
    let q = ctx.db
      .from(table)
      .select("*")
      .order("created_at", { ascending: false }).order("id");
    if(input.question_id && ["attempts", "review_states", "paper_questions", "bank_questions", "exam_questions", "note_links", "pitfall_questions"].includes(input.entity)) q = q.eq("question_id", input.question_id);
    if (input.exam_id && input.entity === "questions") {
      const ids = check(
        await ctx.db.rpc("prep_exam_question_ids", {
          p_exam_id: input.exam_id,
        }),
      );
      q = q.in(
        "id",
        ids.map((r: any) => (typeof r === "string" ? r : r.question_id)),
      );
    }
    return check(
      await q.range(
        input.offset || 0,
        (input.offset || 0) + Math.min(input.limit || 50, 200) - 1,
      ),
    );
  }
  if (action === "get")
    return check(
      await ctx.db.from(table).select("*").eq("id", input.id).single(),
    );
  if(!writable[input.entity]) throw new AgentDataError("PERMISSION_DENIED", "此对象只读，复习记录请使用 submit_attempt");
  const record = input.record;
  if (!record || typeof record !== "object" || Array.isArray(record))
    throw new AgentDataError("INVALID_INPUT", "record 必须是对象");
  if (Object.keys(record).some((k) => !writable[input.entity].includes(k)))
    throw new AgentDataError("INVALID_INPUT", "存在不可写字段");
  if (action === "update") {
    if (input.entity === "materials")
      return check(
        await ctx.db.rpc("prep_edit_material", {
          p_material_id: input.id,
          p_expected_revision: input.expected_revision,
          p_content_md: record.content_md,
          p_title: record.title ?? null,
        }),
      );
    if (input.entity === "questions")
      return check(
        await ctx.db.rpc("prep_edit_question", {
          p_question_id: input.id,
          p_expected_revision: input.expected_revision,
          p_patch: record,
        }),
      );
    return check(
      await ctx.db
        .from(table)
        .update(record)
        .eq("id", input.id)
        .select()
        .single(),
    );
  }
  if (action === "create") {
    if (input.id) {
      const existing = check(
        await ctx.db.from(table).select("*").eq("id", input.id).maybeSingle(),
      );
      if (existing) {
        for (const [key, value] of Object.entries(record)) {
          if (JSON.stringify(existing[key]) !== JSON.stringify(value))
            throw new AgentDataError(
              "CONFLICT",
              "该 ID 已存在且内容不同；请先读取版本再更新",
            );
        }
        return existing;
      }
    }
    return check(
      await ctx.db
        .from(table)
        .insert({
          ...record,
          user_id: ctx.userId,
          ...(input.id ? { id: input.id } : {}),
        })
        .select()
        .single(),
    );
  }

  throw new AgentDataError("INVALID_INPUT", "未知备考操作");
}
