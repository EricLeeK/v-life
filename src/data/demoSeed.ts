// Demo seed data for Guest Tour mode
// Persona: 小明 (Xiao Ming) — Chinese grad student in Sapporo, Japan
// Dates are generated dynamically relative to the current date

// ============ Fixed UUIDs ============
const DEMO_USER = "demo-00000000-0000-0000-0000-000000000001";
const SETTINGS_ID = "demo-10000000-0000-0000-0000-000000000001";

// Schedule event IDs are now generated dynamically per date

// Project UUIDs
const PROJ_FEM = "demo-30000000-0000-0000-0000-000000000001";
const PROJ_BLOG = "demo-30000000-0000-0000-0000-000000000002";
const PROJ_THESIS = "demo-30000000-0000-0000-0000-000000000003";

// Learning course UUIDs
const COURSE_DL = "demo-60000000-0000-0000-0000-000000000001";
const COURSE_PROB = "demo-60000000-0000-0000-0000-000000000002";

// Task tag UUIDs
const TAG_URGENT = "demo-40000000-0000-0000-0000-000000000001";
const TAG_INPROG = "demo-40000000-0000-0000-0000-000000000002";
const TAG_REVIEW = "demo-40000000-0000-0000-0000-000000000003";
const TAG_DONE = "demo-40000000-0000-0000-0000-000000000004";

// Project task UUIDs (FEM project)
const TASK_FEM_AUTODIFF = "demo-50000000-0000-0000-0000-000000000001";
const TASK_FEM_TESTS = "demo-50000000-0000-0000-0000-000000000002";
const TASK_FEM_SURVEY = "demo-50000000-0000-0000-0000-000000000003";
const TASK_FEM_MESH = "demo-50000000-0000-0000-0000-000000000004";
// Blog project
const TASK_BLOG_SETUP = "demo-50000000-0000-0000-0000-000000000005";
const TASK_BLOG_ARTICLE = "demo-50000000-0000-0000-0000-000000000006";
const TASK_BLOG_DEPLOY = "demo-50000000-0000-0000-0000-000000000007";
// Thesis project
const TASK_THESIS_LIT = "demo-50000000-0000-0000-0000-000000000008";
const TASK_THESIS_EXPT = "demo-50000000-0000-0000-0000-000000000009";
const TASK_THESIS_CH1 = "demo-50000000-0000-0000-0000-000000000010";
// Habit task UUIDs
const HABIT_GYM = "demo-50000000-0000-0000-0000-000000000011";
const HABIT_EARLY = "demo-50000000-0000-0000-0000-000000000012";
const HABIT_READ = "demo-50000000-0000-0000-0000-000000000013";
// Daily task UUIDs
const DTASK_1 = "demo-dt000000-0000-0000-0000-000000000001";
const DTASK_2 = "demo-dt000000-0000-0000-0000-000000000002";
const DTASK_3 = "demo-dt000000-0000-0000-0000-000000000003";
const DTASK_4 = "demo-dt000000-0000-0000-0000-000000000004";
const DTASK_5 = "demo-dt000000-0000-0000-0000-000000000005";
const UPOINTS_ID = "demo-up000000-0000-0000-0000-000000000001";

// Shop item UUIDs
const SHOP_TITLE_BEGINNER = "demo-si000000-0000-0000-0000-000000000001";
const SHOP_TITLE_EXECUTOR = "demo-si000000-0000-0000-0000-000000000002";
const SHOP_TITLE_WARRIOR = "demo-si000000-0000-0000-0000-000000000003";
const SHOP_TITLE_MASTER = "demo-si000000-0000-0000-0000-000000000004";
const SHOP_TITLE_LEGEND = "demo-si000000-0000-0000-0000-000000000005";
const SHOP_TITLE_WARRIOR100 = "demo-si000000-0000-0000-0000-000000000006";
const SHOP_FRAME_BRONZE = "demo-si000000-0000-0000-0000-000000000007";
const SHOP_FRAME_SILVER = "demo-si000000-0000-0000-0000-000000000008";
const SHOP_FRAME_GOLD = "demo-si000000-0000-0000-0000-000000000009";
const SHOP_FRAME_CRYSTAL = "demo-si000000-0000-0000-0000-000000000010";
const SHOP_FRAME_FLAME = "demo-si000000-0000-0000-0000-000000000011";
const SHOP_FRAME_AURORA = "demo-si000000-0000-0000-0000-000000000012";
const SHOP_COUPON_REST = "demo-si000000-0000-0000-0000-000000000013";
const SHOP_COUPON_SKIP = "demo-si000000-0000-0000-0000-000000000014";
const SHOP_COUPON_GAMING = "demo-si000000-0000-0000-0000-000000000015";
const SHOP_COUPON_TREAT = "demo-si000000-0000-0000-0000-000000000016";
const SHOP_COUPON_SLEEP = "demo-si000000-0000-0000-0000-000000000017";

// Gacha pity UUID
const GACHA_PITY_ID = "demo-gp000000-0000-0000-0000-000000000001";

// ============ Settings ============
export const demoSettings = {
  id: SETTINGS_ID,
  user_id: DEMO_USER,
  display_name: "小明",
  ai_api_key: null,
  ai_base_url: null,
  ai_mode: null,
  ai_model: null,
  ai_platform: "openai",
  calorie_target: 1800,
  monthly_budget: 80000,
  target_weight: 72,
  exchange_rate_jpy_to_cny: 0.048,
  exchange_rate_updated_at: "2026-05-08T00:00:00+09:00",
  fasting_start_hour: 12,
  fasting_start_minute: 0,
  show_goals_in_schedule: true,
  timezone: "Asia/Tokyo",
  day_start_hour: 0,
  custom_thought_tags: null,
  hidden_features: [] as string[],
  fortune_profile: null as Record<string, unknown> | null,
  app_focus_mode: "full",
  created_at: "2026-04-01T00:00:00+09:00",
  updated_at: "2026-05-08T00:00:00+09:00",
};

// ============ Schedule Events (dynamic — relative to current date) ============
// Weekday class schedule: day-of-week (0=Sun..6=Sat) → events
const WEEKDAY_CLASSES: Record<number, Array<{ idSuffix: string; title: string; startHour: number; endHour: number; color: string; notes: string | null }>> = {
  1: [{ idSuffix: "math1", title: "高等数学 I", startHour: 9, endHour: 10.5, color: "#5b88b5", notes: "講義室 A301" }],
  2: [{ idSuffix: "dl1", title: "深度学习研讨", startHour: 14, endHour: 16, color: "#5b88b5", notes: "研讨室 B205" }],
  3: [{ idSuffix: "math2", title: "高等数学 II", startHour: 9, endHour: 10.5, color: "#5b88b5", notes: "講義室 A301" }],
  4: [{ idSuffix: "dl2", title: "深度学习研讨", startHour: 14, endHour: 16, color: "#5b88b5", notes: "研讨室 B205" }],
  5: [
    { idSuffix: "math3", title: "高等数学 III", startHour: 9, endHour: 10.5, color: "#5b88b5", notes: "講義室 A301" },
    { idSuffix: "meeting", title: "导师组会", startHour: 14, endHour: 16, color: "#8b7bb8", notes: "汇报FEM项目进展" },
  ],
};
const WEEKDAY_GYM_NOTES: Record<number, string> = {
  1: "腿部训练", 2: "背部+二头", 3: "肩部+核心", 4: "有氧+拉伸", 5: "胸部+三头",
};

function fmt(d: Date, hour: number, minute = 0): string {
  const dt = new Date(d);
  dt.setHours(hour, minute, 0, 0);
  return dt.toISOString();
}

function generateScheduleEvents(): typeof demoScheduleEvents {
  const events: typeof demoScheduleEvents = [];
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((dow + 6) % 7)); // Monday of this week
  mon.setHours(0, 0, 0, 0);

  for (let dayOffset = -14; dayOffset <= 14; dayOffset++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + dayOffset);
    const dayOfWeek = d.getDay();
    const dateStr = d.toISOString().split("T")[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const created = `${dateStr}T00:00:00+09:00`;

    // Wake up
    const wakeHour = isWeekend ? 9 : 7;
    events.push({
      id: `demo-se-wake-${dateStr}`, title: "起床",
      start_time: fmt(d, wakeHour), end_time: fmt(d, wakeHour, 30),
      importance: "normal", status: "confirmed", color: "#5b8c44", notes: null,
      parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
    });

    if (isWeekend) {
      // Weekend: just wake + sleep; Saturday has dinner with friends
      if (dayOfWeek === 6) {
        events.push({
          id: `demo-se-dinner-${dateStr}`, title: "和朋友聚餐",
          start_time: fmt(d, 18), end_time: fmt(d, 20),
          importance: "normal", status: "confirmed", color: "#8b7bb8", notes: "札幌站附近",
          parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
        });
      }
      if (dayOfWeek === 0) {
        events.push({
          id: `demo-se-video-${dateStr}`, title: "视频通话 彤彤",
          start_time: fmt(d, 15), end_time: fmt(d, 16),
          importance: "normal", status: "confirmed", color: "#8b7bb8", notes: null,
          parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
        });
      }
    } else {
      // Weekday: lunch, classes, gym, sleep
      events.push({
        id: `demo-se-lunch-${dateStr}`, title: "午餐",
        start_time: fmt(d, 12), end_time: fmt(d, 12, 45),
        importance: "normal", status: "confirmed", color: "#5b8c44", notes: null,
        parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
      });
      for (const cls of WEEKDAY_CLASSES[dayOfWeek] ?? []) {
        events.push({
          id: `demo-se-${cls.idSuffix}-${dateStr}`, title: cls.title,
          start_time: fmt(d, Math.floor(cls.startHour), (cls.startHour % 1) * 60),
          end_time: fmt(d, Math.floor(cls.endHour), (cls.endHour % 1) * 60),
          importance: "important", status: "confirmed", color: cls.color, notes: cls.notes,
          parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
        });
      }
      events.push({
        id: `demo-se-gym-${dateStr}`, title: "健身",
        start_time: fmt(d, 17), end_time: fmt(d, 18),
        importance: "normal", status: "confirmed", color: "#d17847",
        notes: WEEKDAY_GYM_NOTES[dayOfWeek] ?? null,
        parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
      });
    }

    // Sleep (every day)
    events.push({
      id: `demo-se-sleep-${dateStr}`, title: "睡觉",
      start_time: fmt(d, 23), end_time: fmt(d, 23, 30),
      importance: "normal", status: "confirmed", color: "#5b8c44", notes: null,
      parent_event_id: null, recurrence: null, created_at: created, updated_at: created, user_id: DEMO_USER,
    });
  }
  return events;
}

export const demoScheduleEvents = generateScheduleEvents();

// ============ Finance Records ============
const FX = 0.048;
export const demoFinanceRecords = [
  // Rent (April)
  { id: "demo-f0000000-0000-0000-0000-000000000001", name: "四月房租", amount: 35000, amount_cny: Math.round(35000 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "住房", date: "2026-04-01", notes: null, created_at: "2026-04-01T10:00:00+09:00", updated_at: "2026-04-01T10:00:00+09:00", user_id: DEMO_USER },
  // Rent (May)
  { id: "demo-f0000000-0000-0000-0000-000000000002", name: "五月房租", amount: 35000, amount_cny: Math.round(35000 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "住房", date: "2026-05-01", notes: null, created_at: "2026-05-01T10:00:00+09:00", updated_at: "2026-05-01T10:00:00+09:00", user_id: DEMO_USER },
  // Phone
  { id: "demo-f0000000-0000-0000-0000-000000000003", name: "手机套餐", amount: 3980, amount_cny: Math.round(3980 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "通讯/订阅", date: "2026-04-05", notes: null, created_at: "2026-04-05T10:00:00+09:00", updated_at: "2026-04-05T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000004", name: "手机套餐", amount: 3980, amount_cny: Math.round(3980 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "通讯/订阅", date: "2026-05-05", notes: null, created_at: "2026-05-05T10:00:00+09:00", updated_at: "2026-05-05T10:00:00+09:00", user_id: DEMO_USER },
  // Netflix
  { id: "demo-f0000000-0000-0000-0000-000000000005", name: "Netflix", amount: 1490, amount_cny: Math.round(1490 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "通讯/订阅", date: "2026-04-15", notes: null, created_at: "2026-04-15T10:00:00+09:00", updated_at: "2026-04-15T10:00:00+09:00", user_id: DEMO_USER },
  // Train pass (April)
  { id: "demo-f0000000-0000-0000-0000-000000000006", name: "地铁月票", amount: 10500, amount_cny: Math.round(10500 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "交通", date: "2026-04-01", notes: "定期券更新", created_at: "2026-04-01T09:00:00+09:00", updated_at: "2026-04-01T09:00:00+09:00", user_id: DEMO_USER },
  // Train pass (May)
  { id: "demo-f0000000-0000-0000-0000-000000000007", name: "地铁月票", amount: 10500, amount_cny: Math.round(10500 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "交通", date: "2026-05-01", notes: "定期券更新", created_at: "2026-05-01T09:00:00+09:00", updated_at: "2026-05-01T09:00:00+09:00", user_id: DEMO_USER },
  // Food - various meals in April
  { id: "demo-f0000000-0000-0000-0000-000000000008", name: "松屋牛丼", amount: 550, amount_cny: Math.round(550 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-03", notes: null, created_at: "2026-04-03T12:30:00+09:00", updated_at: "2026-04-03T12:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000009", name: "吉野家套餐", amount: 780, amount_cny: Math.round(780 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-07", notes: null, created_at: "2026-04-07T12:30:00+09:00", updated_at: "2026-04-07T12:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000010", name: "超市买菜", amount: 2800, amount_cny: Math.round(2800 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-10", notes: "一周食材", created_at: "2026-04-10T18:00:00+09:00", updated_at: "2026-04-10T18:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000011", name: "拉面", amount: 950, amount_cny: Math.round(950 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-14", notes: "味噌拉面", created_at: "2026-04-14T19:00:00+09:00", updated_at: "2026-04-14T19:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000012", name: "便利店午餐", amount: 680, amount_cny: Math.round(680 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-18", notes: null, created_at: "2026-04-18T12:15:00+09:00", updated_at: "2026-04-18T12:15:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000013", name: "超市买菜", amount: 3200, amount_cny: Math.round(3200 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-20", notes: "鸡蛋牛奶鸡胸肉", created_at: "2026-04-20T17:30:00+09:00", updated_at: "2026-04-20T17:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000014", name: "朋友聚餐", amount: 3500, amount_cny: Math.round(3500 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-04-26", notes: "居酒屋", created_at: "2026-04-26T20:00:00+09:00", updated_at: "2026-04-26T20:00:00+09:00", user_id: DEMO_USER },
  // Food - May
  { id: "demo-f0000000-0000-0000-0000-000000000015", name: "超市买菜", amount: 2600, amount_cny: Math.round(2600 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-05-02", notes: "周末采购", created_at: "2026-05-02T16:00:00+09:00", updated_at: "2026-05-02T16:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000016", name: "便当", amount: 480, amount_cny: Math.round(480 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-05-04", notes: null, created_at: "2026-05-04T12:20:00+09:00", updated_at: "2026-05-04T12:20:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000017", name: "麦当劳", amount: 720, amount_cny: Math.round(720 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-05-05", notes: null, created_at: "2026-05-05T12:30:00+09:00", updated_at: "2026-05-05T12:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000018", name: "松屋", amount: 620, amount_cny: Math.round(620 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "餐饮", date: "2026-05-07", notes: null, created_at: "2026-05-07T12:15:00+09:00", updated_at: "2026-05-07T12:15:00+09:00", user_id: DEMO_USER },
  // Books
  { id: "demo-f0000000-0000-0000-0000-000000000019", name: "深層学習教科書", amount: 3800, amount_cny: Math.round(3800 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "学习", date: "2026-04-08", notes: null, created_at: "2026-04-08T14:00:00+09:00", updated_at: "2026-04-08T14:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000020", name: "有限元方法导论", amount: 220, amount_cny: 220, currency: "CNY", exchange_rate: 1, category: "学习", date: "2026-04-22", notes: "淘宝购入", created_at: "2026-04-22T10:00:00+09:00", updated_at: "2026-04-22T10:00:00+09:00", user_id: DEMO_USER },
  // Daily necessities
  { id: "demo-f0000000-0000-0000-0000-000000000021", name: "洗衣液+纸巾", amount: 850, amount_cny: Math.round(850 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "日用", date: "2026-04-12", notes: null, created_at: "2026-04-12T15:00:00+09:00", updated_at: "2026-04-12T15:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000022", name: "洗发水", amount: 620, amount_cny: Math.round(620 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "日用", date: "2026-05-03", notes: null, created_at: "2026-05-03T14:00:00+09:00", updated_at: "2026-05-03T14:00:00+09:00", user_id: DEMO_USER },
  // Entertainment
  { id: "demo-f0000000-0000-0000-0000-000000000023", name: "电影票", amount: 1900, amount_cny: Math.round(1900 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "娱乐", date: "2026-04-19", notes: "和彤彤看的电影", created_at: "2026-04-19T20:00:00+09:00", updated_at: "2026-04-19T20:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-f0000000-0000-0000-0000-000000000024", name: "温泉", amount: 1200, amount_cny: Math.round(1200 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "娱乐", date: "2026-04-27", notes: null, created_at: "2026-04-27T16:00:00+09:00", updated_at: "2026-04-27T16:00:00+09:00", user_id: DEMO_USER },
  // Gym
  { id: "demo-f0000000-0000-0000-0000-000000000025", name: "健身房月卡", amount: 8800, amount_cny: Math.round(8800 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "娱乐", date: "2026-04-01", notes: "Anytime Fitness", created_at: "2026-04-01T11:00:00+09:00", updated_at: "2026-04-01T11:00:00+09:00", user_id: DEMO_USER },
  // Gift for 彤彤
  { id: "demo-f0000000-0000-0000-0000-000000000026", name: "生日礼物", amount: 5800, amount_cny: Math.round(5800 * FX * 100) / 100, currency: "JPY", exchange_rate: FX, category: "日用", date: "2026-04-15", notes: "给彤彤的生日礼物", created_at: "2026-04-15T10:00:00+09:00", updated_at: "2026-04-15T10:00:00+09:00", user_id: DEMO_USER },
];

// ============ Calorie Records (dynamic — last 14 days) ============
const BREAKFAST_OPTIONS = [
  { name: "燕麦牛奶", cal: 320 }, { name: "全麦面包+鸡蛋", cal: 350 },
  { name: "燕麦酸奶", cal: 300 }, { name: "面包+牛奶", cal: 340 },
  { name: "燕麦+香蕉", cal: 310 }, { name: "三明治", cal: 380 },
  { name: "牛奶+面包", cal: 330 }, { name: "燕麦+蓝莓", cal: 290 },
];
const LUNCH_OPTIONS = [
  { name: "便当", cal: 580 }, { name: "松屋牛丼", cal: 680 },
  { name: "便利店便当", cal: 620 }, { name: "麦当劳套餐", cal: 720 },
  { name: "便当", cal: 550 }, { name: "乌冬面", cal: 520 },
  { name: "咖喱饭", cal: 680 }, { name: "拉面", cal: 650 },
];
const DINNER_OPTIONS = [
  { name: "米饭配鸡胸肉+西兰花", cal: 650 }, { name: "拉面", cal: 780 },
  { name: "米饭配咖喱", cal: 700 }, { name: "鸡胸肉沙拉", cal: 450 },
  { name: "烤鱼定食", cal: 650 }, { name: "炒饭", cal: 600 },
  { name: "麻辣烫", cal: 720 }, { name: "烤肉定食", cal: 700 },
];

function generateCalorieRecords(): typeof demoCalorieRecords {
  const records: typeof demoCalorieRecords = [];
  const today = new Date();
  for (let dayOffset = -13; dayOffset <= 0; dayOffset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    const dateStr = d.toISOString().split("T")[0];
    const seed = dayOffset + 13; // 0..13
    const brk = BREAKFAST_OPTIONS[seed % BREAKFAST_OPTIONS.length];
    const lnc = LUNCH_OPTIONS[seed % LUNCH_OPTIONS.length];
    const dnr = DINNER_OPTIONS[seed % DINNER_OPTIONS.length];

    records.push(
      { id: `demo-cal-brk-${dateStr}`, food_name: brk.name, calories: brk.cal, meal_type: "breakfast", date: dateStr, notes: null, created_at: `${dateStr}T08:00:00+09:00`, updated_at: `${dateStr}T08:00:00+09:00`, user_id: DEMO_USER },
      { id: `demo-cal-lnc-${dateStr}`, food_name: lnc.name, calories: lnc.cal, meal_type: "lunch", date: dateStr, notes: null, created_at: `${dateStr}T12:15:00+09:00`, updated_at: `${dateStr}T12:15:00+09:00`, user_id: DEMO_USER },
      { id: `demo-cal-dnr-${dateStr}`, food_name: dnr.name, calories: dnr.cal, meal_type: "dinner", date: dateStr, notes: null, created_at: `${dateStr}T19:00:00+09:00`, updated_at: `${dateStr}T19:00:00+09:00`, user_id: DEMO_USER },
    );
    // Add exercise every other day
    if (dayOffset % 2 === 0) {
      const exercises = [
        { name: "跑步 5km", cal: 280 }, { name: "腿部训练", cal: 250 },
        { name: "跑步 4km", cal: 240 }, { name: "有氧操", cal: 200 },
      ];
      const ex = exercises[seed % exercises.length];
      records.push(
        { id: `demo-cal-ex-${dateStr}`, food_name: ex.name, calories: ex.cal, meal_type: "exercise", date: dateStr, notes: null, created_at: `${dateStr}T17:30:00+09:00`, updated_at: `${dateStr}T17:30:00+09:00`, user_id: DEMO_USER },
      );
    }
  }
  return records;
}

export const demoCalorieRecords = generateCalorieRecords();

// ============ Todos ============
export const demoTodos = [
  // AI学习 Category Tasks matching screenshot
  { id: "demo-t-ai-01", title: "Multi-agent PDE solving system - LEAP", detail: null, importance: "urgent", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-08T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-02", title: "秋招 agent 或者自动化开发", detail: null, importance: "important", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-07T10:00:00+09:00", updated_at: "2026-05-07T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-03", title: "粗读 UniNDM: A Unified Noise-driven Detection 论文", detail: null, importance: "important", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-06T10:00:00+09:00", updated_at: "2026-05-06T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-04", title: "ARIS 面试HTML", detail: null, tags: ["Agent 相关", "RAG 相关"], importance: "important", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-05T10:00:00+09:00", updated_at: "2026-05-05T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-04-sub-1", parent_id: "demo-t-ai-04", title: "Self-Evolving Agents (Ctx2Skill / Native Evolution / A²RD / Voyager / Reflexion / STaR)", detail: "核心框架与架构演进", importance: "important", category: "AI学习", is_completed: true, is_archived: false, created_at: "2026-05-05T10:05:00+09:00", updated_at: "2026-05-05T10:05:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-04-sub-2", parent_id: "demo-t-ai-04", title: "Agentic RL (AgentTuning / ToolRL / RAGEN / WebRL / SWE-RL / GRPO for tool use)", detail: "工具调用的强化学习微调", importance: "important", category: "AI学习", is_completed: true, is_archived: false, created_at: "2026-05-05T10:10:00+09:00", updated_at: "2026-05-05T10:10:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-04-sub-3", parent_id: "demo-t-ai-04", title: "Multi-Agent & Long-Horizon (CAMEL / AutoGen / MetaGPT / MoA / Debate / MemGPT / LATS)", detail: "多智能体长流程协作", importance: "important", category: "AI学习", is_completed: true, is_archived: false, created_at: "2026-05-05T10:15:00+09:00", updated_at: "2026-05-05T10:15:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-04-sub-4", parent_id: "demo-t-ai-04", title: "Agent Foundations (ReAct / MCP / A2A / SWE-bench / GAIA / OSWorld)", detail: "Agent 基准测试与通信协议", importance: "important", category: "AI学习", is_completed: true, is_archived: false, created_at: "2026-05-05T10:20:00+09:00", updated_at: "2026-05-05T10:20:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-05", title: "学习Hello Agent", detail: null, importance: "important", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-04T10:00:00+09:00", updated_at: "2026-05-04T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-06", title: "LLM - MC wiki", detail: null, importance: "important", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-03T10:00:00+09:00", updated_at: "2026-05-03T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-07", title: "JAX-FEM-Geo 项目", detail: null, importance: "normal", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-02T10:00:00+09:00", updated_at: "2026-05-02T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t-ai-08", title: "迭代 HTML artifacts 技能", detail: null, importance: "normal", category: "AI学习", is_completed: false, is_archived: false, created_at: "2026-05-01T10:00:00+09:00", updated_at: "2026-05-01T10:00:00+09:00", user_id: DEMO_USER },

  // General Todos
  { id: "demo-t0000000-0000-0000-0000-000000000001", title: "提交论文初稿", detail: "第三章实验部分需要完善", importance: "urgent", category: "学习", is_completed: false, is_archived: false, created_at: "2026-04-20T10:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000002", title: "买日用品", detail: "洗衣液、牙膏、纸巾", importance: "normal", category: "生活", is_completed: false, is_archived: false, created_at: "2026-05-05T10:00:00+09:00", updated_at: "2026-05-05T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000003", title: "预约牙医", detail: "半年一次的检查", importance: "normal", category: "生活", is_completed: false, is_archived: false, created_at: "2026-05-01T10:00:00+09:00", updated_at: "2026-05-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000004", title: "复习概率论考试", detail: "下周三考试，重点看贝叶斯和马尔可夫", importance: "urgent", category: "学习", is_completed: false, is_archived: false, created_at: "2026-05-03T10:00:00+09:00", updated_at: "2026-05-03T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000005", title: "给彤彤寄包裹", detail: "北海道特产+围巾", importance: "important", category: "生活", is_completed: false, is_archived: false, created_at: "2026-05-02T10:00:00+09:00", updated_at: "2026-05-02T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000006", title: "完成FEM自动微分模块", detail: "实现反向传播的梯度计算", importance: "important", category: "工作", is_completed: false, is_archived: false, created_at: "2026-04-25T10:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000007", title: "更新博客文章", detail: "写一篇关于PyTorch自定义算子的教程", importance: "normal", category: "工作", is_completed: false, is_archived: false, created_at: "2026-05-04T10:00:00+09:00", updated_at: "2026-05-04T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000008", title: "交水电费", detail: null, importance: "normal", category: "生活", is_completed: true, is_archived: false, created_at: "2026-04-28T10:00:00+09:00", updated_at: "2026-04-28T15:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000009", title: "报名CS231n", detail: null, importance: "normal", category: "学习", is_completed: true, is_archived: false, created_at: "2026-04-10T10:00:00+09:00", updated_at: "2026-04-12T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000010", title: "整理参考文献", detail: "用Zotero管理论文", importance: "normal", category: "学习", is_completed: true, is_archived: false, created_at: "2026-04-15T10:00:00+09:00", updated_at: "2026-04-20T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000011", title: "提交研究报告", detail: "季度进展报告", importance: "important", category: "工作", is_completed: true, is_archived: false, created_at: "2026-04-22T10:00:00+09:00", updated_at: "2026-04-25T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000012", title: "修理自行车刹车", detail: null, importance: "low", category: "生活", is_completed: false, is_archived: false, created_at: "2026-05-06T10:00:00+09:00", updated_at: "2026-05-06T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-t0000000-0000-0000-0000-000000000013", title: "回复导师邮件", detail: "关于实验参数设置的问题", importance: "important", category: "工作", is_completed: false, is_archived: false, created_at: "2026-05-07T10:00:00+09:00", updated_at: "2026-05-07T10:00:00+09:00", user_id: DEMO_USER },
];

// ============ Daily Tasks (Today's Todo — dynamic) ============
function generateDailyTasks(): typeof demoDailyTasks {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const ts = `${dateStr}T07:00:00+09:00`;
  return [
    { id: DTASK_1, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000001", task_date: dateStr, difficulty: "hard", base_points: 30, is_completed: false, completed_at: null, created_at: ts, updated_at: ts },
    { id: DTASK_2, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000004", task_date: dateStr, difficulty: "medium", base_points: 20, is_completed: false, completed_at: null, created_at: ts, updated_at: ts },
    { id: DTASK_3, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000002", task_date: dateStr, difficulty: "easy", base_points: 10, is_completed: true, completed_at: `${dateStr}T10:30:00+09:00`, created_at: ts, updated_at: `${dateStr}T10:30:00+09:00` },
    { id: DTASK_4, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000013", task_date: dateStr, difficulty: "medium", base_points: 20, is_completed: false, completed_at: null, created_at: ts, updated_at: ts },
    { id: DTASK_5, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000005", task_date: dateStr, difficulty: "easy", base_points: 10, is_completed: false, completed_at: null, created_at: ts, updated_at: ts },
  ];
}

export const demoDailyTasks = generateDailyTasks();

// ============ User Points ============
const _todayStr = new Date().toISOString().split("T")[0];
export const demoUserPoints = [
  { id: UPOINTS_ID, user_id: DEMO_USER, total_points: 1240, current_streak: 7, best_streak: 12, last_active_date: _todayStr, rest_day_date: null, skip_chore_active: false, sleep_in_date: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: `${_todayStr}T10:30:00+09:00` },
];

// ============ Shop Items ============
export const demoShopItems = [
  // Titles - Common
  { id: SHOP_TITLE_BEGINNER, name: "初心者 / Beginner", description: "Every master was once a beginner.", item_type: "cosmetic_title", rarity: "common", price: 80, image_url: null, metadata: { title_text: "初心者" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_TITLE_EXECUTOR, name: "执行者 / Executor", description: "Actions speak louder than words.", item_type: "cosmetic_title", rarity: "common", price: 80, image_url: null, metadata: { title_text: "执行者" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  // Titles - Rare
  { id: SHOP_TITLE_WARRIOR, name: "逻辑战士 / Logic Warrior", description: "Master of algorithms and reason.", item_type: "cosmetic_title", rarity: "rare", price: 200, image_url: null, metadata: { title_text: "逻辑战士" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_TITLE_MASTER, name: "连击大师 / Streak Master", description: "Consistency is the ultimate power.", item_type: "cosmetic_title", rarity: "rare", price: null, image_url: null, metadata: { title_text: "连击大师" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  // Titles - Legendary
  { id: SHOP_TITLE_LEGEND, name: "不灭传说 / Immortal Legend", description: "Your legend precedes you.", item_type: "cosmetic_title", rarity: "legendary", price: null, image_url: null, metadata: { title_text: "不灭传说" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_TITLE_WARRIOR100, name: "百日武者 / 100-Day Warrior", description: "100 days of unwavering dedication.", item_type: "cosmetic_title", rarity: "legendary", price: null, image_url: null, metadata: { title_text: "百日武者" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  // Profile Decorations - Common
  { id: SHOP_FRAME_BRONZE, name: "青铜之框 / Bronze Frame", description: "A humble beginning.", item_type: "cosmetic_profile", rarity: "common", price: 80, image_url: null, metadata: { frame_style: "bronze" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_FRAME_SILVER, name: "白银之框 / Silver Frame", description: "Polished and refined.", item_type: "cosmetic_profile", rarity: "common", price: 80, image_url: null, metadata: { frame_style: "silver" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  // Profile Decorations - Rare
  { id: SHOP_FRAME_GOLD, name: "黄金之框 / Gold Frame", description: "Shines with achievement.", item_type: "cosmetic_profile", rarity: "rare", price: 200, image_url: null, metadata: { frame_style: "gold" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_FRAME_CRYSTAL, name: "水晶之框 / Crystal Frame", description: "Translucent elegance.", item_type: "cosmetic_profile", rarity: "rare", price: 200, image_url: null, metadata: { frame_style: "crystal" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  // Profile Decorations - Legendary
  { id: SHOP_FRAME_FLAME, name: "烈焰之框 / Flame Frame", description: "Burns with eternal fire.", item_type: "cosmetic_profile", rarity: "legendary", price: null, image_url: null, metadata: { frame_style: "flame" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_FRAME_AURORA, name: "极光之框 / Aurora Frame", description: "Dancing lights of the north.", item_type: "cosmetic_profile", rarity: "legendary", price: null, image_url: null, metadata: { frame_style: "aurora" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  // Privilege Coupons (milestone-only, no price)
  { id: SHOP_COUPON_REST, name: "休息日通行证 / Rest Day Pass", description: "Take a day off without breaking your streak.", item_type: "privilege_coupon", rarity: "rare", price: null, image_url: null, metadata: { effect_type: "rest_day" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_COUPON_SKIP, name: "跳过家务卡 / Skip Chore Pass", description: "Auto-complete your next household task.", item_type: "privilege_coupon", rarity: "rare", price: null, image_url: null, metadata: { effect_type: "skip_chore" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_COUPON_GAMING, name: "游戏豁免券 / Gaming Session", description: "2 hours of guilt-free gaming.", item_type: "privilege_coupon", rarity: "common", price: null, image_url: null, metadata: { effect_type: "gaming_session", duration_hours: 2 }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_COUPON_TREAT, name: "犒劳自己卡 / Treat Yourself", description: "You deserve a nice meal.", item_type: "privilege_coupon", rarity: "legendary", price: null, image_url: null, metadata: { effect_type: "treat_yourself" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
  { id: SHOP_COUPON_SLEEP, name: "睡懒觉卡 / Sleep In Pass", description: "Skip tomorrow morning's alarm.", item_type: "privilege_coupon", rarity: "rare", price: null, image_url: null, metadata: { effect_type: "sleep_in" }, is_active: true, created_at: "2026-05-18T00:00:00+09:00" },
];

// ============ User Inventory (demo: a few owned items) ============
export const demoUserInventory = [
  { id: "demo-inv00000-0000-0000-0000-000000000001", user_id: DEMO_USER, item_id: SHOP_TITLE_BEGINNER, source: "gacha_pull", is_equipped: true, is_used: false, purchased_at: "2026-05-10T14:00:00+09:00" },
  { id: "demo-inv00000-0000-0000-0000-000000000002", user_id: DEMO_USER, item_id: SHOP_FRAME_BRONZE, source: "shop_purchase", is_equipped: true, is_used: false, purchased_at: "2026-05-12T09:00:00+09:00" },
  { id: "demo-inv00000-0000-0000-0000-000000000003", user_id: DEMO_USER, item_id: SHOP_COUPON_GAMING, source: "milestone_unlock", is_equipped: false, is_used: false, purchased_at: "2026-05-15T18:00:00+09:00" },
];

// ============ Gacha Pity ============
export const demoGachaPity = [
  { id: GACHA_PITY_ID, user_id: DEMO_USER, pulls_since_legendary: 3, total_pulls: 8, created_at: "2026-05-10T00:00:00+09:00", updated_at: "2026-05-18T00:00:00+09:00" },
];

// ============ Goals (dynamic — relative to current week/month/year) ============
function getCurrentMonday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split("T")[0];
}

function getCurrentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getLastMonday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
  return d.toISOString().split("T")[0];
}

function generateGoals(): typeof demoGoals {
  const thisMon = getCurrentMonday();
  const thisMonth = getCurrentMonthStart();
  const lastMon = getLastMonday();
  const thisYear = `${new Date().getFullYear()}-01-01`;
  const ts = (date: string) => `${date}T08:00:00+09:00`;

  return [
    // Weekly goals (current week)
    { id: "demo-g0000000-0000-0000-0000-000000000001", title: "完成FEM自动微分模块初版", type: "week", period_start: thisMon, is_completed: false, created_at: ts(thisMon), updated_at: ts(thisMon), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000002", title: "复习概率论第1-3章", type: "week", period_start: thisMon, is_completed: true, created_at: ts(thisMon), updated_at: ts(thisMon), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000003", title: "健身5次", type: "week", period_start: thisMon, is_completed: false, created_at: ts(thisMon), updated_at: ts(thisMon), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000004", title: "读完《深度学习》第5章", type: "week", period_start: thisMon, is_completed: true, created_at: ts(thisMon), updated_at: ts(thisMon), user_id: DEMO_USER },
    // Monthly goals (current month)
    { id: "demo-g0000000-0000-0000-0000-000000000010", title: "完成论文第二章初稿", type: "month", period_start: thisMonth, is_completed: false, created_at: ts(thisMonth), updated_at: ts(thisMonth), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000011", title: "体重降到74kg", type: "month", period_start: thisMonth, is_completed: false, created_at: ts(thisMonth), updated_at: ts(thisMonth), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000012", title: "博客上线并发布3篇文章", type: "month", period_start: thisMonth, is_completed: false, created_at: ts(thisMonth), updated_at: ts(thisMonth), user_id: DEMO_USER },
    // Last week (completed)
    { id: "demo-g0000000-0000-0000-0000-000000000020", title: "提交实验报告", type: "week", period_start: lastMon, is_completed: true, created_at: ts(lastMon), updated_at: ts(lastMon), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000021", title: "整理房间", type: "week", period_start: lastMon, is_completed: true, created_at: ts(lastMon), updated_at: ts(lastMon), user_id: DEMO_USER },
    // Yearly goals
    { id: "demo-g0000000-0000-0000-0000-000000000030", title: "学完CS231n课程", type: "year", period_start: thisYear, is_completed: false, created_at: ts(thisYear), updated_at: ts(thisYear), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000031", title: "发表一篇顶会论文", type: "year", period_start: thisYear, is_completed: false, created_at: ts(thisYear), updated_at: ts(thisYear), user_id: DEMO_USER },
    { id: "demo-g0000000-0000-0000-0000-000000000032", title: "体重稳定在72kg", type: "year", period_start: thisYear, is_completed: false, created_at: ts(thisYear), updated_at: ts(thisYear), user_id: DEMO_USER },
  ];
}

export const demoGoals = generateGoals();

// ============ Weight Records (dynamic — last 38 days, trending 76 → 74.5) ============
export const demoWeightRecords: Array<{ id: string; weight: number; date: string; notes: string | null; created_at: string; updated_at: string; user_id: string }> = [];
(function generateWeight() {
  const weights = [
    76.0, 76.1, 75.9, 76.2, 75.8, 75.7, 75.9, 75.6, 75.5, 75.7,
    75.3, 75.2, 75.4, 75.1, 75.0, 75.2, 74.9, 74.8, 75.0, 74.7,
    74.6, 74.8, 74.5, 74.4, 74.6, 74.3, 74.5, 74.4, 74.6, 74.5,
    74.3, 74.5, 74.4, 74.2, 74.4, 74.3, 74.5, 74.4,
  ];
  const today = new Date();
  for (let i = 0; i < weights.length; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (weights.length - 1 - i));
    const dateStr = d.toISOString().split("T")[0];
    demoWeightRecords.push({
      id: `demo-w0000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      weight: weights[i],
      date: dateStr,
      notes: i === 0 ? "开始记录" : null,
      created_at: `${dateStr}T08:00:00+09:00`,
      updated_at: `${dateStr}T08:00:00+09:00`,
      user_id: DEMO_USER,
    });
  }
})();

// ============ Measurement Records ============
export const demoMeasurementRecords = [
  { id: "demo-m0000000-0000-0000-0000-000000000001", waist: 85, hip: 98, chest: 95, arm: 32, thigh: 56, date: "2026-04-01", notes: "初始测量", created_at: "2026-04-01T08:00:00+09:00", updated_at: "2026-04-01T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-m0000000-0000-0000-0000-000000000002", waist: 84.5, hip: 97.5, chest: 95, arm: 32, thigh: 55.5, date: "2026-04-15", notes: null, created_at: "2026-04-15T08:00:00+09:00", updated_at: "2026-04-15T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-m0000000-0000-0000-0000-000000000003", waist: 84, hip: 97, chest: 94.5, arm: 32.5, thigh: 55, date: "2026-04-29", notes: null, created_at: "2026-04-29T08:00:00+09:00", updated_at: "2026-04-29T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-m0000000-0000-0000-0000-000000000004", waist: 83.5, hip: 96.5, chest: 94, arm: 32.5, thigh: 54.5, date: "2026-05-08", notes: "最新测量", created_at: "2026-05-08T08:00:00+09:00", updated_at: "2026-05-08T08:00:00+09:00", user_id: DEMO_USER },
];

// ============ Pantry Items ============
export const demoPantryItems = [
  { id: "demo-p0000000-0000-0000-0000-000000000001", name: "大米", category: "主食", quantity: "2kg", purchase_date: "2026-05-01", expiry_date: "2026-08-01", notes: "新潟产コシヒカリ", created_at: "2026-05-01T10:00:00+09:00", updated_at: "2026-05-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000002", name: "鸡蛋", category: "乳制品", quantity: "10个", purchase_date: "2026-05-05", expiry_date: "2026-05-12", notes: null, created_at: "2026-05-05T10:00:00+09:00", updated_at: "2026-05-05T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000003", name: "牛奶", category: "乳制品", quantity: "1L", purchase_date: "2026-05-06", expiry_date: "2026-05-10", notes: null, created_at: "2026-05-06T10:00:00+09:00", updated_at: "2026-05-06T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000004", name: "豆腐", category: "蔬菜", quantity: "1盒", purchase_date: "2026-05-07", expiry_date: "2026-05-09", notes: "明天到期", created_at: "2026-05-07T10:00:00+09:00", updated_at: "2026-05-07T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000005", name: "鸡胸肉", category: "肉类", quantity: "500g", purchase_date: "2026-05-05", expiry_date: "2026-05-08", notes: "今天到期", created_at: "2026-05-05T10:00:00+09:00", updated_at: "2026-05-05T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000006", name: "西兰花", category: "蔬菜", quantity: "1棵", purchase_date: "2026-05-06", expiry_date: "2026-05-11", notes: null, created_at: "2026-05-06T10:00:00+09:00", updated_at: "2026-05-06T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000007", name: "燕麦", category: "主食", quantity: "500g", purchase_date: "2026-04-20", expiry_date: "2026-07-20", notes: "Quaker", created_at: "2026-04-20T10:00:00+09:00", updated_at: "2026-04-20T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000008", name: "酱油", category: "调味料", quantity: "500ml", purchase_date: "2026-03-15", expiry_date: "2027-03-15", notes: "龟甲万", created_at: "2026-03-15T10:00:00+09:00", updated_at: "2026-03-15T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000009", name: "味噌", category: "调味料", quantity: "300g", purchase_date: "2026-04-01", expiry_date: "2026-10-01", notes: null, created_at: "2026-04-01T10:00:00+09:00", updated_at: "2026-04-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000010", name: "面包", category: "主食", quantity: "1袋", purchase_date: "2026-05-07", expiry_date: "2026-05-10", notes: "全麦面包", created_at: "2026-05-07T10:00:00+09:00", updated_at: "2026-05-07T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000011", name: "香蕉", category: "蔬菜", quantity: "1把", purchase_date: "2026-05-06", expiry_date: "2026-05-11", notes: null, created_at: "2026-05-06T10:00:00+09:00", updated_at: "2026-05-06T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-p0000000-0000-0000-0000-000000000012", name: "酸奶", category: "乳制品", quantity: "4杯", purchase_date: "2026-05-05", expiry_date: "2026-05-12", notes: null, created_at: "2026-05-05T10:00:00+09:00", updated_at: "2026-05-05T10:00:00+09:00", user_id: DEMO_USER },
];

// ============ Belongings Daily ============
export const demoBelongingsDaily = [
  { id: "demo-bd000000-0000-0000-0000-000000000001", name: "水杯", category: "日用品", purchase_date: "2026-03-01", notes: "保温杯", created_at: "2026-03-01T10:00:00+09:00", updated_at: "2026-03-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000002", name: "书包", category: "日用品", purchase_date: "2025-09-01", notes: "JanSport", created_at: "2025-09-01T10:00:00+09:00", updated_at: "2025-09-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000003", name: "笔记本", category: "学习用品", purchase_date: "2026-04-01", notes: "A5方格本", created_at: "2026-04-01T10:00:00+09:00", updated_at: "2026-04-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000004", name: "耳机", category: "电子", purchase_date: "2025-12-25", notes: "AirPods Pro", created_at: "2025-12-25T10:00:00+09:00", updated_at: "2025-12-25T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000005", name: "充电器", category: "电子", purchase_date: "2025-09-01", notes: "USB-C 65W", created_at: "2025-09-01T10:00:00+09:00", updated_at: "2025-09-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000006", name: "雨伞", category: "日用品", purchase_date: "2026-04-10", notes: "折叠伞", created_at: "2026-04-10T10:00:00+09:00", updated_at: "2026-04-10T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000007", name: "钱包", category: "日用品", purchase_date: "2024-06-01", notes: null, created_at: "2024-06-01T10:00:00+09:00", updated_at: "2024-06-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bd000000-0000-0000-0000-000000000008", name: "钥匙", category: "日用品", purchase_date: "2025-04-01", notes: "公寓+自行车锁", created_at: "2025-04-01T10:00:00+09:00", updated_at: "2025-04-01T10:00:00+09:00", user_id: DEMO_USER },
];

// ============ Belongings Durable ============
export const demoBelongingsDurable = [
  { id: "demo-bp000000-0000-0000-0000-000000000001", name: "MacBook Pro 14", category: "电子", purchase_price: 248000, purchase_date: "2024-09-15", expected_lifespan_days: 1460, notes: "M3 Pro, 18GB", created_at: "2024-09-15T10:00:00+09:00", updated_at: "2024-09-15T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bp000000-0000-0000-0000-000000000002", name: "iPhone 15", category: "电子", purchase_price: 124800, purchase_date: "2023-10-01", expected_lifespan_days: 1095, notes: null, created_at: "2023-10-01T10:00:00+09:00", updated_at: "2023-10-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bp000000-0000-0000-0000-000000000003", name: "自行车", category: "交通", purchase_price: 35000, purchase_date: "2024-04-01", expected_lifespan_days: 1825, notes: "通勤用", created_at: "2024-04-01T10:00:00+09:00", updated_at: "2024-04-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bp000000-0000-0000-0000-000000000004", name: "显示器", category: "电子", purchase_price: 45000, purchase_date: "2023-04-01", expected_lifespan_days: 1460, notes: "Dell 27寸 4K", created_at: "2023-04-01T10:00:00+09:00", updated_at: "2023-04-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bp000000-0000-0000-0000-000000000005", name: "键盘", category: "电子", purchase_price: 15000, purchase_date: "2022-06-01", expected_lifespan_days: 1095, notes: "HHKB Professional", created_at: "2022-06-01T10:00:00+09:00", updated_at: "2022-06-01T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-bp000000-0000-0000-0000-000000000006", name: "运动鞋", category: "服饰", purchase_price: 12000, purchase_date: "2025-01-15", expected_lifespan_days: 365, notes: "Nike跑步鞋", created_at: "2025-01-15T10:00:00+09:00", updated_at: "2025-01-15T10:00:00+09:00", user_id: DEMO_USER },
];

// ============ Thoughts ============
export const demoThoughts = [
  { id: "demo-th000000-0000-0000-0000-000000000001", title: "AI Agent框架思考", content: "最近在调研AutoGPT和CrewAI的架构设计，发现多Agent协作的关键在于任务分解和通信协议的设计。感觉我们组的FEM项目也可以借鉴这种思路，把网格生成、求解、后处理拆成独立Agent。", tags: ["灵感", "技术"], icon: null, created_at: "2026-05-07T22:00:00+09:00", updated_at: "2026-05-07T22:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000002", title: "读论文心得", content: "今天读了Physics-Informed Neural Networks (PINNs)的最新进展，感觉和我们的可微分FEM有很多相似之处。PINNs用神经网络逼近PDE的解，而我们是用可微分的方式直接求解。两者可以互补。", tags: ["学习", "技术"], icon: null, created_at: "2026-05-05T21:00:00+09:00", updated_at: "2026-05-05T21:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000003", title: "札幌的春天终于来了", content: "五月份札幌终于暖和了，公园里的樱花还在。今天骑车去学校的时候心情特别好。打算周末和彤彤视频的时候给她看看公园的景色。", tags: ["生活"], icon: null, created_at: "2026-05-03T20:00:00+09:00", updated_at: "2026-05-03T20:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000004", title: "周末计划", content: "这周六和实验室同学去烤肉，周日在家写代码。要记得提前买好下周的食材，冰箱快空了。", tags: ["生活"], icon: null, created_at: "2026-05-08T08:00:00+09:00", updated_at: "2026-05-08T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000005", title: "可微分编程的未来", content: "Julia社区在可微分编程方面做得很好（Zygote.jl），Python这边有JAX和PyTorch。但工程领域的可微分模拟还很不成熟，这是我们研究的机会。", tags: ["灵感", "技术"], icon: null, created_at: "2026-04-28T23:00:00+09:00", updated_at: "2026-04-28T23:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000006", title: "健身两个月的变化", content: "坚持健身快两个月了，体重从76降到了74.5，腰围小了1.5cm。虽然进度不算快，但体脂率应该有明显下降。16+8轻断食配合运动效果还不错。", tags: ["生活"], icon: null, created_at: "2026-05-01T21:00:00+09:00", updated_at: "2026-05-01T21:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000007", title: "导师的建议", content: "今天组会导师建议我看看Neural ODE在结构力学中的应用，可能会给我们的FEM框架带来新的思路。下周要读一下相关论文。", tags: ["学习"], icon: null, created_at: "2026-04-25T18:00:00+09:00", updated_at: "2026-04-25T18:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000008", title: "博客的技术选型", content: "决定用Astro搭建博客，配合MDX写文章。Astro的Islands架构很适合技术博客，加载快，SEO友好。先从PyTorch自定义算子的教程开始写。", tags: ["技术", "灵感"], icon: null, created_at: "2026-04-20T22:00:00+09:00", updated_at: "2026-04-20T22:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-th000000-0000-0000-0000-000000000009", title: "和彤彤的旅行计划", content: "暑假彤彤要来札幌，计划带她去富良野看薰衣草、小樽运河散步、吃海鲜。要提前订好酒店和租车。", tags: ["生活"], icon: null, created_at: "2026-04-15T20:00:00+09:00", updated_at: "2026-04-15T20:00:00+09:00", user_id: DEMO_USER },
];

// ============ Learning Notes ============
export const demoLearningCourses = [
  { id: COURSE_DL, name: "深度学习研讨", description: "课程论文、反向传播、CNN/RNN/Transformer 等主题笔记", color: "#5b88b5", created_at: "2026-04-20T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00", user_id: DEMO_USER },
  { id: COURSE_PROB, name: "概率论复习", description: "考试复习重点：贝叶斯、马尔可夫链、极限定理", color: "#c49840", created_at: "2026-04-18T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00", user_id: DEMO_USER },
];

export const demoLearningNotes = [
  {
    id: "demo-61000000-0000-0000-0000-000000000001",
    course_id: COURSE_DL,
    title: "反向传播与链式法则",
    content: `# 反向传播与链式法则

> **核心直觉**：反向传播本质上是在计算图（Computation Graph）上从后向前应用微积分链式法则。

## 1. 损失函数梯度推导

对于标量损失 $L$ 和复合函数 $y = f(g(x))$，设 $u = g(x)$：

$$\\frac{\\partial L}{\\partial x} = \\frac{\\partial L}{\\partial y} \\cdot \\frac{\\partial y}{\\partial u} \\cdot \\frac{\\partial u}{\\partial x}$$

在多维张量情形下，设权重矩阵为 $W \\in \\mathbb{R}^{m \\times n}$，前向传播：

$$z = W x + b, \\quad a = \\sigma(z)$$

反向传播梯度为：

$$\\delta = \\frac{\\partial L}{\\partial z} = \\frac{\\partial L}{\\partial a} \\odot \\sigma'(z)$$

$$\\frac{\\partial L}{\\partial W} = \\delta x^T, \\quad \\frac{\\partial L}{\\partial b} = \\delta$$

## 2. 关键要点 checklist

- [x] **前向阶段**：缓存中间变量 $z$ 与激活值 $a$
- [x] **反向阶段**：由上游传入的梯度 $\\frac{\\partial L}{\\partial a}$ 计算局部 Jacobian 矩阵
- [ ] **优化技巧**：使用梯度裁剪（Gradient Clipping）防止爆炸`,
    tags: ["lecture", "重点"],
    note_date: "2026-05-07",
    created_at: "2026-05-07T21:00:00+09:00",
    updated_at: "2026-05-07T21:00:00+09:00",
  },
  {
    id: "demo-61000000-0000-0000-0000-000000000002",
    course_id: COURSE_DL,
    title: "Transformer 注意力机制",
    content: `# Scaled Dot-Product Attention

> *Attention Is All You Need* 论文的核心贡献在于利用注意力机制完全取代传统的 RNN / CNN 循环网络。

## 缩放点积注意力公式

对于查询 $Q \\in \\mathbb{R}^{n \\times d_k}$，键 $K \\in \\mathbb{R}^{m \\times d_k}$，值 $V \\in \\mathbb{R}^{m \\times d_v}$：

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

### 缩放因子 $\\sqrt{d_k}$ 的作用

假设 $q$ 和 $k$ 的各分量是独立同分布且均值为 0、方差为 1 的随机变量，则点积 $q \\cdot k = \\sum_{i=1}^{d_k} q_i k_i$ 的均值为 0，方差为 $d_k$。

- 若不除以 $\\sqrt{d_k}$，当维度 $d_k$ 较大时，点积数值会很大。
- 巨大的数值会导致 \`softmax\` 函数进入梯度极小的饱和区，引起**梯度消失**。

## 多头注意力 (Multi-Head Attention)

$$\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h)W^O$$

$$\\text{where } \\text{head}_i = \\text{Attention}(Q W_i^Q, K W_i^K, V W_i^V)$$`,
    tags: ["paper", "Transformer"],
    note_date: "2026-05-05",
    created_at: "2026-05-05T20:30:00+09:00",
    updated_at: "2026-05-05T20:30:00+09:00",
  },
  {
    id: "demo-61000000-0000-0000-0000-000000000003",
    course_id: COURSE_PROB,
    title: "贝叶斯公式与全概率定理",
    content: `# 贝叶斯推断定理

> 贝叶斯定理描述了已知新证据 $B$ 的情况下，对假设 $A$ 的后验概率（Posterior Probability）更新过程。

## 1. 定理公式

$$P(A|B) = \\frac{P(B|A) P(A)}{P(B)}$$

其中：
- $P(A)$ 为**先验概率** (Prior)
- $P(B|A)$ 为**似然度** (Likelihood)
- $P(B)$ 为**边际似然** (Marginal Likelihood / Evidence)

## 2. 全概率公式展开

若 $A_1, A_2, \\dots, A_n$ 构成样本空间的一个划分，则对于任意事件 $B$：

$$P(B) = \\sum_{i=1}^{n} P(A_i) P(B|A_i)$$

代入贝叶斯定理得到完整展开式：

$$P(A_k|B) = \\frac{P(A_k) P(B|A_k)}{\\sum_{i=1}^{n} P(A_i) P(B|A_i)}$$`,
    tags: ["exam"],
    note_date: "2026-05-04",
    created_at: "2026-05-04T22:00:00+09:00",
    updated_at: "2026-05-04T22:00:00+09:00",
  },
];

// ============ Projects ============
export const demoProjects = [
  { id: PROJ_FEM, name: "可微分FEM框架", description: "基于PyTorch的可微分有限元方法框架，支持自动微分和GPU加速", status: "active", priority: "high", progress: 60, target_date: "2026-09-01", user_id: DEMO_USER, created_at: "2026-03-01T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: PROJ_BLOG, name: "个人技术博客", description: "用Astro搭建的技术博客，分享AI/ML学习笔记和编程技巧", status: "active", priority: "medium", progress: 30, target_date: "2026-06-01", user_id: DEMO_USER, created_at: "2026-04-15T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: PROJ_THESIS, name: "毕业论文", description: "硕士毕业论文：可微分有限元方法在结构优化中的应用", status: "active", priority: "high", progress: 20, target_date: "2026-12-01", user_id: DEMO_USER, created_at: "2026-02-01T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
];

// ============ Task Tags ============
export const demoTaskTags = [
  { id: TAG_URGENT, name: "紧急", color: "#ef4444", project_id: PROJ_FEM },
  { id: TAG_INPROG, name: "进行中", color: "#5b88b5", project_id: PROJ_FEM },
  { id: TAG_REVIEW, name: "待审核", color: "#c49840", project_id: PROJ_FEM },
  { id: TAG_DONE, name: "已完成", color: "#5b8c44", project_id: PROJ_FEM },
  { id: "demo-40000000-0000-0000-0000-000000000011", name: "紧急", color: "#ef4444", project_id: PROJ_BLOG },
  { id: "demo-40000000-0000-0000-0000-000000000012", name: "进行中", color: "#5b88b5", project_id: PROJ_BLOG },
  { id: "demo-40000000-0000-0000-0000-000000000013", name: "待审核", color: "#c49840", project_id: PROJ_BLOG },
  { id: "demo-40000000-0000-0000-0000-000000000014", name: "已完成", color: "#5b8c44", project_id: PROJ_BLOG },
  { id: "demo-40000000-0000-0000-0000-000000000021", name: "紧急", color: "#ef4444", project_id: PROJ_THESIS },
  { id: "demo-40000000-0000-0000-0000-000000000022", name: "进行中", color: "#5b88b5", project_id: PROJ_THESIS },
  { id: "demo-40000000-0000-0000-0000-000000000023", name: "待审核", color: "#c49840", project_id: PROJ_THESIS },
  { id: "demo-40000000-0000-0000-0000-000000000024", name: "已完成", color: "#5b8c44", project_id: PROJ_THESIS },
];

// ============ Project Tasks ============
export const demoProjectTasks = [
  // FEM project tasks
  { id: TASK_FEM_AUTODIFF, title: "实现自动微分模块", description: "基于PyTorch autograd实现FEM求解器的反向传播", status: "in_progress", type: "task", due_date: "2026-05-15", sort_order: 1, weight: 3, project_id: PROJ_FEM, created_at: "2026-03-15T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: TASK_FEM_TESTS, title: "编写单元测试", description: "覆盖核心求解器和网格模块的测试用例", status: "todo", type: "task", due_date: "2026-05-20", sort_order: 2, weight: 2, project_id: PROJ_FEM, created_at: "2026-03-15T10:00:00+09:00", updated_at: "2026-03-15T10:00:00+09:00" },
  { id: TASK_FEM_SURVEY, title: "文献调研", description: "调研可微分物理模拟的最新论文", status: "done", type: "task", due_date: "2026-04-01", sort_order: 3, weight: 1, project_id: PROJ_FEM, created_at: "2026-03-01T10:00:00+09:00", updated_at: "2026-04-01T10:00:00+09:00" },
  { id: TASK_FEM_MESH, title: "实现网格生成模块", description: "支持三角形和四边形网格的自动生成", status: "done", type: "task", due_date: "2026-04-15", sort_order: 4, weight: 2, project_id: PROJ_FEM, created_at: "2026-03-15T10:00:00+09:00", updated_at: "2026-04-15T10:00:00+09:00" },
  // Habit tasks for FEM project
  { id: HABIT_GYM, title: "每日健身", description: "保持每天至少30分钟运动", status: "in_progress", type: "habit", due_date: null, sort_order: 10, weight: 1, project_id: PROJ_FEM, created_at: "2026-03-01T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: HABIT_EARLY, title: "早起打卡", description: "每天7:30前起床", status: "in_progress", type: "habit", due_date: null, sort_order: 11, weight: 1, project_id: PROJ_FEM, created_at: "2026-03-01T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: HABIT_READ, title: "每日阅读", description: "每天至少读30分钟论文或技术书", status: "in_progress", type: "habit", due_date: null, sort_order: 12, weight: 1, project_id: PROJ_FEM, created_at: "2026-04-01T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  // Blog project tasks
  { id: TASK_BLOG_SETUP, title: "搭建框架", description: "用Astro + Tailwind搭建博客框架", status: "done", type: "task", due_date: "2026-04-25", sort_order: 1, weight: 2, project_id: PROJ_BLOG, created_at: "2026-04-15T10:00:00+09:00", updated_at: "2026-04-25T10:00:00+09:00" },
  { id: TASK_BLOG_ARTICLE, title: "撰写第一篇文章", description: "PyTorch自定义CUDA算子教程", status: "in_progress", type: "task", due_date: "2026-05-15", sort_order: 2, weight: 3, project_id: PROJ_BLOG, created_at: "2026-04-25T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: TASK_BLOG_DEPLOY, title: "部署上线", description: "Vercel部署 + 自定义域名", status: "todo", type: "task", due_date: "2026-05-20", sort_order: 3, weight: 1, project_id: PROJ_BLOG, created_at: "2026-04-15T10:00:00+09:00", updated_at: "2026-04-15T10:00:00+09:00" },
  // Thesis project tasks
  { id: TASK_THESIS_LIT, title: "完成文献综述", description: "整理可微分FEM相关文献，写综述初稿", status: "in_progress", type: "task", due_date: "2026-06-01", sort_order: 1, weight: 3, project_id: PROJ_THESIS, created_at: "2026-02-01T10:00:00+09:00", updated_at: "2026-05-08T10:00:00+09:00" },
  { id: TASK_THESIS_EXPT, title: "设计实验方案", description: "确定基准测试和对比实验", status: "todo", type: "task", due_date: "2026-07-01", sort_order: 2, weight: 2, project_id: PROJ_THESIS, created_at: "2026-02-01T10:00:00+09:00", updated_at: "2026-02-01T10:00:00+09:00" },
  { id: TASK_THESIS_CH1, title: "写第一章", description: "绪论：研究背景、动机和贡献", status: "todo", type: "task", due_date: "2026-08-01", sort_order: 3, weight: 2, project_id: PROJ_THESIS, created_at: "2026-02-01T10:00:00+09:00", updated_at: "2026-02-01T10:00:00+09:00" },
];

// ============ Habit Logs (dynamic — last 14 days) ============
export const demoHabitLogs: Array<{ id: string; task_id: string; log_date: string; completed_at: string | null }> = [];

// ============ Civil Service ============
const CIVIL_EXAM_1 = "demo-cs-exam-0000-0000-0000-000000000001";
const CIVIL_PLAN_1 = "demo-cs-plan-0000-0000-0000-000000000001";
const CIVIL_PLAN_2 = "demo-cs-plan-0000-0000-0000-000000000002";
const CIVIL_WRONG_1 = "demo-cs-wrong-000-0000-0000-000000000001";
const CIVIL_WRONG_2 = "demo-cs-wrong-000-0000-0000-000000000002";

function civilToday(): string {
  return new Date().toISOString().split("T")[0];
}

function civilExamDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 5);
  return d.toISOString().split("T")[0];
}

export const demoCivilExams = [
  {
    id: CIVIL_EXAM_1,
    user_id: DEMO_USER,
    name: "2027国考",
    exam_date: civilExamDate(),
    exam_type: "国考",
    is_primary: true,
    is_archived: false,
    notes: "目标岗位：综合管理",
    created_at: "2026-05-01T00:00:00+09:00",
    updated_at: "2026-05-01T00:00:00+09:00",
  },
];

export const demoCivilPlanItems = [
  {
    id: CIVIL_PLAN_1,
    user_id: DEMO_USER,
    title: "言语理解刷题 20 道",
    detail: "重点看主旨概括",
    plan_date: civilToday(),
    subject_group: "xingce",
    subject_tag: "言语理解",
    start_time: null as string | null,
    end_time: null as string | null,
    source: "plan",
    is_completed: false,
    completed_at: null as string | null,
    synced_schedule_id: null as string | null,
    synced_todo_id: null as string | null,
    sort_order: 0,
    created_at: "2026-05-01T00:00:00+09:00",
    updated_at: "2026-05-01T00:00:00+09:00",
  },
  {
    id: CIVIL_PLAN_2,
    user_id: DEMO_USER,
    title: "申论素材整理",
    detail: null as string | null,
    plan_date: civilToday(),
    subject_group: "shenlun",
    subject_tag: "申论",
    start_time: null as string | null,
    end_time: null as string | null,
    source: "plan",
    is_completed: true,
    completed_at: "2026-05-08T10:00:00+09:00",
    synced_schedule_id: null as string | null,
    synced_todo_id: null as string | null,
    sort_order: 1,
    created_at: "2026-05-01T00:00:00+09:00",
    updated_at: "2026-05-08T10:00:00+09:00",
  },
];

export const demoCivilCheckins = [
  {
    id: "demo-cs-check-000-0000-0000-000000000001",
    user_id: DEMO_USER,
    date: civilToday(),
    studied_minutes: 90,
    note: null as string | null,
    created_at: "2026-05-08T00:00:00+09:00",
    updated_at: "2026-05-08T00:00:00+09:00",
  },
];

export const demoCivilWrongAnswers = [
  {
    id: CIVIL_WRONG_1,
    user_id: DEMO_USER,
    subject_group: "xingce",
    subject_tag: "资料分析",
    title: "增长率比较易错",
    content: "两期增长量比较时忽略基期差异",
    wrong_reason: "只看分子未看分母",
    knowledge_point: "增长率比较",
    image_url: null as string | null,
    question_type: null as string | null,
    options: null as any,
    correct_answer: null as string | null,
    user_answer: null as string | null,
    image_required: false,
    review_status: "pending",
    source_date: civilToday(),
    next_review_date: civilToday(),
    review_interval_days: 1,
    last_reviewed_at: null as string | null,
    ai_draft_meta: null as any,
    created_at: "2026-05-08T00:00:00+09:00",
    updated_at: "2026-05-08T00:00:00+09:00",
  },
  {
    id: CIVIL_WRONG_2,
    user_id: DEMO_USER,
    subject_group: "xingce",
    subject_tag: "数量关系",
    title: "等差数列求和",
    content: "已知等差数列 $\\{a_n\\}$ 中 $a_1=3$，公差 $d=2$，求前 10 项之和 $S_{10}$。",
    wrong_reason: "误用等比数列求和公式 $S_n=\\frac{a_1(1-q^n)}{1-q}$",
    knowledge_point: "等差数列求和",
    image_url: null as string | null,
    question_type: "choice",
    options: [
      { key: "A", text: "$S_{10}=120$" },
      { key: "B", text: "$S_{10}=110$" },
      { key: "C", text: "$S_{10}=100$" },
      { key: "D", text: "$S_{10}=90$" },
    ],
    correct_answer: "A",
    user_answer: "C",
    image_required: false,
    review_status: "pending",
    source_date: civilToday(),
    next_review_date: civilToday(),
    review_interval_days: 1,
    last_reviewed_at: null as string | null,
    ai_draft_meta: null as any,
    created_at: "2026-05-08T00:00:00+09:00",
    updated_at: "2026-05-08T00:00:00+09:00",
  },
];

function civilDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export const demoCivilXingcePapers = [
  {
    id: "demo-cs-paper-000-0000-0000-000000000001",
    user_id: DEMO_USER,
    taken_date: civilDaysAgo(14),
    source: "粉笔模考 01",
    is_mock: true,
    verbal_total: 40, verbal_correct: 32,
    data_total: 20, data_correct: 14,
    graphic_total: 10, graphic_correct: 7,
    logic_total: 10, logic_correct: 6,
    analogy_total: 10, analogy_correct: 8,
    quantity_total: 15, quantity_correct: 8,
    common_total: 20, common_correct: 15,
    duration_minutes: 120,
    total_score: 68.5,
    beat_rate: 55,
    notes: "资料和数量偏弱",
    created_at: "2026-05-01T00:00:00+09:00",
    updated_at: "2026-05-01T00:00:00+09:00",
  },
  {
    id: "demo-cs-paper-000-0000-0000-000000000002",
    user_id: DEMO_USER,
    taken_date: civilDaysAgo(3),
    source: "粉笔模考 02",
    is_mock: true,
    verbal_total: 40, verbal_correct: 34,
    data_total: 20, data_correct: 16,
    graphic_total: 10, graphic_correct: 8,
    logic_total: 10, logic_correct: 7,
    analogy_total: 10, analogy_correct: 8,
    quantity_total: 15, quantity_correct: 9,
    common_total: 20, common_correct: 16,
    duration_minutes: 115,
    total_score: 72.2,
    beat_rate: 62,
    notes: "数量有进步",
    created_at: "2026-05-08T00:00:00+09:00",
    updated_at: "2026-05-08T00:00:00+09:00",
  },
];

(function generateHabitLogs() {
  let logIdx = 0;
  const habits = [HABIT_GYM, HABIT_EARLY, HABIT_READ];
  const today = new Date();
  for (let dayOffset = -13; dayOffset <= 0; dayOffset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    const dateStr = d.toISOString().split("T")[0];
    for (const taskId of habits) {
      // ~75% completion rate
      const completed = Math.random() > 0.25;
      if (completed) {
        demoHabitLogs.push({
          id: `demo-hl000000-0000-0000-0000-${String(logIdx++).padStart(12, "0")}`,
          task_id: taskId,
          log_date: dateStr,
          completed_at: `${dateStr}T22:00:00+09:00`,
        });
      }
    }
  }
})();

// ============ Aggregated Demo Data Store ============
export interface DemoDataStore {
  settings: typeof demoSettings;
  schedule_events: typeof demoScheduleEvents;
  finance_records: typeof demoFinanceRecords;
  calorie_records: typeof demoCalorieRecords;
  todos: typeof demoTodos;
  daily_tasks: typeof demoDailyTasks;
  user_points: typeof demoUserPoints;
  goals: typeof demoGoals;
  weight_records: typeof demoWeightRecords;
  measurement_records: typeof demoMeasurementRecords;
  pantry_items: typeof demoPantryItems;
  belongings_daily: typeof demoBelongingsDaily;
  belongings_durable: typeof demoBelongingsDurable;
  thoughts: typeof demoThoughts;
  learning_courses: typeof demoLearningCourses;
  learning_notes: typeof demoLearningNotes;
  projects: typeof demoProjects;
  project_tasks: typeof demoProjectTasks;
  task_tags: typeof demoTaskTags;
  habit_logs: typeof demoHabitLogs;
  shop_items: typeof demoShopItems;
  user_inventory: typeof demoUserInventory;
  gacha_pity: typeof demoGachaPity;
  civil_exams: typeof demoCivilExams;
  civil_plan_items: typeof demoCivilPlanItems;
  civil_checkins: typeof demoCivilCheckins;
  civil_wrong_answers: typeof demoCivilWrongAnswers;
  civil_xingce_papers: typeof demoCivilXingcePapers;
}

export function createDemoDataStore(): DemoDataStore {
  return {
    settings: { ...demoSettings },
    schedule_events: [...demoScheduleEvents],
    finance_records: [...demoFinanceRecords],
    calorie_records: [...demoCalorieRecords],
    todos: [...demoTodos],
    daily_tasks: [...demoDailyTasks],
    user_points: [...demoUserPoints],
    goals: [...demoGoals],
    weight_records: [...demoWeightRecords],
    measurement_records: [...demoMeasurementRecords],
    pantry_items: [...demoPantryItems],
    belongings_daily: [...demoBelongingsDaily],
    belongings_durable: [...demoBelongingsDurable],
    thoughts: [...demoThoughts],
    learning_courses: [...demoLearningCourses],
    learning_notes: [...demoLearningNotes],
    projects: [...demoProjects],
    project_tasks: [...demoProjectTasks],
    task_tags: [...demoTaskTags],
    habit_logs: [...demoHabitLogs],
    shop_items: [...demoShopItems],
    user_inventory: [...demoUserInventory],
    gacha_pity: [...demoGachaPity],
    civil_exams: [...demoCivilExams],
    civil_plan_items: [...demoCivilPlanItems],
    civil_checkins: [...demoCivilCheckins],
    civil_wrong_answers: [...demoCivilWrongAnswers],
    civil_xingce_papers: [...demoCivilXingcePapers],
  };
}
