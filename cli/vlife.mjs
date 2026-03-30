#!/usr/bin/env node

/**
 * V-Life Manager CLI
 *
 * Usage:
 *   npx ts-node cli/vlife.ts <module> <action> [options]
 *
 * Examples:
 *   node cli/vlife.js pantry list --category="新鲜食材"
 *   node cli/vlife.js finance create --name="午饭" --amount=850 --currency=JPY --category="餐饮" --date=2026-03-30
 *   node cli/vlife.js todos list --importance=紧急
 *   node cli/vlife.js thoughts create --content="今天想到一个好点子" --tags="AI,科研"
 *   node cli/vlife.js data export --output=./backup.json
 *   node cli/vlife.js data import --input=./backup.json
 *   node cli/vlife.js dashboard summary
 *
 * Environment variables required:
 *   VLIFE_SUPABASE_URL    - Supabase project URL
 *   VLIFE_SUPABASE_KEY    - Supabase service role key (or anon key)
 */

const SUPABASE_URL = process.env.VLIFE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VLIFE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Error: Set VLIFE_SUPABASE_URL and VLIFE_SUPABASE_KEY environment variables.");
  console.error("  export VLIFE_SUPABASE_URL=https://your-project.supabase.co");
  console.error("  export VLIFE_SUPABASE_KEY=your-service-role-key");
  process.exit(1);
}

const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const TABLE_MAP = {
  pantry: "pantry_items",
  daily: "belongings_daily",
  durable: "belongings_durable",
  schedule: "schedule_events",
  calories: "calorie_records",
  finance: "finance_records",
  todos: "todos",
  thoughts: "thoughts",
  settings: "settings",
};

const ALL_TABLES = Object.values(TABLE_MAP);

// ─── Parse CLI args ───
const args = process.argv.slice(2);
const module = args[0];
const action = args[1];
const flags = {};

for (let i = 2; i < args.length; i++) {
  const m = args[i].match(/^--(\w[\w-]*)(?:=(.*))?$/);
  if (m) {
    const key = m[1].replace(/-/g, "_");
    let val = m[2];
    if (val === undefined && args[i + 1] && !args[i + 1].startsWith("--")) {
      val = args[++i];
    }
    if (val === "true") flags[key] = true;
    else if (val === "false") flags[key] = false;
    else if (val && !isNaN(Number(val))) flags[key] = Number(val);
    else flags[key] = val || true;
  }
}

async function request(method, path, body) {
  const url = `${REST_BASE}/${path}`;
  const opts = { method, headers: { ...HEADERS } };
  if (body) opts.body = JSON.stringify(body);
  if (method === "GET") delete opts.headers["Prefer"];
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  try { return JSON.parse(text); } catch { return text; }
}

function buildQuery(table, filters) {
  const params = [];
  for (const [k, v] of Object.entries(filters)) {
    if (k === "limit" || k === "output" || k === "input") continue;
    if (k === "month" && table === "finance_records") {
      params.push(`date=gte.${v}-01`);
      params.push(`date=lte.${v}-31`);
    } else if (k === "start_date" && table === "schedule_events") {
      params.push(`start_time=gte.${v}`);
    } else if (k === "end_date" && table === "schedule_events") {
      params.push(`start_time=lte.${v}T23:59:59`);
    } else if (k === "tag" && table === "thoughts") {
      params.push(`tags=cs.{${v}}`);
    } else if (typeof v === "boolean") {
      params.push(`${k}=eq.${v}`);
    } else {
      params.push(`${k}=eq.${v}`);
    }
  }
  const limit = filters.limit || 50;
  params.push(`order=created_at.desc`);
  params.push(`limit=${limit}`);
  return params.join("&");
}

async function handleDataExport() {
  const data = {};
  for (const t of ALL_TABLES) {
    const rows = await request("GET", `${t}?order=created_at.desc&limit=10000`);
    data[t] = rows;
  }
  const json = JSON.stringify(data, null, 2);
  if (flags.output) {
    const fs = await import("fs");
    fs.writeFileSync(flags.output, json, "utf-8");
    console.log(`Exported to ${flags.output} (${ALL_TABLES.length} tables)`);
  } else {
    console.log(json);
  }
}

async function handleDataImport() {
  if (!flags.input) {
    console.error("Error: --input=<file.json> is required");
    process.exit(1);
  }
  const fs = await import("fs");
  const raw = fs.readFileSync(flags.input, "utf-8");
  const data = JSON.parse(raw);
  for (const t of ALL_TABLES) {
    if (data[t] && Array.isArray(data[t]) && data[t].length > 0) {
      // Upsert by using POST with on_conflict
      const url = `${t}?on_conflict=id`;
      const res = await fetch(`${REST_BASE}/${url}`, {
        method: "POST",
        headers: { ...HEADERS, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(data[t]),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`  ${t}: ERROR - ${err}`);
      } else {
        console.log(`  ${t}: ${data[t].length} rows imported`);
      }
    }
  }
  console.log("Import complete.");
}

async function handleDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [schedule, calories, finance, todos, pantry] = await Promise.all([
    request("GET", `schedule_events?start_time=gte.${today}&start_time=lte.${today}T23:59:59&order=start_time`),
    request("GET", `calorie_records?date=eq.${today}`),
    request("GET", `finance_records?date=gte.${monthStart}&date=lte.${today}&limit=10000`),
    request("GET", `todos?is_completed=eq.false`),
    request("GET", `pantry_items?limit=10000`),
  ]);

  const totalCal = calories.reduce((s, r) => s + r.calories, 0);
  const totalSpent = finance.reduce((s, r) => s + Number(r.amount_cny), 0);
  const urgent = todos.filter((t) => t.importance === "紧急").length;
  const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
  const expiring = pantry.filter((p) => p.expiry_date && p.expiry_date <= threeDays).length;

  console.log(`\n📊 V-Life Dashboard (${today})`);
  console.log(`─────────────────────────────`);
  console.log(`📅 今日日程: ${schedule.length} 个${schedule[0] ? ` | 下一个: ${schedule[0].title}` : ""}`);
  console.log(`🔥 今日热量: ${totalCal} kcal`);
  console.log(`💰 本月支出: ¥${totalSpent.toFixed(2)}`);
  console.log(`✅ 待办事项: ${todos.length} 个未完成${urgent ? ` (${urgent} 个紧急)` : ""}`);
  console.log(`🥬 即将过期: ${expiring} 项食材`);
  console.log();
}

async function main() {
  if (!module) {
    console.log(`
V-Life Manager CLI

Usage: vlife <module> <action> [--key=value ...]

Modules:
  pantry      食材管理      (list, get, create, update, delete)
  daily       日用品        (list, get, create, update, delete)
  durable     耐用品        (list, get, create, update, delete)
  schedule    日程          (list, get, create, update, delete)
  calories    热量记录      (list, get, create, update, delete)
  finance     记账          (list, get, create, update, delete)
  todos       待办事项      (list, get, create, update, delete)
  thoughts    随想          (list, get, create, update, delete)
  dashboard   概览          (summary)
  data        数据管理      (export, import)

Examples:
  vlife pantry list --category="新鲜食材"
  vlife finance create --name="午饭" --amount=850 --currency=JPY --category="餐饮" --date=2026-03-30
  vlife todos list --importance=紧急 --is_completed=false
  vlife data export --output=./backup.json
  vlife data import --input=./backup.json
  vlife dashboard summary
`);
    return;
  }

  // Special modules
  if (module === "data") {
    if (action === "export") return handleDataExport();
    if (action === "import") return handleDataImport();
    console.error("Usage: vlife data <export|import>");
    process.exit(1);
  }

  if (module === "dashboard") {
    return handleDashboard();
  }

  const table = TABLE_MAP[module];
  if (!table) {
    console.error(`Unknown module: ${module}. Use: ${Object.keys(TABLE_MAP).join(", ")}`);
    process.exit(1);
  }

  switch (action) {
    case "list": {
      const query = buildQuery(table, flags);
      const data = await request("GET", `${table}?${query}`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case "get": {
      if (!flags.id) { console.error("Error: --id required"); process.exit(1); }
      const data = await request("GET", `${table}?id=eq.${flags.id}`);
      console.log(JSON.stringify(data[0] || null, null, 2));
      break;
    }
    case "create": {
      const { id, ...body } = flags;
      // Handle tags for thoughts
      if (module === "thoughts" && typeof body.tags === "string") {
        body.tags = body.tags.split(",").map((s) => s.trim());
      }
      // Handle finance currency conversion
      if (module === "finance" && !body.amount_cny) {
        if (body.currency === "JPY") {
          const settings = await request("GET", `settings?limit=1`);
          const rate = settings[0]?.exchange_rate_jpy_to_cny || 0.048;
          body.amount_cny = Number(body.amount) * rate;
          body.exchange_rate = rate;
        } else {
          body.amount_cny = Number(body.amount);
          body.exchange_rate = 1;
        }
      }
      const data = await request("POST", table, body);
      console.log("Created:", JSON.stringify(data, null, 2));
      break;
    }
    case "update": {
      if (!flags.id) { console.error("Error: --id required"); process.exit(1); }
      const { id, ...body } = flags;
      if (module === "thoughts" && typeof body.tags === "string") {
        body.tags = body.tags.split(",").map((s) => s.trim());
      }
      const data = await request("PATCH", `${table}?id=eq.${id}`, body);
      console.log("Updated:", JSON.stringify(data, null, 2));
      break;
    }
    case "delete": {
      if (!flags.id) { console.error("Error: --id required"); process.exit(1); }
      await request("DELETE", `${table}?id=eq.${flags.id}`);
      console.log("Deleted successfully.");
      break;
    }
    default:
      console.error(`Unknown action: ${action}. Use: list, get, create, update, delete`);
      process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
