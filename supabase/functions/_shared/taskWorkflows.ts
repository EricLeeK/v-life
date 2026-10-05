/** Shared contract for MCP and HTTP. Dates are resolved inside the database transaction. */
const dateInput = {
  type:'string', default:'today',
  description:'today / tomorrow / yesterday 或 YYYY-MM-DD。相对日期由服务器按 Asia/Shanghai 和用户日界线解析。',
};
export const TASK_OVERVIEW_DESCRIPTION = '今日规划、跨天安排的首选读取工具。一次返回指定日 tasks 和此前 lookback_days 天的未完成 backlog，包含标题、daily_task_id、todo_id、可迁移状态和原因，无需逐条 todo_get 或翻页。默认今天及前三天；date 可用 today/tomorrow/yesterday 或具体日期。最多500条，超限明确报错，不返回残缺清单。习惯不在此，用 habit_log。';
export const TASK_TRANSFER_DESCRIPTION = '跨天安排的首选写入工具。先从 daily_task_overview 选择真实 daily_task_id，批量移到 today/tomorrow/具体日期。必须明确 mode：move 移除所选旧安排（对应网页上箭头，需要 read/write/delete）；copy 为例行任务保留旧安排（read/write）。未完成的一次性任务只能在一个日期上，copy 也会改期并报告 moved/source_removed=true。同一总待办同一天自动去重，新目标沿用来源积分和元数据，已有目标不覆盖。仅接受未完成且可执行任务，整批原子提交或全部回滚。必须提供幂等键，重试沿用同一键及原参数；replayed=true 是原操作回执，最新状态再查 overview。保留旧安排不等于冻结历史完成状态。';
export const TASK_OVERVIEW_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{date:dateInput,lookback_days:{type:'integer',minimum:0,maximum:30,default:3,description:'相对目标日向前查询的天数；0只看目标日，1看前一天。'}},
};
export const TASK_TRANSFER_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{
    daily_task_ids:{type:'array',minItems:1,maxItems:200,uniqueItems:true,items:{type:'string',format:'uuid'},description:'选中的 daily_task_overview 返回的 daily_task_id，不能填 todo_id。最多200条；只处理这些明确选择的记录。'},
    target_date:dateInput,
    mode:{type:'string',enum:['move','copy'],description:'move 移走所选旧安排；copy 保留例行任务旧安排并再次安排；一次性任务只保留目标日期，结果为 moved。必须依据用户意图明确指定。'},
    idempotency_key:{type:'string',minLength:1,maxLength:200,description:'每个新操作生成唯一键并保存；网络或401恢复后重试必须使用原键与完全相同参数。'},
  },
  required:['daily_task_ids','mode','idempotency_key'],
};

function object(input:unknown, allowed:string[]):Record<string,unknown> {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Arguments must be an object');
  if (Object.keys(input).some(key=>!allowed.includes(key))) throw new Error('Unknown task workflow field');
  return input as Record<string,unknown>;
}
function date(value:unknown):string {
  if (value===undefined) return 'today';
  if (typeof value!=='string') throw new Error('Date must be today, tomorrow, yesterday or YYYY-MM-DD');
  if (['today','tomorrow','yesterday'].includes(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value || value<'1900-01-01') throw new Error('Invalid task date');
  return value;
}
export function taskOverviewInput(input:unknown = {}) {
  const args=object(input,['date','lookback_days']);
  const lookback=args.lookback_days===undefined?3:args.lookback_days;
  if (!Number.isInteger(lookback) || (lookback as number)<0 || (lookback as number)>30) throw new Error('lookback_days must be an integer from 0 to 30');
  return {p_date:date(args.date),p_lookback_days:lookback as number};
}
export function taskTransferInput(input:unknown, key:unknown) {
  const args=object(input,['daily_task_ids','target_date','mode']);
  const ids=args.daily_task_ids;
  if (!Array.isArray(ids) || ids.length<1 || ids.length>200 || ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new Error('Provide 1 to 200 daily_task UUIDs from the overview');
  if (new Set(ids.map(id=>id.toLowerCase())).size!==ids.length) throw new Error('daily_task_ids must be unique');
  if (args.mode!=='move' && args.mode!=='copy') throw new Error('Choose mode move or copy explicitly');
  if (typeof key!=='string' || key.trim().length===0 || key.length>200) throw new Error('A stable idempotency key of 1 to 200 characters is required');
  return {p_daily_task_ids:ids as string[],p_target_date:date(args.target_date),p_mode:args.mode,p_idempotency_key:key};
}
