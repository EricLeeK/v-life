import type {
  NewspaperEntry,
  NewspaperImageConfig,
  NewspaperListItem,
  NewspaperPreferences,
  NewspaperReport,
  NewspaperStyle,
} from "../../supabase/functions/_shared/newspaperTypes";

export interface NewspaperDemoState {
  reports: NewspaperReport[];
  preferences: NewspaperPreferences;
  styles: NewspaperStyle[];
  config: NewspaperImageConfig;
}
export const NEWSPAPER_DEMO_KEY = "vlife-newspaper-demo-v1";
const stamp = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const options = {
  provider: "grsai" as const,
  model: "gpt-image-2-vip",
  size: "auto",
  quality: "high",
  aspect_ratio: "auto",
};
export function createNewspaperDemo(now = new Date()): NewspaperDemoState {
  const today = new Date(now.getTime() - 4 * 60 * 60 * 1000).toLocaleDateString(
    "sv-SE",
    { timeZone: "Asia/Shanghai" },
  );
  const styles: NewspaperStyle[] = [{
    id: "demo-editorial",
    name: "纸上日常",
    prompt_template:
      "以温暖、克制的编辑插画描绘 {{date}} 的日常。栏目：{{section}}。内容：{{content}}。画面不出现文字，不虚构新的经历。",
    is_default: true,
    ...options,
    reference_images: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }];
  const reports = [0, 1, 2, 3, 7, 20, 35, 60].map(
    (offset, index): NewspaperReport => {
      const date = new Date(`${today}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() - offset);
      const day = date.toISOString().slice(0, 10);
      const entry = (
        id: string,
        title: string,
        body: string,
        source: string,
        time: string,
        status: NewspaperEntry["status"] = "recorded",
      ): NewspaperEntry => ({
        id: `${day}-${id}`,
        source,
        source_id: `demo-${id}`,
        source_url: source === "learning_notes"
          ? "/learning-notes"
          : source === "thoughts"
          ? "/thoughts"
          : source === "finance_records"
          ? "/finance"
          : source === "calorie_records"
          ? "/calories"
          : "/today",
        title,
        body,
        time: `${day}T${time}:00+08:00`,
        date: day,
        status,
      });
      const titles = [
        "把普通的一天，认真收好",
        "慢一点，也在向前",
        "在生活的细节里找到节奏",
        "给心里的想法留一页纸",
      ];
      return {
        id: `demo-report-${day}`,
        date: day,
        status: offset === 0
          ? "draft"
          : offset > 30
          ? "reconstructed"
          : "archived",
        timezone: "Asia/Shanghai",
        day_start_hour: 4,
        revision: 1,
        snapshot: {
          date: day,
          timezone: "Asia/Shanghai",
          day_start_hour: 4,
          captured_at: now.toISOString(),
          source_fingerprint: `demo-${day}`,
          coverage: [],
          metrics: [{ label: "完成待办", value: 3, unit: "项" }, {
            label: "学习记录",
            value: 2,
            unit: "篇",
          }, { label: "支出", value: 68, unit: "CNY" }],
          sections: [
            {
              id: "chronicle",
              title: "今日纪事",
              items: [
                entry(
                  "walk",
                  "晨间散步，让一天从容开始",
                  "沿着河边走了二十分钟，回家后整理了今天的待办。没有急着把所有事情都塞进上午。",
                  "daily_tasks",
                  "08:10",
                  "completed",
                ),
                entry(
                  "work",
                  titles[index % 4],
                  "完成了本周项目材料的第一轮整理，给重要的事情留出了连续、不被打断的时间。",
                  "daily_tasks",
                  "14:30",
                  "completed",
                ),
                entry(
                  "read",
                  "晚间阅读",
                  "计划在睡前读二十页，留一点时间给自己的节奏。",
                  "schedule_events",
                  "21:00",
                  "planned",
                ),
              ],
            },
            {
              id: "learning",
              title: "学习手记",
              items: [
                entry(
                  "learn",
                  "先理解，再记住",
                  "今天复习了逻辑判断中的充分条件与必要条件。\n\n“如果 A，那么 B”只说明 A 能推出 B；逆命题并不总成立。练习时先圈出条件，再画出关系，最后看选项。\n\n把做错的两道题重新写了一遍，发现错误来自把“所有”读成了“有些”。下次先检查量词，而不是急着套方法。",
                  "learning_notes",
                  "10:20",
                ),
                entry(
                  "note",
                  "把问题写清楚，也是解决的一部分",
                  "将复杂任务拆成可检查的小步骤。每一个步骤，都应该有明确的输入、行动和完成标准。",
                  "learning_notes",
                  "16:00",
                ),
              ],
            },
            {
              id: "finance",
              title: "生活账本",
              items: [
                entry(
                  "lunch",
                  "午餐 · ¥32",
                  "街角小店的工作日午餐。分类：餐饮；支出：32 CNY。",
                  "finance_records",
                  "12:30",
                ),
                entry(
                  "book",
                  "书店 · ¥36",
                  "买了一本想读很久的书。分类：学习；支出：36 CNY。",
                  "finance_records",
                  "18:20",
                ),
              ],
            },
            {
              id: "health",
              title: "身体与日常",
              items: [
                entry(
                  "meal",
                  "今天的饮食记录",
                  "早餐：燕麦、牛奶与鸡蛋，约 420 kcal。午餐：蔬菜、鸡肉与米饭，约 650 kcal。记录仍不完整，不据此评价全天摄入。",
                  "calorie_records",
                  "12:40",
                ),
                entry(
                  "exercise",
                  "散步 20 分钟",
                  "下楼走一走，比一直坐着舒服。运动估算消耗 80 kcal。",
                  "calorie_records",
                  "19:00",
                ),
              ],
            },
            {
              id: "thoughts",
              title: "留给自己的话",
              items: [
                entry(
                  "thought",
                  "允许日子留下空白",
                  "不是每一刻都需要产出。今天最喜欢的片刻，是傍晚走出书店，风刚好吹过来。\n\n想把这种不着急的感觉留住。生活里的小事，也值得认真记录。",
                  "thoughts",
                  "19:10",
                ),
              ],
            },
          ],
        },
        supplements: offset === 0 ? [] : [{
          id: `supp-${day}`,
          report_date: day,
          body:
            "下班后和朋友打了电话，聊了最近的生活。这个片刻没有出现在待办里，但想把它留在这里。",
          occurred_at: `${day}T20:30:00+08:00`,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        }],
        review: null,
        assets: [],
        jobs: [],
        hidden_sections: [],
        source_changed: false,
        review_stale: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    },
  );
  return {
    reports,
    styles,
    preferences: {
      enabled: true,
      enabled_from: reports[reports.length - 1].date,
      timezone: "Asia/Shanghai",
      day_start_hour: 4,
    },
    config: {
      ...options,
      configured: true,
      key_hint: "演示配置",
      base_url: "https://grsai.dakka.com.cn",
    },
  };
}
export function newspaperListItem(report: NewspaperReport): NewspaperListItem {
  const items = report.snapshot.sections.flatMap((s) => s.items);
  return {
    id: report.id,
    date: report.date,
    status: report.status,
    revision: report.revision,
    title: items.find((i) => i.source === "thoughts")?.title || "生活日报",
    excerpt: items.find((i) => i.source === "thoughts")?.body ||
      items[0]?.body || "这一天，等待你留下记录。",
    record_count: items.length,
    has_image: report.assets.length > 0,
    has_review: !!report.review,
    updated_at: report.updated_at,
    thumbnail_url: report.assets.find((a) => a.active)?.thumbnail_url,
  };
}
export function executeNewspaperDemo(
  original: NewspaperDemoState,
  action: string,
  input: Record<string, any> = {},
): { state: NewspaperDemoState; data: any } {
  const state = structuredClone(original);
  const now = stamp();
  if (action === "list") {
    const filtered = state.reports.filter((r) =>
      (!input.q ||
        JSON.stringify(r).toLocaleLowerCase().includes(
          String(input.q).toLocaleLowerCase(),
        )) &&
      (!input.date_from || r.date >= input.date_from) &&
      (!input.date_to || r.date <= input.date_to)
    ).sort((a, b) => b.date.localeCompare(a.date));
    const offset = Number(input.offset) || 0;
    const limit = Number(input.limit) || 100;
    const items = filtered.slice(offset, offset + limit).map(newspaperListItem);
    const hasMore = offset + limit < filtered.length;
    return {
      state,
      data: { items, hasMore, nextOffset: hasMore ? offset + limit : null },
    };
  }
  if (action === "preferences_get") return { state, data: state.preferences };
  if (action === "preferences_save") {
    state.preferences = { ...state.preferences, ...input };
    return { state, data: state.preferences };
  }
  if (action === "style_list") return { state, data: state.styles };
  if (action === "style_save") {
    const style = {
      ...input,
      id: input.id || uid(),
      created_at: state.styles.find((s) => s.id === input.id)?.created_at ||
        now,
      updated_at: now,
    } as NewspaperStyle;
    if (style.is_default) state.styles.forEach((s) => s.is_default = false);
    state.styles = state.styles.filter((s) => s.id !== style.id).concat(style);
    return { state, data: style };
  }
  if (action === "style_delete") {
    state.styles = state.styles.filter((s) => s.id !== input.id);
    return { state, data: { deleted: true } };
  }
  if (action === "image_config_get") return { state, data: state.config };
  if (action === "image_config_save") {
    const { api_key: _key, ...safe } = input;
    state.config = {
      ...state.config,
      ...safe,
      configured: true,
      key_hint: "演示配置",
    };
    return { state, data: state.config };
  }
  if (action === "reference_upload") {
    return {
      state,
      data: {
        path: `data:${input.mime};base64,${input.base64}`,
        url: `data:${input.mime};base64,${input.base64}`,
      },
    };
  }
  let report = state.reports.find((r) =>
    r.date === input.date || r.assets.some((a) => a.id === input.id) ||
    r.jobs.some((j) => j.id === input.id)
  );
  if (!report && input.date && /^(get|refresh)$/.test(action)) {
    report =
      createNewspaperDemo(new Date(`${input.date}T12:00:00Z`)).reports[0];
    report.date = input.date;
    report.id = `demo-report-${input.date}`;
    report.status = "reconstructed";
    report.snapshot.sections.forEach((s) => s.items = []);
    report.snapshot.metrics = [];
    state.reports.push(report);
    state.reports.sort((a, b) => b.date.localeCompare(a.date));
  }
  if (!report) throw new Error("没有找到这份日报，请重新打开。");
  if (action === "get") return { state, data: report };
  if (action === "refresh") {
    report.revision += 1;
    report.source_changed = false;
    report.review_stale = !!report.review;
    report.updated_at = now;
    return { state, data: report };
  }
  if (action === "report_update") {
    report.hidden_sections = input.hidden_sections;
    return { state, data: report };
  }
  if (action === "source_get") {
    const entry = report.snapshot.sections.flatMap((s) => s.items).find((i) =>
      i.source_id === input.source_id
    );
    return {
      state,
      data: {
        available: !!entry,
        snapshot: entry || null,
        source_url: entry?.source_url || null,
      },
    };
  }
  if (action === "supplement_save") {
    const existing = report.supplements.find((s) => s.id === input.id);
    if (
      input.id &&
      (!existing || existing.updated_at !== input.expected_updated_at)
    ) throw new Error("这条补充已发生变化，请重新打开后编辑。");
    const saved = {
      id: input.id || uid(),
      report_date: report.date,
      body: input.body,
      occurred_at: input.occurred_at ?? null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    report.supplements = report.supplements.filter((s) => s.id !== saved.id)
      .concat(saved);
    report.review_stale = !!report.review;
    return { state, data: saved };
  }
  if (action === "supplement_delete") {
    const row = report.supplements.find((s) => s.id === input.id);
    if (row?.updated_at !== input.expected_updated_at) {
      throw new Error("这条补充已发生变化，请刷新后重试。");
    }
    report.supplements = report.supplements.filter((s) => s.id !== input.id);
    report.review_stale = !!report.review;
    return { state, data: { deleted: true } };
  }
  if (action === "review_generate") {
    report.review = {
      overview:
        "演示复盘：这一天留下了学习、生活与感受的记录。以下仅用于展示复盘的呈现方式。",
      achievements: ["完成了项目材料整理，也为学习留出了时间。"],
      difficulties: ["饮食记录尚未覆盖全天，无法判断完整摄入。"],
      observations: ["学习笔记与随想记录展示了不同类型的投入。"],
      suggestions: ["明天留 20 分钟回看今天的两道错题"],
      source_revision: report.revision,
      source_fingerprint: report.snapshot.source_fingerprint,
      supplements_fingerprint: JSON.stringify(report.supplements),
      generated_at: now,
    };
    report.review_stale = false;
    return { state, data: report.review };
  }
  if (action === "image_generate") {
    const id = uid();
    const section = input.section_id || "main";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#e7e1d2"/><rect x="60" y="60" width="1080" height="580" fill="none" stroke="#71634c"/><path d="M60 530H1140M870 60V640" stroke="#71634c"/><text x="110" y="275" font-family="Georgia,serif" font-size="112" fill="#40382a">A DAY, KEPT.</text><text x="115" y="360" font-family="sans-serif" font-size="28" fill="#40382a">DEMO IMAGE / ${report.date}</text><text x="115" y="595" font-family="sans-serif" font-size="24" fill="#40382a">V-LIFE DAILY</text></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    report.assets.forEach((a) => {
      if (a.section_id === section) a.active = false;
    });
    const asset = {
      id,
      report_date: report.date,
      section_id: section,
      storage_path: `demo/${id}.svg`,
      thumbnail_path: `demo/${id}.svg`,
      width: 1200,
      height: 700,
      caption: "演示配图 · 仅展示版面，未调用 AI 服务",
      active: true,
      prompt: input.prompt || state.styles.find((s) =>
        s.is_default
      )?.prompt_template || "",
      style_snapshot: state.styles.find((s) => s.id === input.style_id) ||
        state.styles[0] || null,
      options: { ...options, ...input.options },
      source_revision: report.revision,
      created_at: now,
      url,
      thumbnail_url: url,
    };
    report.assets.unshift(asset);
    const job = {
      id: uid(),
      report_date: report.date,
      section_id: section,
      status: "succeeded" as const,
      error: null,
      asset_id: id,
      created_at: now,
      updated_at: now,
    };
    report.jobs.unshift(job);
    return { state, data: job };
  }
  if (action === "image_status") return { state, data: report.jobs };
  if (action === "image_select") {
    const selected = report.assets.find((a) => a.id === input.id)!;
    report.assets.forEach((a) => {
      if (a.section_id === selected.section_id) a.active = a.id === selected.id;
    });
    return { state, data: selected };
  }
  if (action === "image_caption") {
    const selected = report.assets.find((a) => a.id === input.id)!;
    selected.caption = input.caption;
    return { state, data: selected };
  }
  throw new Error(`演示模式暂不支持 ${action}`);
}
