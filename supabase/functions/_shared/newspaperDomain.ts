/** Pure newspaper calendar, normalization and portable export. Safe to import in the browser. */
import { NewspaperError, type NewspaperEntry, type NewspaperSectionId, type NewspaperSnapshot, type NewspaperReport } from './newspaperTypes.ts';
export type NewspaperSourceRows = Record<string, Record<string, unknown>[]>;
export interface AggregateNewspaperInput { date:string; timezone:string; dayStartHour:number; sources:NewspaperSourceRows; capturedAt?:string; coverage?:NewspaperSnapshot['coverage'] }
const DAY=86400000;
export function assertReportDate(date:string):string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new NewspaperError('INVALID_DATE','日期无效');
  return date;
}
export function assertCalendar(timezone:string,hour:number):void {
  if(!Number.isInteger(hour)||hour<0||hour>23) throw new NewspaperError('INVALID_DAY_START','一天起始时间应为 0 至 23 时');
  try {new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date());} catch {throw new NewspaperError('INVALID_TIMEZONE','时区无效');}
}
export function addReportDays(date:string,days:number):string { return new Date(Date.parse(assertReportDate(date))+days*DAY).toISOString().slice(0,10); }
function wallParts(now:Date,timezone:string):Record<string,string> { return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value])); }
export function reportDateAt(now:Date,timezone:string,hour:number):string {
  assertCalendar(timezone,hour); const p=wallParts(now,timezone);const date=`${p.year}-${p.month}-${p.day}`;
  return Number(p.hour)<hour?addReportDays(date,-1):date;
}
function localBoundary(date:string,timezone:string,hour:number):number {
  const wanted=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`);
  const offsets=new Set<number>();
  for(const delta of [-2*DAY,-DAY,0,DAY,2*DAY]) { const t=wanted+delta,p=wallParts(new Date(t),timezone); offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)-t); }
  // Earliest duplicate time in a fall-back; first valid local minute after a spring-forward gap.
  for(let minutes=0;minutes<=180;minutes++) {
    const wall=wanted+minutes*60000;const expected=new Date(wall).toISOString().slice(0,19);const candidates:number[]=[];
    for(const offset of offsets){const t=wall-offset,p=wallParts(new Date(t),timezone);if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`===expected)candidates.push(t);}
    if(candidates.length)return Math.min(...candidates);
  }
  throw new NewspaperError('INVALID_DAY_BOUNDARY','无法解析当天的时区边界');
}
export function reportDayBounds(date:string,timezone:string,hour:number):{start:string;end:string} {
  assertReportDate(date);assertCalendar(timezone,hour);
  return {start:new Date(localBoundary(date,timezone,hour)).toISOString(),end:new Date(localBoundary(addReportDays(date,1),timezone,hour)).toISOString()};
}
export function canonicalNewspaperJson(value:unknown):string {
  if(value===undefined)return 'null'; if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalNewspaperJson).join(',')}]`;
  return `{${Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${canonicalNewspaperJson(v)}`).join(',')}}`;
}
/** Content change detector, not an authentication hash. Two independent 32-bit lanes, browser synchronous. */
export function newspaperFingerprint(value:unknown):string {
  const text=canonicalNewspaperJson(value);let a=2166136261,b=2246822519;
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489917);}
  return `v1:${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
const s=(v:unknown):string=>v===null||v===undefined?'':String(v);
const n=(v:unknown):number=>Number.isFinite(Number(v))?Number(v):0;
const text=(...values:unknown[]):string=>values.map(s).filter(Boolean).join('\n');
const routes:Record<string,string>={todos:'/todos',daily_tasks:'/today',todo_habit_logs:'/todos',projects:'/projects',project_tasks:'/projects',habit_logs:'/projects',schedule_events:'/schedule',learning_notes:'/learning-notes',civil_plan_items:'/civil-service',civil_checkins:'/civil-service',civil_wrong_answers:'/civil-service',civil_xingce_papers:'/civil-service',thoughts:'/thoughts',finance_records:'/finance',calorie_records:'/calories',weight_records:'/weight-loss',measurement_records:'/weight-loss'};
export function aggregateNewspaperSnapshot(input:AggregateNewspaperInput):NewspaperSnapshot {
  const {date,timezone,dayStartHour,sources}=input;const bounds=reportDayBounds(date,timezone,dayStartHour);
  const isDuring=(v:unknown)=>!!v&&Number.isFinite(Date.parse(s(v)))&&Date.parse(s(v))>=Date.parse(bounds.start)&&Date.parse(s(v))<Date.parse(bounds.end);
  const rows=(name:string)=>sources[name]??[];
  const map=(name:string)=>new Map(rows(name).map(r=>[s(r.id),r]));
  const todos=map('todos'),tasks=map('project_tasks'),projects=map('projects'),courses=map('learning_courses');
  const sections:NewspaperSnapshot['sections']=[{id:'chronicle',title:'今日纪事',items:[]},{id:'learning',title:'学习与成长',items:[]},{id:'finance',title:'收支记录',items:[]},{id:'health',title:'身体与饮食',items:[]},{id:'thoughts',title:'想法与随笔',items:[]}];
  function entry(section:NewspaperSectionId,source:string,row:Record<string,unknown>,title:string,body:string,status:NewspaperEntry['status'],time?:unknown,tagDate?:unknown,extra:Record<string,unknown>={}) {
    const data=Object.fromEntries(Object.entries(row).filter(([k])=>!['user_id','created_at','updated_at','image_url','ai_draft_meta'].includes(k)));
    sections.find(x=>x.id===section)!.items.push({id:`${source}:${s(row.id)}`,source,source_id:s(row.id),source_url:`${routes[source]??'/'}?record=${encodeURIComponent(s(row.id))}`,title,body,status,...(time?{time:s(time)}:{}),...(tagDate?{date:s(tagDate)}:{}),data:{...data,...extra}});
  }
  const completed=new Set<string>();
  for(const r of rows('daily_tasks')) {
    const todo=todos.get(s(r.todo_id));if(!todo)continue;
    if(r.is_completed&&isDuring(r.completed_at)) {if(completed.has(s(r.todo_id)))continue;completed.add(s(r.todo_id));entry('chronicle','todos',todo,s(todo.title),s(todo.detail),'completed',r.completed_at,undefined,{linked_daily_task_id:r.id,completed_at:r.completed_at});}
  }
  for(const r of rows('todos'))if(r.is_completed&&isDuring(r.completed_at)&&!completed.has(s(r.id))) {completed.add(s(r.id));entry('chronicle','todos',r,s(r.title),s(r.detail),'completed',r.completed_at);}
  for(const r of rows('daily_tasks'))if(s(r.task_date)===date&&!completed.has(s(r.todo_id))) {const todo=todos.get(s(r.todo_id));if(todo)entry('chronicle','daily_tasks',r,s(todo.title),text(todo.detail,r.is_completed?'此日计划；实际完成时间不在本期或未记录。':''),'planned',undefined,r.task_date,{todo_id:todo.id});}
  const representedTodos=new Set(sections[0].items.flatMap(e=>e.source==='todos'?[e.source_id]:e.source==='daily_tasks'?[s(e.data?.todo_id)]:[]));
  for(const r of rows('todos'))if(isDuring(r.created_at)&&!representedTodos.has(s(r.id)))entry('chronicle','todos',r,s(r.title),text('新增事项',r.detail),'recorded',r.created_at);
  for(const r of rows('todo_habit_logs'))if(s(r.log_date)===date){const todo=todos.get(s(r.todo_id));if(todo)entry('chronicle','todo_habit_logs',r,s(todo.title),text(todo.detail,r.broken?'已记录中断':r.value!==null&&r.value!==undefined?`${s(r.value)} ${s(todo.habit_unit)}`:'已打卡'),'recorded',undefined,r.log_date,{habit_type:todo.habit_type,habit_unit:todo.habit_unit});}
  for(const r of rows('habit_logs'))if(s(r.log_date)===date){const task=tasks.get(s(r.task_id)),project=task?projects.get(s(task.project_id)):undefined;if(task&&project)entry('chronicle','habit_logs',r,s(task.title),text(`项目：${s(project.name)}`,task.description),'recorded',undefined,r.log_date,{project_id:project.id,task_id:task.id});}
  for(const r of rows('project_tasks'))if(s(r.due_date)===date&&r.type!=='habit'){const project=projects.get(s(r.project_id));if(project)entry('chronicle','project_tasks',r,s(r.title),text(`项目：${s(project.name)}`,r.description,r.status==='done'?'当前状态为已完成；未记录实际完成时间。':''),r.status==='done'?'recorded':'planned',undefined,r.due_date);}
  const representedTasks=new Set(sections[0].items.flatMap(e=>e.source==='project_tasks'?[e.source_id]:e.source==='habit_logs'?[s(e.data?.task_id)]:[]));
  for(const r of rows('project_tasks'))if(isDuring(r.created_at)&&!representedTasks.has(s(r.id))){const project=projects.get(s(r.project_id));if(project)entry('chronicle','project_tasks',r,s(r.title),text('新增项目事项',`项目：${s(project.name)}`,r.description),'recorded',r.created_at);}
  for(const r of rows('schedule_events'))if(Date.parse(s(r.start_time))<Date.parse(bounds.end)&&Date.parse(s(r.end_time))>Date.parse(bounds.start))entry('chronicle','schedule_events',r,s(r.title),text(r.notes,`日程状态：${s(r.status)}`),r.status==='未开始'?'planned':'recorded',r.start_time,undefined,{end_time:r.end_time});
  for(const r of rows('learning_notes'))if(r.note_date?s(r.note_date)===date:isDuring(r.created_at)){const course=courses.get(s(r.course_id));if(course)entry('learning','learning_notes',r,s(r.title),text(`课程：${s(course.name)}`,r.content),'recorded',r.note_date?undefined:r.created_at,r.note_date);}
  // Synced schedule/todo copies describe one civil activity. Group shared links before
  // selecting one entry, retaining every original body and its independent evidence.
  const civilRows=rows('civil_plan_items').slice().sort((a,b)=>s(a.id).localeCompare(s(b.id)));
  const parents=new Map<string,string>();
  function root(key:string):string{const parent=parents.get(key);if(!parent)return key;const resolved=root(parent);parents.set(key,resolved);return resolved;}
  function connect(a:string,b:string){const first=root(a),second=root(b);if(first!==second)parents.set(second,first);}
  for(const r of civilRows){const key=`civil:${s(r.id)}`;if(r.synced_todo_id)connect(key,`todo:${s(r.synced_todo_id)}`);if(r.synced_schedule_id)connect(key,`schedule:${s(r.synced_schedule_id)}`);}
  const civilGroups=new Map<string,Record<string,unknown>[]>();
  for(const r of civilRows){const key=root(`civil:${s(r.id)}`);civilGroups.set(key,[...(civilGroups.get(key)??[]),r]);}
  for(const group of civilGroups.values()){
    const todoIds=new Set(group.map(r=>s(r.synced_todo_id)).filter(Boolean)),scheduleIds=new Set(group.map(r=>s(r.synced_schedule_id)).filter(Boolean));
    const linked=sections[0].items.filter(e=>e.source==='todos'?todoIds.has(e.source_id):['daily_tasks','todo_habit_logs'].includes(e.source)?todoIds.has(s(e.data?.todo_id)):e.source==='schedule_events'&&scheduleIds.has(e.source_id)).sort((a,b)=>a.id.localeCompare(b.id));
    const completedPlan=group.find(r=>r.is_completed&&isDuring(r.completed_at));
    const datedPlan=group.find(r=>s(r.plan_date)===date);
    if(!completedPlan&&!datedPlan&&!linked.length)continue;
    const main=completedPlan??datedPlan??group[0];
    // Todo/daily timestamps are server-maintained. A schedule status alone supplies no completion time.
    const completedCopy=linked.find(e=>e.status==='completed'&&isDuring(e.time));
    const status:NewspaperEntry['status']=completedCopy||completedPlan?'completed':datedPlan||linked.some(e=>e.status==='planned')?'planned':'recorded';
    const when=completedCopy?.time??completedPlan?.completed_at;
    const otherPlans=group.filter(r=>r!==main).map(r=>({source:'civil_plan_items',source_id:s(r.id),title:s(r.title),body:text(r.detail,r.subject_tag),date:s(r.plan_date),status:r.is_completed&&isDuring(r.completed_at)?'completed':'planned',...(r.completed_at?{time:s(r.completed_at)}:{})}));
    const bodies=[...otherPlans,...linked].map(e=>text(`同步记录：${e.title}${'time' in e&&e.time?` · ${e.time}`:''}`,e.body));
    entry('learning','civil_plan_items',main,s(main.title),text(main.detail,main.subject_tag,...bodies),status,when,main.plan_date,{linked_sources:[...otherPlans,...linked],...(when?{completion_source:{source:completedCopy?.source??'civil_plan_items',source_id:completedCopy?.source_id??s(completedPlan?.id),time:s(when)}}:{})});
    const consumed=new Set(linked.map(e=>e.id));sections[0].items=sections[0].items.filter(e=>!consumed.has(e.id));
  }
  for(const r of rows('civil_checkins'))if(s(r.date)===date)entry('learning','civil_checkins',r,'考公学习打卡',text(`学习 ${n(r.studied_minutes)} 分钟`,r.note),'recorded',undefined,r.date);
  for(const r of rows('civil_wrong_answers'))if(s(r.source_date)===date)entry('learning','civil_wrong_answers',r,s(r.title),text(r.content,r.options?`选项：${canonicalNewspaperJson(r.options)}`:'',r.correct_answer?`正确答案：${s(r.correct_answer)}`:'',r.user_answer?`作答：${s(r.user_answer)}`:'',r.wrong_reason?`错因：${s(r.wrong_reason)}`:'',r.knowledge_point?`知识点：${s(r.knowledge_point)}`:''),'recorded',undefined,r.source_date);
  for(const r of rows('civil_xingce_papers'))if(s(r.taken_date)===date)entry('learning','civil_xingce_papers',r,s(r.source)||'行测套卷',text(r.total_score!=null?`得分：${s(r.total_score)}`:'',r.duration_minutes!=null?`用时：${s(r.duration_minutes)} 分钟`:'',r.notes),'recorded',undefined,r.taken_date);
  for(const r of rows('thoughts'))if(isDuring(r.created_at))entry('thoughts','thoughts',r,s(r.title)||'一则想法',s(r.content),'recorded',r.created_at);
  const finance=rows('finance_records').filter(r=>s(r.date)===date),calories=rows('calorie_records').filter(r=>s(r.date)===date);
  for(const r of finance)entry('finance','finance_records',r,s(r.name),text(`${n(r.amount)} ${s(r.currency)||'CNY'} · ${s(r.category)}`,r.notes),'recorded',undefined,r.date);
  for(const r of calories)entry('health','calorie_records',r,s(r.food_name),text(`${r.meal_type==='exercise'?'运动消耗':'饮食摄入'}：${n(r.calories)} 千卡 · ${s(r.meal_type)}`,r.notes),'recorded',undefined,r.date);
  for(const r of rows('weight_records'))if(s(r.date)===date)entry('health','weight_records',r,'体重记录',text(`${n(r.weight)} kg`,r.notes),'recorded',undefined,r.date);
  const measures:Record<string,string>={waist:'腰围',hip:'臀围',chest:'胸围',arm:'臂围',thigh:'腿围'};
  for(const r of rows('measurement_records'))if(s(r.date)===date)entry('health','measurement_records',r,'身体围度',text(...Object.entries(measures).filter(([k])=>r[k]!=null).map(([k,v])=>`${v}：${s(r[k])} cm`),r.notes),'recorded',undefined,r.date);
  for(const section of sections)section.items.sort((a,b)=>(a.time??a.date??'').localeCompare(b.time??b.date??'')||a.id.localeCompare(b.id));
  const metrics:NewspaperSnapshot['metrics']=[{label:'完成待办',value:completed.size,unit:'项'},{label:'记录',value:sections.reduce((total,x)=>total+x.items.length,0),unit:'条'}];
  for(const currency of [...new Set(finance.map(r=>s(r.currency)||'CNY'))].sort())metrics.push({label:'支出',value:Math.round(finance.filter(r=>(s(r.currency)||'CNY')===currency).reduce((sum,r)=>sum+n(r.amount),0)*100)/100,unit:currency});
  if(calories.some(r=>r.meal_type!=='exercise'))metrics.push({label:'饮食热量',value:calories.filter(r=>r.meal_type!=='exercise').reduce((sum,r)=>sum+n(r.calories),0),unit:'千卡'});
  if(calories.some(r=>r.meal_type==='exercise'))metrics.push({label:'运动消耗',value:calories.filter(r=>r.meal_type==='exercise').reduce((sum,r)=>sum+n(r.calories),0),unit:'千卡'});
  const coverage=(input.coverage??Object.keys(sources).map(source=>({source,state:'ok' as const}))).slice().sort((a,b)=>a.source.localeCompare(b.source));
  const content={date,timezone,day_start_hour:dayStartHour,sections,metrics,coverage};
  return {...content,captured_at:input.capturedAt??new Date().toISOString(),source_fingerprint:newspaperFingerprint(content)};
}
export function exportNewspaperMarkdown(report:NewspaperReport,options:{includeSupplements?:boolean;includeReview?:boolean}={}):string {
  const lines=[`# 生活日报 · ${report.date}`,'',`状态：${report.status==='archived'?'已归档':report.status==='reconstructed'?'根据现存数据回构':'今日预览'} · 版本 ${report.revision}`,`时间口径：${report.snapshot.timezone}，每日 ${report.snapshot.day_start_hour}:00 起`,`快照采集时间：${report.snapshot.captured_at}`,''];
  for(const section of report.snapshot.sections){lines.push(`## ${section.title}`,'');if(!section.items.length)lines.push('本期无记录。','');for(const e of section.items)lines.push(`### ${e.title}`,'',`状态：${e.status==='completed'?'已完成':e.status==='planned'?'计划':'记录'}${e.time?` · 时间：${e.time}`:''}${e.date?` · 标记日期：${e.date}`:''}`,e.body,'',`来源：[${e.source} / ${e.source_id}](${e.source_url})`,'');}
  if(options.includeSupplements!==false&&report.supplements.length){lines.push('## 手动补记','');for(const item of report.supplements)lines.push(item.body,item.occurred_at?`发生时间：${item.occurred_at}`:'',`补记创建时间：${item.created_at} · 最后修改：${item.updated_at}`,'');}
  if(options.includeReview!==false&&report.review){lines.push('## AI 复盘','',`来源版本：${report.review.source_revision} · 生成时间：${report.review.generated_at}`,report.review_stale?'此复盘对应旧版本或补记已变更。':'',report.review.overview,'');for(const [key,title]of [['achievements','进展'],['difficulties','困难'],['observations','观察'],['suggestions','建议']]as const){lines.push(`### ${title}`,'',...report.review[key].map(v=>`- ${v}`),'');}}
  const images=report.assets;if(images.length)lines.push('## 图片说明','',...images.map(x=>`${x.active?'已选用':'历史候选'}：${x.caption||'（无图片说明）'}\n\n来源版本：${x.source_revision??'未记录'} · 模型：${x.options?.model??'未记录'} · 生成时间：${x.created_at??'未记录'}`),'');
  const failures=report.snapshot.coverage.filter(x=>x.state!=='ok');if(failures.length)lines.push('## 数据覆盖说明','',...failures.map(x=>`- ${x.source}：${x.message||'暂不可用'}`),'');
  return lines.join('\n');
}
