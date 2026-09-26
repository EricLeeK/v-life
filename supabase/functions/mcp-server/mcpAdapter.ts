import {schemaForField,recordIdSchema,idempotencySchema,objectSchema} from './toolSchema.ts';
import { MODULES, agentMetaOf, type ModuleDef } from '../_shared/moduleRegistry.ts';
import { AGENT_CONTRACT_VERSION, buildAgentCapabilities } from '../_shared/agentCapabilities.ts';
import { AgentDataError, type AgentListOptions } from '../_shared/agentDataService.ts';
export const MCP_VERSION=AGENT_CONTRACT_VERSION;
/** Resolve the tool's three supported period forms before constructing any dates. */
export function financeSummaryPeriod(input: Record<string, unknown>, now = new Date()): AgentListOptions {
 const invalid = (message: string): never => { throw new AgentDataError('INVALID_INPUT', message); };
 if (Object.keys(input).some(key => !['year', 'month', 'date_from', 'date_to'].includes(key))) invalid('Use year/month or date_from/date_to');
 const hasMonth = input.year !== undefined || input.month !== undefined;
 const hasRange = input.date_from !== undefined || input.date_to !== undefined;
 if (hasMonth && hasRange) invalid('Use either year/month or date_from/date_to, not both');
 if (hasRange) {
  const result: AgentListOptions = {};
  for (const key of ['date_from', 'date_to'] as const) {
   const value = input[key];
   if (value === undefined) continue;
   if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) invalid(`Invalid ${key}; use YYYY-MM-DD`);
   result[key] = value as string;
  }
  if (result.date_from && result.date_to && result.date_from > result.date_to) invalid('date_from must not be later than date_to');
  return result;
 }
 const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
 const year = hasMonth ? input.year : local.getUTCFullYear();
 const month = hasMonth ? input.month : local.getUTCMonth() + 1;
 if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 9999 || typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) invalid('Provide both year (1900..9999) and month (1..12) as integers');
 return {date_from: `${year}-${String(month).padStart(2,'0')}-01`, date_to: new Date(Date.UTC(year as number, month as number, 0)).toISOString().slice(0,10)};
}
export function fieldsSchema(mod:ModuleDef,operation:'create'|'update') {
 const meta=agentMetaOf(mod),allowed=operation==='create'?meta.createFields:meta.updateFields;
 const properties:Record<string,any>={};const required:string[]=[];
 for(const f of mod.fields.filter(f=>allowed.includes(f.name))){
  properties[f.name]=schemaForField(f);
  if(operation==='create'&&f.required&&!(mod.key==='habit_log'&&f.name==='title'))required.push(f.name);
 }
 if(operation==='update'){properties.id=recordIdSchema(mod.key);required.push('id');}
 properties.idempotency_key=idempotencySchema;
 const alternatives=operation==='create'&&['daily_task','habit_log'].includes(mod.key)?['todo_id','title']:operation==='update'?allowed:[];
 return {...objectSchema(properties,required),...(alternatives.length?{anyOf:alternatives.map(key=>({required:[key]}))}:{})};
}
export const buildCapabilities=buildAgentCapabilities;
