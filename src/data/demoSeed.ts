// Demo seed data for Guest Tour mode
// Persona: 小明 (Xiao Ming) — Chinese grad student in Sapporo, Japan
// "Today" is 2026-05-08 (Friday)

// ============ Fixed UUIDs ============
const DEMO_USER = "demo-00000000-0000-0000-0000-000000000001";
const SETTINGS_ID = "demo-10000000-0000-0000-0000-000000000001";

// Schedule event UUIDs
const EVT_WAKE = "demo-20000000-0000-0000-0000-000000000001";
const EVT_LUNCH = "demo-20000000-0000-0000-0000-000000000002";
const EVT_GYM = "demo-20000000-0000-0000-0000-000000000003";
const EVT_SLEEP = "demo-20000000-0000-0000-0000-000000000004";
const EVT_MATH1 = "demo-20000000-0000-0000-0000-000000000005";
const EVT_MATH2 = "demo-20000000-0000-0000-0000-000000000006";
const EVT_MATH3 = "demo-20000000-0000-0000-0000-000000000007";
const EVT_DL1 = "demo-20000000-0000-0000-0000-000000000008";
const EVT_DL2 = "demo-20000000-0000-0000-0000-000000000009";
const EVT_DINNER = "demo-20000000-0000-0000-0000-000000000010";
const EVT_MEETING = "demo-20000000-0000-0000-0000-000000000011";

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
  custom_thought_tags: null,
  created_at: "2026-04-01T00:00:00+09:00",
  updated_at: "2026-05-08T00:00:00+09:00",
};

// ============ Schedule Events ============
export const demoScheduleEvents = [
  // Daily routines — today (2026-05-08, Friday)
  { id: EVT_WAKE, title: "起床", start_time: "2026-05-08T07:00:00+09:00", end_time: "2026-05-08T07:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_LUNCH, title: "午餐", start_time: "2026-05-08T12:00:00+09:00", end_time: "2026-05-08T12:45:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_GYM, title: "健身", start_time: "2026-05-08T17:00:00+09:00", end_time: "2026-05-08T18:00:00+09:00", importance: "normal", status: "confirmed", color: "#d17847", notes: "胸部+三头", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_SLEEP, title: "睡觉", start_time: "2026-05-08T23:00:00+09:00", end_time: "2026-05-08T23:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  // Friday classes
  { id: EVT_MATH3, title: "高等数学 III", start_time: "2026-05-08T09:00:00+09:00", end_time: "2026-05-08T10:30:00+09:00", importance: "important", status: "confirmed", color: "#5b88b5", notes: "講義室 A301", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  // 导师组会 (Friday afternoon)
  { id: EVT_MEETING, title: "导师组会", start_time: "2026-05-08T14:00:00+09:00", end_time: "2026-05-08T16:00:00+09:00", importance: "important", status: "confirmed", color: "#8b7bb8", notes: "汇报FEM项目进展", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  // Monday (May 4)
  { id: "demo-20000000-0000-0000-0000-000000000020", title: "起床", start_time: "2026-05-04T07:00:00+09:00", end_time: "2026-05-04T07:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-04T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_MATH1, title: "高等数学 I", start_time: "2026-05-04T09:00:00+09:00", end_time: "2026-05-04T10:30:00+09:00", importance: "important", status: "confirmed", color: "#5b88b5", notes: "講義室 A301", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-04T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000021", title: "午餐", start_time: "2026-05-04T12:00:00+09:00", end_time: "2026-05-04T12:45:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-04T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000022", title: "健身", start_time: "2026-05-04T17:00:00+09:00", end_time: "2026-05-04T18:00:00+09:00", importance: "normal", status: "confirmed", color: "#d17847", notes: "腿部训练", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-04T00:00:00+09:00", user_id: DEMO_USER },
  // Tuesday (May 5)
  { id: "demo-20000000-0000-0000-0000-000000000030", title: "起床", start_time: "2026-05-05T07:00:00+09:00", end_time: "2026-05-05T07:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-05T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_DL1, title: "深度学习研讨", start_time: "2026-05-05T14:00:00+09:00", end_time: "2026-05-05T16:00:00+09:00", importance: "important", status: "confirmed", color: "#5b88b5", notes: "研讨室 B205", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-05T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000031", title: "午餐", start_time: "2026-05-05T12:00:00+09:00", end_time: "2026-05-05T12:45:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-05T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000032", title: "健身", start_time: "2026-05-05T17:00:00+09:00", end_time: "2026-05-05T18:00:00+09:00", importance: "normal", status: "confirmed", color: "#d17847", notes: "背部+二头", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-05T00:00:00+09:00", user_id: DEMO_USER },
  // Wednesday (May 6)
  { id: "demo-20000000-0000-0000-0000-000000000040", title: "起床", start_time: "2026-05-06T07:00:00+09:00", end_time: "2026-05-06T07:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-06T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_MATH2, title: "高等数学 II", start_time: "2026-05-06T09:00:00+09:00", end_time: "2026-05-06T10:30:00+09:00", importance: "important", status: "confirmed", color: "#5b88b5", notes: "講義室 A301", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-06T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000041", title: "午餐", start_time: "2026-05-06T12:00:00+09:00", end_time: "2026-05-06T12:45:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-06T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000042", title: "健身", start_time: "2026-05-06T17:00:00+09:00", end_time: "2026-05-06T18:00:00+09:00", importance: "normal", status: "confirmed", color: "#d17847", notes: "肩部+核心", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-06T00:00:00+09:00", user_id: DEMO_USER },
  // Thursday (May 7)
  { id: "demo-20000000-0000-0000-0000-000000000050", title: "起床", start_time: "2026-05-07T07:00:00+09:00", end_time: "2026-05-07T07:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-07T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_DL2, title: "深度学习研讨", start_time: "2026-05-07T14:00:00+09:00", end_time: "2026-05-07T16:00:00+09:00", importance: "important", status: "confirmed", color: "#5b88b5", notes: "研讨室 B205", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-07T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000051", title: "午餐", start_time: "2026-05-07T12:00:00+09:00", end_time: "2026-05-07T12:45:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-07T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000052", title: "健身", start_time: "2026-05-07T17:00:00+09:00", end_time: "2026-05-07T18:00:00+09:00", importance: "normal", status: "confirmed", color: "#d17847", notes: "有氧+拉伸", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-07T00:00:00+09:00", user_id: DEMO_USER },
  // Saturday (May 9) — weekend
  { id: "demo-20000000-0000-0000-0000-000000000060", title: "起床", start_time: "2026-05-09T09:00:00+09:00", end_time: "2026-05-09T09:30:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: EVT_DINNER, title: "和朋友聚餐", start_time: "2026-05-09T18:00:00+09:00", end_time: "2026-05-09T20:00:00+09:00", importance: "normal", status: "confirmed", color: "#8b7bb8", notes: "札幌站附近烤肉店", parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  // Sunday (May 10)
  { id: "demo-20000000-0000-0000-0000-000000000070", title: "起床", start_time: "2026-05-10T09:30:00+09:00", end_time: "2026-05-10T10:00:00+09:00", importance: "normal", status: "confirmed", color: "#5b8c44", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-20000000-0000-0000-0000-000000000071", title: "视频通话 彤彤", start_time: "2026-05-10T15:00:00+09:00", end_time: "2026-05-10T16:00:00+09:00", importance: "normal", status: "confirmed", color: "#8b7bb8", notes: null, parent_event_id: null, recurrence: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
];

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

// ============ Calorie Records ============
export const demoCalorieRecords = [
  // May 8 (today)
  { id: "demo-c0000000-0000-0000-0000-000000000001", food_name: "燕麦牛奶", calories: 320, meal_type: "breakfast", date: "2026-05-08", notes: null, created_at: "2026-05-08T08:00:00+09:00", updated_at: "2026-05-08T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000002", food_name: "便当", calories: 580, meal_type: "lunch", date: "2026-05-08", notes: null, created_at: "2026-05-08T12:10:00+09:00", updated_at: "2026-05-08T12:10:00+09:00", user_id: DEMO_USER },
  // May 7
  { id: "demo-c0000000-0000-0000-0000-000000000010", food_name: "全麦面包+鸡蛋", calories: 350, meal_type: "breakfast", date: "2026-05-07", notes: null, created_at: "2026-05-07T07:30:00+09:00", updated_at: "2026-05-07T07:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000011", food_name: "松屋牛丼", calories: 680, meal_type: "lunch", date: "2026-05-07", notes: null, created_at: "2026-05-07T12:20:00+09:00", updated_at: "2026-05-07T12:20:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000012", food_name: "米饭配鸡胸肉+西兰花", calories: 650, meal_type: "dinner", date: "2026-05-07", notes: null, created_at: "2026-05-07T19:00:00+09:00", updated_at: "2026-05-07T19:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000013", food_name: "跑步 5km", calories: 280, meal_type: "exercise", date: "2026-05-07", notes: null, created_at: "2026-05-07T17:30:00+09:00", updated_at: "2026-05-07T17:30:00+09:00", user_id: DEMO_USER },
  // May 6
  { id: "demo-c0000000-0000-0000-0000-000000000020", food_name: "燕麦酸奶", calories: 300, meal_type: "breakfast", date: "2026-05-06", notes: null, created_at: "2026-05-06T07:45:00+09:00", updated_at: "2026-05-06T07:45:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000021", food_name: "便利店便当", calories: 620, meal_type: "lunch", date: "2026-05-06", notes: null, created_at: "2026-05-06T12:15:00+09:00", updated_at: "2026-05-06T12:15:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000022", food_name: "拉面", calories: 780, meal_type: "dinner", date: "2026-05-06", notes: null, created_at: "2026-05-06T19:30:00+09:00", updated_at: "2026-05-06T19:30:00+09:00", user_id: DEMO_USER },
  // May 5
  { id: "demo-c0000000-0000-0000-0000-000000000030", food_name: "面包+牛奶", calories: 340, meal_type: "breakfast", date: "2026-05-05", notes: null, created_at: "2026-05-05T07:30:00+09:00", updated_at: "2026-05-05T07:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000031", food_name: "麦当劳套餐", calories: 720, meal_type: "lunch", date: "2026-05-05", notes: null, created_at: "2026-05-05T12:30:00+09:00", updated_at: "2026-05-05T12:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000032", food_name: "米饭配咖喱", calories: 700, meal_type: "dinner", date: "2026-05-05", notes: null, created_at: "2026-05-05T19:00:00+09:00", updated_at: "2026-05-05T19:00:00+09:00", user_id: DEMO_USER },
  // May 4
  { id: "demo-c0000000-0000-0000-0000-000000000040", food_name: "燕麦+香蕉", calories: 310, meal_type: "breakfast", date: "2026-05-04", notes: null, created_at: "2026-05-04T07:45:00+09:00", updated_at: "2026-05-04T07:45:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000041", food_name: "便当", calories: 550, meal_type: "lunch", date: "2026-05-04", notes: null, created_at: "2026-05-04T12:20:00+09:00", updated_at: "2026-05-04T12:20:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000042", food_name: "鸡胸肉沙拉", calories: 450, meal_type: "dinner", date: "2026-05-04", notes: null, created_at: "2026-05-04T19:00:00+09:00", updated_at: "2026-05-04T19:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000043", food_name: "腿部训练", calories: 250, meal_type: "exercise", date: "2026-05-04", notes: null, created_at: "2026-05-04T17:30:00+09:00", updated_at: "2026-05-04T17:30:00+09:00", user_id: DEMO_USER },
  // May 3
  { id: "demo-c0000000-0000-0000-0000-000000000050", food_name: "三明治", calories: 380, meal_type: "breakfast", date: "2026-05-03", notes: null, created_at: "2026-05-03T08:00:00+09:00", updated_at: "2026-05-03T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000051", food_name: "乌冬面", calories: 520, meal_type: "lunch", date: "2026-05-03", notes: null, created_at: "2026-05-03T12:30:00+09:00", updated_at: "2026-05-03T12:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000052", food_name: "烤鱼定食", calories: 650, meal_type: "dinner", date: "2026-05-03", notes: null, created_at: "2026-05-03T19:00:00+09:00", updated_at: "2026-05-03T19:00:00+09:00", user_id: DEMO_USER },
  // May 2
  { id: "demo-c0000000-0000-0000-0000-000000000060", food_name: "牛奶+面包", calories: 330, meal_type: "breakfast", date: "2026-05-02", notes: null, created_at: "2026-05-02T08:00:00+09:00", updated_at: "2026-05-02T08:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000061", food_name: "咖喱饭", calories: 680, meal_type: "lunch", date: "2026-05-02", notes: null, created_at: "2026-05-02T12:30:00+09:00", updated_at: "2026-05-02T12:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000062", food_name: "炒饭", calories: 600, meal_type: "dinner", date: "2026-05-02", notes: null, created_at: "2026-05-02T19:00:00+09:00", updated_at: "2026-05-02T19:00:00+09:00", user_id: DEMO_USER },
  // May 1
  { id: "demo-c0000000-0000-0000-0000-000000000070", food_name: "燕麦+蓝莓", calories: 290, meal_type: "breakfast", date: "2026-05-01", notes: null, created_at: "2026-05-01T07:30:00+09:00", updated_at: "2026-05-01T07:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000071", food_name: "便当", calories: 560, meal_type: "lunch", date: "2026-05-01", notes: null, created_at: "2026-05-01T12:15:00+09:00", updated_at: "2026-05-01T12:15:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000072", food_name: "麻辣烫", calories: 720, meal_type: "dinner", date: "2026-05-01", notes: null, created_at: "2026-05-01T19:30:00+09:00", updated_at: "2026-05-01T19:30:00+09:00", user_id: DEMO_USER },
  { id: "demo-c0000000-0000-0000-0000-000000000073", food_name: "跑步 4km", calories: 240, meal_type: "exercise", date: "2026-05-01", notes: null, created_at: "2026-05-01T17:00:00+09:00", updated_at: "2026-05-01T17:00:00+09:00", user_id: DEMO_USER },
];

// ============ Todos ============
export const demoTodos = [
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

// ============ Daily Tasks (Today's Todo) ============
export const demoDailyTasks = [
  { id: DTASK_1, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000001", task_date: "2026-05-18", difficulty: "hard", base_points: 30, is_completed: false, completed_at: null, created_at: "2026-05-18T07:00:00+09:00", updated_at: "2026-05-18T07:00:00+09:00" },
  { id: DTASK_2, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000004", task_date: "2026-05-18", difficulty: "medium", base_points: 20, is_completed: false, completed_at: null, created_at: "2026-05-18T07:00:00+09:00", updated_at: "2026-05-18T07:00:00+09:00" },
  { id: DTASK_3, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000002", task_date: "2026-05-18", difficulty: "easy", base_points: 10, is_completed: true, completed_at: "2026-05-18T10:30:00+09:00", created_at: "2026-05-18T07:00:00+09:00", updated_at: "2026-05-18T10:30:00+09:00" },
  { id: DTASK_4, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000013", task_date: "2026-05-18", difficulty: "medium", base_points: 20, is_completed: false, completed_at: null, created_at: "2026-05-18T07:00:00+09:00", updated_at: "2026-05-18T07:00:00+09:00" },
  { id: DTASK_5, user_id: DEMO_USER, todo_id: "demo-t0000000-0000-0000-0000-000000000005", task_date: "2026-05-18", difficulty: "easy", base_points: 10, is_completed: false, completed_at: null, created_at: "2026-05-18T07:00:00+09:00", updated_at: "2026-05-18T07:00:00+09:00" },
];

// ============ User Points ============
export const demoUserPoints = [
  { id: UPOINTS_ID, user_id: DEMO_USER, total_points: 1240, current_streak: 7, best_streak: 12, last_active_date: "2026-05-18", rest_day_date: null, skip_chore_active: false, sleep_in_date: null, created_at: "2026-04-01T00:00:00+09:00", updated_at: "2026-05-18T10:30:00+09:00" },
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

// ============ Goals ============
// Current week: 2026-05-04 (Monday)
// Current month: 2026-05-01
// Current year: 2026-01-01
export const demoGoals = [
  // Weekly goals (current week)
  { id: "demo-g0000000-0000-0000-0000-000000000001", title: "完成FEM自动微分模块初版", type: "week", period_start: "2026-05-04", is_completed: false, created_at: "2026-05-04T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000002", title: "复习概率论第1-3章", type: "week", period_start: "2026-05-04", is_completed: true, created_at: "2026-05-04T08:00:00+09:00", updated_at: "2026-05-06T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000003", title: "健身5次", type: "week", period_start: "2026-05-04", is_completed: false, created_at: "2026-05-04T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000004", title: "读完《深度学习》第5章", type: "week", period_start: "2026-05-04", is_completed: true, created_at: "2026-05-04T08:00:00+09:00", updated_at: "2026-05-07T20:00:00+09:00", user_id: DEMO_USER },
  // Monthly goals (May)
  { id: "demo-g0000000-0000-0000-0000-000000000010", title: "完成论文第二章初稿", type: "month", period_start: "2026-05-01", is_completed: false, created_at: "2026-05-01T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000011", title: "体重降到74kg", type: "month", period_start: "2026-05-01", is_completed: false, created_at: "2026-05-01T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000012", title: "博客上线并发布3篇文章", type: "month", period_start: "2026-05-01", is_completed: false, created_at: "2026-05-01T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  // Last week (completed)
  { id: "demo-g0000000-0000-0000-0000-000000000020", title: "提交实验报告", type: "week", period_start: "2026-04-27", is_completed: true, created_at: "2026-04-27T08:00:00+09:00", updated_at: "2026-04-30T10:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000021", title: "整理房间", type: "week", period_start: "2026-04-27", is_completed: true, created_at: "2026-04-27T08:00:00+09:00", updated_at: "2026-04-28T10:00:00+09:00", user_id: DEMO_USER },
  // Yearly goals
  { id: "demo-g0000000-0000-0000-0000-000000000030", title: "学完CS231n课程", type: "year", period_start: "2026-01-01", is_completed: false, created_at: "2026-01-01T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000031", title: "发表一篇顶会论文", type: "year", period_start: "2026-01-01", is_completed: false, created_at: "2026-01-01T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
  { id: "demo-g0000000-0000-0000-0000-000000000032", title: "体重稳定在72kg", type: "year", period_start: "2026-01-01", is_completed: false, created_at: "2026-01-01T08:00:00+09:00", updated_at: "2026-05-08T00:00:00+09:00", user_id: DEMO_USER },
];

// ============ Weight Records ============
// 30+ days from April 1 to May 8, trending 76 → 74.5
export const demoWeightRecords: Array<{ id: string; weight: number; date: string; notes: string | null; created_at: string; updated_at: string; user_id: string }> = [];
(function generateWeight() {
  const weights = [
    76.0, 76.1, 75.9, 76.2, 75.8, 75.7, 75.9, 75.6, 75.5, 75.7,
    75.3, 75.2, 75.4, 75.1, 75.0, 75.2, 74.9, 74.8, 75.0, 74.7,
    74.6, 74.8, 74.5, 74.4, 74.6, 74.3, 74.5, 74.4, 74.6, 74.5,
    74.3, 74.5, 74.4, 74.2, 74.4, 74.3, 74.5, 74.4,
  ];
  for (let i = 0; i < weights.length; i++) {
    const d = new Date(2026, 3, 1 + i); // April 1 + i
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
    content: "## 核心想法\n\n反向传播就是在计算图上反向应用链式法则。\n\n- 前向：缓存每个中间变量\n- 反向：从 loss 对输出的梯度开始传回\n- 关键：局部梯度乘以上游梯度",
    tags: ["lecture", "重点"],
    note_date: "2026-05-07",
    created_at: "2026-05-07T21:00:00+09:00",
    updated_at: "2026-05-07T21:00:00+09:00",
  },
  {
    id: "demo-61000000-0000-0000-0000-000000000002",
    course_id: COURSE_DL,
    title: "Transformer 注意力",
    content: "## Scaled Dot-Product Attention\n\n`softmax(QK^T / sqrt(d_k))V`\n\n需要注意 mask 的位置，以及多头注意力只是把表示空间拆成多个子空间。",
    tags: ["paper", "Transformer"],
    note_date: "2026-05-05",
    created_at: "2026-05-05T20:30:00+09:00",
    updated_at: "2026-05-05T20:30:00+09:00",
  },
  {
    id: "demo-61000000-0000-0000-0000-000000000003",
    course_id: COURSE_PROB,
    title: "贝叶斯公式",
    content: "## 公式\n\n`P(A|B) = P(B|A)P(A) / P(B)`\n\n考试题里通常要先拆全概率公式，再代入贝叶斯公式。",
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

// ============ Habit Logs ============
export const demoHabitLogs: Array<{ id: string; task_id: string; log_date: string; completed_at: string | null }> = [];
(function generateHabitLogs() {
  let logIdx = 0;
  const habits = [HABIT_GYM, HABIT_EARLY, HABIT_READ];
  // Generate for last 14 days (April 25 - May 8)
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const d = new Date(2026, 3, 25 + dayOffset);
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
  };
}
