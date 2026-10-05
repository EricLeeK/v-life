import { newspaperSpine } from "../../supabase/functions/_shared/newspaperHeadline";
import type {
  NewspaperEntry,
  NewspaperImageAsset,
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
export const NEWSPAPER_DEMO_KEY = "vlife-newspaper-demo-v3";
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
      const leads: [string, string][] = [
        ["晨间散步，让一天从容开始", "沿着河边走了二十分钟，回家后整理了今天的待办。没有急着把所有事情都塞进上午。"],
        ["把阳台的绿萝分了盆", "换了新土，剪掉两根发黄的枝条。花了半小时，弄脏了手，心情却很干净。"],
        ["和老同学吃了一顿久违的饭", "聊到各自这几年换过的城市和工作。原来大家都在慢慢找到自己的节奏。"],
        ["第一次完整跑完五公里", "配速不快，中途想停了两次，最后还是跑到了终点。腿很酸，但很踏实。"],
        ["整理了一整个下午的书架", "按读过、在读、想读重新分了三层，翻出好几本忘了借给谁又还回来的书。"],
        ["雨天在家做了一锅番茄牛腩", "炖了两个小时，屋子里都是香味。留了一盒给明天的午饭。"],
        ["去郊外看了一场日落", "坐在山坡上等了四十分钟，天色从橙变紫，手机拍不出那种颜色。"],
        ["把拖了很久的体检做完了", "报告大体正常，医生提醒少熬夜、多喝水。决定从这周开始十一点前睡。"],
      ];
      const [leadTitle, leadBody] = leads[index % leads.length];
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
                  leadTitle,
                  leadBody,
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
              title: "学习与成长",
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
              title: "收支记录",
              items: [
                entry(
                  "lunch",
                  "工作日午餐",
                  "32 CNY · 餐饮\n街角小店，点了常吃的那份。",
                  "finance_records",
                  "12:30",
                ),
                entry(
                  "book",
                  "一本想读很久的书",
                  "36 CNY · 学习",
                  "finance_records",
                  "18:20",
                ),
              ],
            },
            {
              id: "health",
              title: "身体与饮食",
              items: [
                entry(
                  "meal",
                  "燕麦、牛奶与鸡蛋",
                  "饮食摄入：420 千卡 · 早餐",
                  "calorie_records",
                  "12:40",
                ),
                entry(
                  "exercise",
                  "散步 20 分钟",
                  "运动消耗：80 千卡 · 运动\n下楼走一走，比一直坐着舒服。",
                  "calorie_records",
                  "19:00",
                ),
              ],
            },
            {
              id: "thoughts",
              title: "想法与随笔",
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
  const yesterday = reports[1];
  if (yesterday) {
    yesterday.assets = [
      demoAsset(yesterday, "main", "main", "晨雾里的河岸。走慢一点，一天才有余地。", now),
      demoAsset(yesterday, "learning", "learning", "先画出条件，再画出关系。", now),
      demoAsset(yesterday, "thoughts", "thoughts", "傍晚走出书店，风刚好吹过来。", now),
    ];
    yesterday.review = {
      overview:
        "演示复盘：上午留给散步与整理，下午完成了项目材料的第一轮，晚上的阅读计划还没有落地。学习记录集中在逻辑判断，随想里反复出现「不着急」。",
      achievements: [
        "项目材料完成第一轮整理，并给重要的事留出了连续时间。",
        "复盘了逻辑判断里「充分条件」与「必要条件」，找到读错量词的原因。",
      ],
      difficulties: ["晚间阅读计划没有标记完成，记录里看不出是否开始。"],
      observations: [
        "上午先散步再排待办，下午的完成度更高（依据：两条已完成任务都在 14:30 前）。",
        "饮食只记录了午餐和晚餐，早餐缺失，无法判断全天摄入。",
      ],
      suggestions: ["睡前把明天的阅读安排在 21:30，只读二十页", "早餐也随手记一笔"],
      source_revision: yesterday.revision,
      source_fingerprint: yesterday.snapshot.source_fingerprint,
      supplements_fingerprint: JSON.stringify(yesterday.supplements),
      generated_at: now.toISOString(),
    };
  }
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
const DEMO_ART: Record<string, { file: string; width: number; height: number }> = {
  main: { file: "main", width: 1600, height: 900 },
  learning: { file: "learning", width: 1400, height: 1050 },
  thoughts: { file: "thoughts", width: 1100, height: 1467 },
};
function demoAsset(
  report: NewspaperReport,
  section: NewspaperImageAsset["section_id"],
  art: string,
  caption: string,
  now: Date,
  extra: Partial<NewspaperImageAsset> = {},
): NewspaperImageAsset {
  const picked = DEMO_ART[art] ?? DEMO_ART.main;
  const url = `/newspaper-demo/${picked.file}.webp`;
  const id = uid();
  return {
    id,
    report_date: report.date,
    section_id: section,
    storage_path: `demo/${id}.webp`,
    thumbnail_path: `demo/${id}.webp`,
    width: picked.width,
    height: picked.height,
    caption,
    active: true,
    prompt: "",
    style_snapshot: null,
    options,
    source_revision: report.revision,
    created_at: now.toISOString(),
    url,
    thumbnail_url: url,
    ...extra,
  };
}
export function newspaperListItem(report: NewspaperReport): NewspaperListItem {
  const items = report.snapshot.sections.flatMap((s) => s.items);
  return {
    id: report.id,
    date: report.date,
    status: report.status,
    revision: report.revision,
    ...newspaperSpine(report.snapshot.sections),
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
    const section = input.section_id || "main";
    report.assets.forEach((a) => {
      if (a.section_id === section) a.active = false;
    });
    const asset = demoAsset(
      report,
      section,
      section in DEMO_ART ? section : "main",
      "演示配图 · 仅展示版面，未调用 AI 服务",
      new Date(now),
      {
        prompt: input.prompt || state.styles.find((s) =>
          s.is_default
        )?.prompt_template || "",
        style_snapshot: state.styles.find((s) => s.id === input.style_id) ||
          state.styles[0] || null,
        options: { ...options, ...input.options },
      },
    );
    const id = asset.id;
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
