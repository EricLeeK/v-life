import { NewspaperError, type NewspaperContext, type NewspaperPreferences, type NewspaperSnapshot, type NewspaperReport, type NewspaperReview, type NewspaperSupplement } from './newspaperTypes.ts';
import { newspaperSpine } from './newspaperHeadline.ts';
import { aggregateNewspaperSnapshot, addReportDays, assertCalendar, assertReportDate, newspaperFingerprint, reportDateAt, reportDayBounds, type NewspaperSourceRows } from './newspaperDomain.ts';
import { generateNewspaperReview } from './newspaperReview.ts';
type Row=Record<string,any>;
const PAGE=500;
const directSources=['todos','daily_tasks','todo_habit_logs','schedule_events','civil_plan_items','civil_checkins','civil_wrong_answers','civil_xingce_papers','thoughts','finance_records','calorie_records','weight_records','measurement_records'] as const;
const dateFields:Record<string,string>={todo_habit_logs:'log_date',civil_checkins:'date',civil_wrong_answers:'source_date',civil_xingce_papers:'taken_date',finance_records:'date',calorie_records:'date',weight_records:'date',measurement_records:'date',habit_logs:'log_date'};
function dbError(error:unknown):never {void error;throw new NewspaperError('DATABASE_ERROR','报纸数据暂时无法读取或保存',500);}
async function checked(query:PromiseLike<{data:any;error:any}>):Promise<any>{const {data,error}=await query;if(error)dbError(error);return data;}
export async function readAllNewspaperRows(makeQuery:()=>any):Promise<Row[]> {
  const result:Row[]=[];
  for(let offset=0;;offset+=PAGE){const data=await checked(makeQuery().order('id',{ascending:true}).range(offset,offset+PAGE-1));const rows=data??[];result.push(...rows);if(rows.length<PAGE)return result;}
}
export async function loadNewspaperSources(ctx:NewspaperContext,date:string,prefs:NewspaperPreferences):Promise<{sources:NewspaperSourceRows;coverage:NewspaperSnapshot['coverage']}> {
  const sources:NewspaperSourceRows={},coverage:NewspaperSnapshot['coverage']=[];const bounds=reportDayBounds(date,prefs.timezone,prefs.day_start_hour);
  async function load(table:string,make:()=>any){try{sources[table]=await readAllNewspaperRows(make);coverage.push({source:table,state:'ok'});}catch{sources[table]=[];coverage.push({source:table,state:'unavailable',message:'此来源暂时无法读取'});}}
  const scoped=(table:string)=>ctx.db.from(table).select('*').eq('user_id',ctx.userId);
  const filtered=(table:string)=>{let q=scoped(table);if(dateFields[table])q=q.eq(dateFields[table],date);else if(table==='thoughts')q=q.gte('created_at',bounds.start).lt('created_at',bounds.end);else if(table==='schedule_events')q=q.lt('start_time',bounds.end).gte('end_time',bounds.start);else if(table==='daily_tasks')q=q.or(`task_date.eq.${date},and(completed_at.gte.${bounds.start},completed_at.lt.${bounds.end})`);return q;};
  await Promise.all([...directSources.map(table=>load(table,()=>filtered(table))),load('projects',()=>scoped('projects')),load('learning_courses',()=>scoped('learning_courses'))]);
  async function children(table:string,parent:string,key:string){
    if(coverage.find(c=>c.source===parent)?.state!=='ok'){sources[table]=[];coverage.push({source:table,state:'unavailable',message:'父级来源暂时无法读取'});return;}
    const ids=(sources[parent]??[]).map(r=>r.id);sources[table]=[];
    try{for(let i=0;i<ids.length;i+=150){const chunk=ids.slice(i,i+150);const part=await readAllNewspaperRows(()=>{let q=ctx.db.from(table).select('*').in(key,chunk);if(dateFields[table])q=q.eq(dateFields[table],date);if(table==='learning_notes')q=q.or(`note_date.eq.${date},and(note_date.is.null,created_at.gte.${bounds.start},created_at.lt.${bounds.end})`);return q;});sources[table].push(...part);}coverage.push({source:table,state:'ok'});}catch{sources[table]=[];coverage.push({source:table,state:'unavailable',message:'此来源暂时无法读取'});}
  }
  await Promise.all([children('project_tasks','projects','project_id'),children('learning_notes','learning_courses','course_id')]);
  await children('habit_logs','project_tasks','task_id');
  return {sources,coverage};
}
function supplementFingerprint(items:NewspaperSupplement[]):string{return newspaperFingerprint(items.map(x=>({id:x.id,body:x.body,occurred_at:x.occurred_at})).sort((a,b)=>a.id.localeCompare(b.id)));}
export function createNewspaperService(ctx:NewspaperContext){
  const now=()=>ctx.now?.()??new Date();const writeDb=ctx.admin??ctx.db;
  async function authorize(permission:'read'|'write'|'delete'){const {data,error}=await ctx.db.rpc('newspaper_authorize',{p_operation:permission});if(error||data!==true)throw new NewspaperError('PERMISSION_DENIED','当前连接的权限已变更，请重新授权',403);}
  async function preferences():Promise<NewspaperPreferences>{
    const [saved,settings]=await Promise.all([checked(ctx.db.from('newspaper_preferences').select('*').eq('user_id',ctx.userId).maybeSingle()),checked((ctx.admin??ctx.db).from('settings').select('timezone,day_start_hour').eq('user_id',ctx.userId).limit(1).maybeSingle())]);
    return {enabled:saved?.enabled??false,enabled_from:saved?.enabled_from??null,timezone:saved?.timezone??settings?.timezone??'Asia/Shanghai',day_start_hour:saved?.day_start_hour??settings?.day_start_hour??0};
  }
  async function savedReport(date:string):Promise<Row|null>{return await checked(ctx.db.from('newspaper_reports').select('*').eq('user_id',ctx.userId).eq('report_date',date).maybeSingle());}
  async function snapshot(date:string,prefs:NewspaperPreferences):Promise<NewspaperSnapshot>{const loaded=await loadNewspaperSources(ctx,date,prefs);return aggregateNewspaperSnapshot({date,timezone:prefs.timezone,dayStartHour:prefs.day_start_hour,...loaded,capturedAt:now().toISOString()});}
  function dateInput(input:Row,prefs:NewspaperPreferences):string{const date=assertReportDate(String(input.date??reportDateAt(now(),prefs.timezone,prefs.day_start_hour)));if(date>reportDateAt(now(),prefs.timezone,prefs.day_start_hour))throw new NewspaperError('FUTURE_DATE','未来日期尚未发生');return date;}
  async function getReport(input:Row):Promise<NewspaperReport>{
    const prefs=await preferences(),date=dateInput(input,prefs),stored=await savedReport(date);
    const effective={...prefs,timezone:stored?.timezone??prefs.timezone,day_start_hour:stored?.day_start_hour??prefs.day_start_hour};
    const today=date===reportDateAt(now(),effective.timezone,effective.day_start_hour);
    const fresh=(!stored||today||input.check_sources!==false)?await snapshot(date,effective):null;
    const snap=(today||!stored?fresh:stored.snapshot) as NewspaperSnapshot;
    const supplements=(await readAllNewspaperRows(()=>ctx.db.from('newspaper_supplements').select('*').eq('user_id',ctx.userId).eq('report_date',date))).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))) as NewspaperSupplement[];
    // The decorator signs URLs only at read time; stored snapshots and exports never contain them.
    const {decorateNewspaperImages}=await import('./newspaperImageService.ts');
    const {assets,jobs}=await decorateNewspaperImages(ctx,date);
    const review=(stored?.review??null) as NewspaperReview|null;
    return {id:stored?.id??'',date,status:today?'draft':stored?.status??'reconstructed',timezone:effective.timezone,day_start_hour:effective.day_start_hour,revision:stored?.current_revision??0,snapshot:snap,supplements:supplements??[],review,assets,jobs,hidden_sections:stored?.hidden_sections??[],source_check_unavailable:!!fresh&&fresh.coverage.some(c=>c.state==='unavailable'),source_changed:!!stored&&!!fresh&&fresh.coverage.every(c=>c.state==='ok')&&stored.snapshot.source_fingerprint!==fresh.source_fingerprint,review_stale:!!review&&(review.source_revision!==(stored?.current_revision??0)||review.source_fingerprint!==snap.source_fingerprint||review.supplements_fingerprint!==supplementFingerprint(supplements??[])),created_at:stored?.created_at??snap.captured_at,updated_at:stored?.updated_at??snap.captured_at};
  }
  async function refresh(input:Row):Promise<NewspaperReport>{
    if(!ctx.admin)throw new NewspaperError('SERVER_CONTEXT_REQUIRED','生成报纸需要已验证的服务端身份',403);
    const prefs=await preferences(),date=dateInput(input,prefs),stored=await savedReport(date),effective={...prefs,timezone:stored?.timezone??prefs.timezone,day_start_hour:stored?.day_start_hour??prefs.day_start_hour};
    const snap=await snapshot(date,effective),today=reportDateAt(now(),effective.timezone,effective.day_start_hour);
    const status=date===today?'draft':stored?.status==='archived'||stored?.status==='reconstructed'?stored.status:prefs.enabled&&prefs.enabled_from&&date>=prefs.enabled_from?'archived':'reconstructed';
    if(snap.coverage.some(c=>c.state==='unavailable'))throw new NewspaperError('SOURCE_UNAVAILABLE','部分来源未能读取，请稍后刷新；现有报纸保持不变',503);
    await authorize('read');await authorize('write');
    const {error}=await ctx.admin.rpc('newspaper_save_snapshot',{p_user_id:ctx.userId,p_date:date,p_snapshot:snap,p_status:status,p_only_if_missing:false});if(error)dbError(error);
    return await getReport({date,check_sources:false});
  }
  async function ensureReport(date:string,createIfMissing=false):Promise<Row>{let report=await savedReport(date);if(!report&&createIfMissing){await refresh({date});report=await savedReport(date);}if(!report)throw new NewspaperError('REPORT_NOT_FOUND','请先生成并保存当天报纸',404);return report;}
  async function originalSource(source:string,id:string):Promise<boolean>{
    if(![...directSources,'project_tasks','habit_logs','learning_notes'].includes(source as any))return false;
    try{let q=ctx.db.from(source).select('*').eq('id',id);if(directSources.includes(source as any))q=q.eq('user_id',ctx.userId);const row=await checked(q.maybeSingle());if(!row)return false;
      if(source==='learning_notes')return !!await checked(ctx.db.from('learning_courses').select('id').eq('id',row.course_id).eq('user_id',ctx.userId).maybeSingle());
      if(source==='project_tasks'||source==='habit_logs'){const task=source==='habit_logs'?await checked(ctx.db.from('project_tasks').select('project_id').eq('id',row.task_id).maybeSingle()):row;if(!task)return false;return !!await checked(ctx.db.from('projects').select('id').eq('id',task.project_id).eq('user_id',ctx.userId).maybeSingle());}return true;
    }catch{return false;}
  }
  return {async execute(action:string,input:Row={}):Promise<any>{
    const readActions=['list','get','preferences_get','source_get'];const permission=readActions.includes(action)?'read':action==='supplement_delete'?'delete':'write';
    if(!ctx.permissions.read||!ctx.permissions[permission])throw new NewspaperError('PERMISSION_DENIED','当前连接未获此操作权限',403);
    await authorize('read');if(permission!=='read')await authorize(permission);
    if(action==='get')return getReport(input);
    if(action==='preferences_get')return preferences();
    if(action==='preferences_save'){
      const current=await preferences();const timezone=String(input.timezone??current.timezone),hour=input.day_start_hour??current.day_start_hour;assertCalendar(timezone,hour);
      if(input.enabled!==undefined&&typeof input.enabled!=='boolean')throw new NewspaperError('INVALID_INPUT','启用状态无效');
      const enabled=input.enabled??current.enabled,newlyEnabled=enabled&&!current.enabled;
      const row={user_id:ctx.userId,enabled,enabled_from:newlyEnabled?reportDateAt(now(),timezone,hour):current.enabled_from,timezone,day_start_hour:hour,...(newlyEnabled?{last_archived_date:null}:{})};
      await checked(writeDb.from('newspaper_preferences').upsert(row,{onConflict:'user_id'}));return preferences();
    }
    if(action==='list'){
      const limit=Math.min(200,Math.max(1,Number(input.limit??20))),offset=Math.max(0,Number(input.offset??0));if(!Number.isInteger(limit)||!Number.isInteger(offset))throw new NewspaperError('INVALID_INPUT','分页参数无效');
      const from=input.date_from??input.from,to=input.date_to??input.to;
      const dateFrom=from?assertReportDate(from):null,dateTo=to?assertReportDate(to):null;
      if(input.q!==undefined&&(typeof input.q!=='string'||input.q.length>200))throw new NewspaperError('INVALID_INPUT','搜索文字须为至多 200 字');
      let data:Row[];
      if(input.q){data=await checked(ctx.db.rpc('newspaper_search_reports',{p_query:input.q,p_date_from:dateFrom,p_date_to:dateTo,p_limit:limit,p_offset:offset}));}
      else {let q=ctx.db.from('newspaper_reports').select('*').eq('user_id',ctx.userId);if(dateFrom)q=q.gte('report_date',dateFrom);if(dateTo)q=q.lte('report_date',dateTo);data=await checked(q.order('report_date',{ascending:false}).range(offset,offset+limit));}
      const hasMore=data.length>limit;
      const items=await Promise.all(data.slice(0,limit).map(async r=>{const sections=(r.snapshot as NewspaperSnapshot).sections;const entries=sections.flatMap(s=>s.items);const {decorateNewspaperImages}=await import('./newspaperImageService.ts');const {assets}=await decorateNewspaperImages(ctx,r.report_date);const main=assets.find(a=>a.active&&a.section_id==='main')??assets.find(a=>a.active);return {id:r.id,date:r.report_date,status:r.status,revision:r.current_revision,...newspaperSpine(sections),record_count:entries.length,has_image:assets.some(a=>a.active),has_review:!!r.review,updated_at:r.updated_at,...(main?.thumbnail_url?{thumbnail_url:main.thumbnail_url}:{})};}));
      return {items,hasMore,nextOffset:hasMore?offset+limit:null};
    }
    if(action==='refresh')return refresh(input);
    if(action==='supplement_save'||action==='supplement_delete'){
      const date=assertReportDate(String(input.date));if(input.id&&!input.expected_updated_at)throw new NewspaperError('CONFLICT','请重新载入这条补记后再修改',409);
      if(action==='supplement_delete'&&!input.id)throw new NewspaperError('INVALID_INPUT','缺少补记标识');
      if(action==='supplement_save'&&(typeof input.body!=='string'||!input.body.trim()||input.body.length>50000))throw new NewspaperError('INVALID_INPUT','补记须为 1 至 50000 字');
      if(input.occurred_at!=null&&(typeof input.occurred_at!=='string'||!Number.isFinite(Date.parse(input.occurred_at))))throw new NewspaperError('INVALID_INPUT','补记时间无效');
      await ensureReport(date,action==='supplement_save');
      if(action==='supplement_delete'){const rows=await checked(writeDb.from('newspaper_supplements').delete().eq('user_id',ctx.userId).eq('report_date',date).eq('id',input.id).eq('updated_at',input.expected_updated_at).select('id'));if(!rows?.length)throw new NewspaperError('CONFLICT','补记已被修改或删除，请重新载入',409);return {deleted:true,id:input.id};}
      const body={body:input.body,occurred_at:input.occurred_at??null};
      const q=input.id?writeDb.from('newspaper_supplements').update(body).eq('user_id',ctx.userId).eq('report_date',date).eq('id',input.id).eq('updated_at',input.expected_updated_at):writeDb.from('newspaper_supplements').insert({...body,user_id:ctx.userId,report_date:date});
      const row=await checked(q.select('*').maybeSingle());if(!row)throw new NewspaperError('CONFLICT','补记已被修改或删除，请重新载入',409);return row;
    }
    if(action==='report_update'){
      const date=assertReportDate(String(input.date));const hidden=input.hidden_sections;if(!Array.isArray(hidden)||hidden.some(x=>!['chronicle','learning','finance','health','thoughts'].includes(x)))throw new NewspaperError('INVALID_INPUT','版块设置无效');
      await ensureReport(date,true);let q=writeDb.from('newspaper_reports').update({hidden_sections:[...new Set(hidden)]}).eq('user_id',ctx.userId).eq('report_date',date);if(input.expected_updated_at)q=q.eq('updated_at',input.expected_updated_at);const row=await checked(q.select('id').maybeSingle());if(!row)throw new NewspaperError('CONFLICT','报纸已被修改，请重新载入',409);return getReport({date,check_sources:false});
    }
    if(action==='source_get'){
      const report=await getReport({...input,check_sources:false});const entry=report.snapshot.sections.flatMap(x=>x.items).find(e=>e.source===input.source&&e.source_id===input.source_id);if(!entry)throw new NewspaperError('NOT_FOUND','报纸中没有这条记录',404);const available=await originalSource(entry.source,entry.source_id);return {available,snapshot:entry,...(available?{source_url:entry.source_url}:{})};
    }
    if(action==='review_generate'){
      if(!ctx.admin)throw new NewspaperError('SERVER_CONTEXT_REQUIRED','AI 复盘需要已验证的服务端身份',403);
      const prefs=await preferences(),date=dateInput(input,prefs);let report=await getReport({date,check_sources:false});
      if(!report.id||report.status==='draft')report=await refresh({date});
      const generated=await generateNewspaperReview(ctx,report),current=await getReport({date,check_sources:false});
      if(!current.review||current.revision!==generated.source_revision||current.snapshot.source_fingerprint!==generated.source_fingerprint)throw new NewspaperError('REVIEW_STALE','此请求已完成，但对应报纸版本已过期；原结果已保留，可选择重新生成',409);
      return current;
    }
    throw new NewspaperError('UNKNOWN_ACTION','不支持的报纸操作');
  }};
}
/** Bounded archival catch-up; cursor moves only after every intervening day exists, including empty days. */
export async function archiveNewspapers(admin:any,options:{now?:Date;maxUsers?:number;daysPerUser?:number}={}):Promise<{users:number;archived:number;failures:number}>{
  const now=options.now??new Date(),maxUsers=Math.min(50,options.maxUsers??20),days=Math.min(14,options.daysPerUser??3);
  const prefs:Row[]=await checked(admin.from('newspaper_preferences').select('*').eq('enabled',true).order('archive_checked_at',{ascending:true,nullsFirst:true}).limit(maxUsers));let archived=0,failures=0;
  for(const pref of prefs){
    const today=reportDateAt(now,pref.timezone,pref.day_start_hour);let date=pref.last_archived_date?addReportDays(pref.last_archived_date,1):pref.enabled_from;
    const ctx:NewspaperContext={db:admin,admin,userId:pref.user_id,permissions:{read:true,write:true,delete:false},now:()=>now};
    try{for(let count=0;date&&date<today&&count<days;count++,date=addReportDays(date,1)){
      const existing=await checked(admin.from('newspaper_reports').select('*').eq('user_id',pref.user_id).eq('report_date',date).maybeSingle());
      if(!existing||existing.status==='draft'){
        const effective:NewspaperPreferences={enabled:pref.enabled,enabled_from:pref.enabled_from,timezone:existing?.timezone??pref.timezone,day_start_hour:existing?.day_start_hour??pref.day_start_hour};const loaded=await loadNewspaperSources(ctx,date,effective);
        if(loaded.coverage.some(c=>c.state==='unavailable'))throw new NewspaperError('SOURCE_UNAVAILABLE','数据读取不完整');
        const snap=aggregateNewspaperSnapshot({date,timezone:effective.timezone,dayStartHour:effective.day_start_hour,...loaded,capturedAt:now.toISOString()});
        await checked(admin.rpc('newspaper_save_snapshot',{p_user_id:pref.user_id,p_date:date,p_snapshot:snap,p_status:'archived',p_only_if_missing:true}));archived++;
      }
      await checked(admin.from('newspaper_preferences').update({last_archived_date:date}).eq('user_id',pref.user_id));
    }}catch{failures++;}
    await checked(admin.from('newspaper_preferences').update({archive_checked_at:now.toISOString()}).eq('user_id',pref.user_id));
  }
  return {users:prefs.length,archived,failures};
}
