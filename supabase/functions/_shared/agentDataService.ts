/** User-JWT-only domain operations; the database owns agent mutation authorization and transactions. */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { agentMetaOf, moduleByKey, type ModuleDef, type FieldDef } from "./moduleRegistry.ts";
import { mutateIdempotently } from "./agentAccess.ts";
export interface AgentContext {
  db: SupabaseClient; userId: string; clientId?: string;
  requestId?: string; toolName?: string; idempotencyKey?: string;
  permissions: { read: boolean; write: boolean; delete: boolean };
}
export type AgentDataResult<T = Record<string, unknown>> = { data: T; count?: number; hasMore?: boolean; nextOffset?: number | null };
export interface AgentListOptions { limit?: number; offset?: number; filters?: Record<string, unknown>; date_from?: string; date_to?: string }
type Row = Record<string, unknown>;
export class AgentDataError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) { super(message); this.name = "AgentDataError"; }
}
function fail(code: string, message: string): never { throw new AgentDataError(code, message); }
const owners: Record<string, {table:string; column:string}> = {
  project_tasks: {table:"projects",column:"project_id"}, learning_notes: {table:"learning_courses",column:"course_id"},
};
function moduleOrFail(key: string): ModuleDef {
  const mod = moduleByKey[key]; if (!mod || !agentMetaOf(mod).agentVisible) fail("MODULE_NOT_FOUND", `Unknown or unavailable module: ${key}`); return mod;
}
function projection(mod: ModuleDef) { return [...new Set(["id", ...agentMetaOf(mod).readFields])].join(","); }
function redact(mod: ModuleDef, row: Row): Row {
  const meta = agentMetaOf(mod); const allowed = new Set(["id", ...meta.readFields]);
  return Object.fromEntries(Object.entries(row).filter(([k]) => allowed.has(k) && !meta.sensitiveFields.includes(k)));
}
function validDate(value: unknown): boolean { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
function validField(f: FieldDef, value: unknown): boolean {
  if (f.enum && f.vocab !== "open" && !f.enum.includes(String(value))) return false;
  switch(f.type) {
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value) && (f.promptType !== "string[]" || value.every(v => typeof v === "string"));
    case "date": return validDate(value);
    case "datetime": return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
    default: return typeof value === "string";
  }
}
function sanitize(mod: ModuleDef, input: unknown, operation: "create"|"update"): Row {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_INPUT", "Data must be an object");
  const row = input as Row; if (Object.hasOwn(row,"user_id")) fail("USER_ID_FORBIDDEN", "Identity comes from the authenticated session");
  const meta = agentMetaOf(mod); const allowed = operation === "create" ? meta.createFields : meta.updateFields;
  const result: Row = {};
  for (const [key,value] of Object.entries(row)) {
    if (!allowed.includes(key)) fail("FIELD_NOT_ALLOWED", `Field is not writable: ${key}`);
    if (value === undefined) continue;
    const f = mod.fields.find(f => f.name === key);
    if (!f || !validField(f,value)) fail("INVALID_INPUT", `Invalid value for ${key}`);
    result[key] = value;
  }
  if (operation === "update" && !Object.keys(result).length) fail("INVALID_INPUT", "Update must contain at least one field");
  if (operation === "create") for (const f of mod.fields) {
    if (mod.key === "habit_log" && f.name === "title" && result.todo_id) continue;
    if (f.required && !f.internal && !f.updateOnly && (result[f.name] === undefined || result[f.name] === "")) fail("INVALID_INPUT", `Missing required field: ${f.name}`);
  }
  return result;
}
async function resolveRelation(ctx: AgentContext, mod: ModuleDef, input: Row): Promise<Row> {
  const payload = {...input}; const r = mod.executor?.resolves;
  if (mod.key === "habit_log") {
    let q = ctx.db.from("todos").select("id,kind").eq("user_id",ctx.userId).eq("kind","habit");
    q = payload.todo_id ? q.eq("id",payload.todo_id) : q.eq("title",payload.title);
    const {data,error} = await q.limit(2); if (error) fail("RELATION_LOOKUP_FAILED",error.message);
    if (!data?.length) fail("RELATION_NOT_FOUND","Habit not found; provide an existing habit title or todo_id");
    if (data.length > 1) fail("RELATION_AMBIGUOUS","Multiple habits have that title; use todo_id");
    payload.todo_id = data[0].id; delete payload.title;
    if (payload.value !== undefined && Number(payload.value) < 0) fail("INVALID_INPUT","Habit value must be non-negative");
    if (payload.broken === true) fail("INVALID_INPUT","Use value=1 to record avoidance success");
    return payload;
  }
  if (!r || payload[r.from] === undefined) return payload;
  if (!payload[r.from]) fail("INVALID_INPUT",`${r.from} cannot be empty`);
  const {data,error} = await ctx.db.from(r.targetTable).select("id").eq("user_id",ctx.userId).eq(r.targetField,payload[r.from]).limit(2);
  if(error) fail("RELATION_LOOKUP_FAILED",error.message);
  if(!data?.length) fail("RELATION_NOT_FOUND",`No record matched ${r.from}`);
  if(data.length>1) fail("RELATION_AMBIGUOUS",`Multiple records matched ${r.from}; rename to a unique name before retrying`);
  delete payload[r.from]; payload[r.toColumn] = data[0].id; return payload;
}
/** Parent-owned tables have no user_id: restrict to IDs fetched from user-scoped parents. */
async function scope(ctx: AgentContext, mod: ModuleDef, query: any): Promise<{query:any}> {
  const owner=owners[mod.table]; if(!owner) return {query:query.eq("user_id",ctx.userId)};
  const ids:string[]=[];
  for(let offset=0;;offset+=200){
    const {data,error}=await ctx.db.from(owner.table).select("id").eq("user_id",ctx.userId).order("id",{ascending:true}).range(offset,offset+199);
    if(error) fail("DATABASE_ERROR",error.message);
    ids.push(...(data??[]).map((row:{id:string})=>row.id)); if((data??[]).length<200)break;
  }
  return {query:query.in(owner.column,ids)};
}
function applyFilters(mod:ModuleDef,q:any,opts:AgentListOptions){
  if(opts.date_from&&opts.date_to&&opts.date_from>opts.date_to)fail("INVALID_INPUT","date_from must not be later than date_to");
  for(const [key,value] of Object.entries(opts.filters??{})){
    if(!agentMetaOf(mod).readFields.includes(key))fail("FIELD_NOT_ALLOWED",`Field is not readable: ${key}`);
    if(value!==undefined&&value!==null)q=q.eq(key,value);
  }
  for(const [key,method] of [["date_from","gte"],["date_to","lte"]] as const){
    if(opts[key]!==undefined){if(!validDate(opts[key]))fail("INVALID_INPUT",`Invalid ${key}`); const field=mod.executor?.dateField; if(!field)fail("INVALID_INPUT","Module has no date filter");
      if(mod.fields.find(f=>f.name===field)?.type==='datetime'){
        const value=key==='date_to'?new Date(Date.parse(opts[key]!)+86400000).toISOString().slice(0,10):opts[key];
        q=q[key==='date_to'?'lt':'gte'](field,`${value}T00:00:00+08:00`);
      }else q=q[method](field,opts[key]);}
  }
  return q;
}
export function createAgentDataService(ctx:AgentContext){
  const permit=(key:"read"|"write"|"delete")=>{if(!ctx.permissions[key])fail("PERMISSION_DENIED",`${key} permission is required`);};
  async function readPage(key:string,opts:AgentListOptions={},search?:string):Promise<AgentDataResult<Row[]>>{
    permit("read");const mod=moduleOrFail(key);const limit=opts.limit??50,offset=opts.offset??0;
    if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0)fail("INVALID_INPUT","limit must be 1..200 and offset a non-negative integer");
    let {query:q}=await scope(ctx,mod,ctx.db.from(mod.table).select(projection(mod))); q=applyFilters(mod,q,opts);
    if(search!==undefined){const field=mod.executor?.nameField;if(!field||!agentMetaOf(mod).readFields.includes(field))fail("INVALID_INPUT","Module has no searchable text field");q=q.ilike(field,`%${search.replace(/[\\%_]/g,"\\$&")}%`);}
    const {data,error}=await q.order("id",{ascending:true}).range(offset,offset+limit);if(error)fail("DATABASE_ERROR",error.message);
    const rows=(data??[]) as Row[];const hasMore=rows.length>limit;
    return {data:rows.slice(0,limit).map(r=>redact(mod,r)),hasMore,nextOffset:hasMore?offset+limit:null};
  }
  async function mutate(key:string,operation:"create"|"update"|"delete",id:string|null,input:unknown={}):Promise<AgentDataResult>{
    permit(operation==="delete"?"delete":"write");const mod=moduleOrFail(key);if(!mod.actions[operation])fail("ACTION_NOT_ALLOWED",`${operation} is not allowed for ${key}`);
    let payload=operation==="delete"?{}:await resolveRelation(ctx,mod,sanitize(mod,input,operation));
    if(ctx.clientId){
      try{
        const result=await mutateIdempotently(ctx.db,{module:key,operation,id,payload,key:ctx.idempotencyKey??null,requestId:ctx.requestId??crypto.randomUUID(),toolName:ctx.toolName??`${key}_${operation}`});
        const envelope=result as {data?:Row;error?:{code:string;message:string}};
        if(envelope?.error)fail(envelope.error.code,envelope.error.message);
        if(!envelope?.data)fail("DATABASE_ERROR","Mutation returned no record");return {data:redact(mod,envelope.data)};
      }catch(e){if(e instanceof AgentDataError)throw e;const error=e as {code?:string;message?:string};fail(error.code??"DATABASE_ERROR",error.message??"Mutation failed");}
    }
    if(key==="finance"&&operation!=="delete"){
      let old:Row|undefined;
      if(operation==="update"){const r=await ctx.db.from(mod.table).select("amount,currency,amount_cny,exchange_rate").eq("user_id",ctx.userId).eq("id",id).maybeSingle();if(r.error)fail("DATABASE_ERROR",r.error.message);if(!r.data)fail("NOT_FOUND","Record not found");old=r.data;}
      const amount=Number(payload.amount??old?.amount),currency=payload.currency??old?.currency;
      if(operation==="create"||payload.amount!==undefined||payload.currency!==undefined){
        let rate=1;
        if(currency==="JPY"){
          rate=old?.currency===currency?Number(old.exchange_rate)||(Number(old.amount)!==0?Number(old.amount_cny)/Number(old.amount):0):0;
          if(!(rate>0&&Number.isFinite(rate))){const r=await ctx.db.from("settings").select("exchange_rate_jpy_to_cny").eq("user_id",ctx.userId).limit(1).maybeSingle();if(r.error)fail("DATABASE_ERROR",r.error.message);rate=Number(r.data?.exchange_rate_jpy_to_cny)||0.048;}
        }
        payload={...payload,exchange_rate:rate,amount_cny:Number((amount*rate).toFixed(2))};
      }
    }
    let q:any;
    if(operation==="create"){
      if(!owners[mod.table])payload.user_id=ctx.userId;
      if(key==="habit_log"){payload.log_date=new Date().toISOString().slice(0,10);payload.value??=1;payload.broken=false;q=ctx.db.from(mod.table).upsert(payload,{onConflict:"todo_id,log_date"});}
      else if(mod.executor?.upsert)q=ctx.db.from(mod.table).upsert(payload,{onConflict:mod.executor.upsert.join(",")});
      else q=ctx.db.from(mod.table).insert(payload);
    }else {const base=operation==="update"?ctx.db.from(mod.table).update(payload):ctx.db.from(mod.table).delete();q=(await scope(ctx,mod,base)).query.eq("id",id);}
    const {data,error}=await q.select(projection(mod)).maybeSingle();if(error)fail("DATABASE_ERROR",error.message);if(!data)fail("NOT_FOUND","Record not found");return {data:redact(mod,data)};
  }
  return {
    list:readPage,
    search:(key:string,query:string,opts:AgentListOptions={})=>readPage(key,opts,query),
    export:(key:string,opts:AgentListOptions={})=>{if(!agentMetaOf(moduleOrFail(key)).exportable)fail("EXPORT_NOT_ALLOWED","Module cannot be exported");return readPage(key,{...opts,limit:opts.limit??200});},
    async get(key:string,id:string):Promise<AgentDataResult>{permit("read");const mod=moduleOrFail(key);const {query}=await scope(ctx,mod,ctx.db.from(mod.table).select(projection(mod)));const {data,error}=await query.eq("id",id).maybeSingle();if(error)fail("DATABASE_ERROR",error.message);if(!data)fail("NOT_FOUND","Record not found");return{data:redact(mod,data)};},
    create:(key:string,input:unknown)=>mutate(key,"create",null,input),
    update:(key:string,id:string,input:unknown)=>mutate(key,"update",id,input),
    delete:(key:string,id:string)=>mutate(key,"delete",id),
    async summary(key:string,opts:AgentListOptions={}):Promise<AgentDataResult>{permit("read");const mod=moduleOrFail(key);const {query}=await scope(ctx,mod,ctx.db.from(mod.table).select("id",{count:"exact",head:true}));const {count,error}=await applyFilters(mod,query,opts);if(error)fail("DATABASE_ERROR",error.message);return{data:{module:key,count:count??0}};},
    async financeSummary(opts:AgentListOptions={}):Promise<AgentDataResult>{let offset=0,count=0,total=0;const byCategory:Record<string,number>={};for(;;){const page=await readPage("finance",{...opts,limit:200,offset});for(const row of page.data){const amount=Number(row.amount_cny)||0;total+=amount;count++;const category=String(row.category);byCategory[category]=(byCategory[category]??0)+amount;}if(!page.hasMore)break;offset=page.nextOffset!;}return{data:{count,total_cny:Number(total.toFixed(2)),by_category:byCategory}};},
  };
}
export const projectAgentFields=(key:string,row:Row)=>redact(moduleOrFail(key),row);
