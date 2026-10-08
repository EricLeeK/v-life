/** Compatibility boundary: old civil names read/write the new authoritative records. */
const tables:Record<string,string>={civil_exam:'prep_exams',civil_wrong:'prep_questions',civil_xingce_paper:'prep_papers'};
const parts=['verbal','data','graphic','logic','analogy','quantity','common'];
const names=['言语理解','资料分析','图形推理','逻辑判断','定义类比','数量关系','时政常识'];
export const isLegacyPrep=(key:string)=>Object.prototype.hasOwnProperty.call(tables,key);
function fromPrep(key:string,row:any){
 if(key==='civil_exam')return {...row,exam_type:row.template==='civil'?'自定义':'自定义'};
 if(key==='civil_wrong')return {id:row.id,title:row.metadata?.legacy_title||row.stem_md.slice(0,80),content:row.stem_md,subject_group:row.tags.find((s:string)=>['xingce','shenlun','mianshi'].includes(s))||'xingce',subject_tag:row.tags.find((s:string)=>!['xingce','shenlun','mianshi'].includes(s))||null,wrong_reason:row.analysis_md,knowledge_point:row.explanation_md,question_type:row.question_type==='single'||row.question_type==='multiple'?'choice':row.question_type,options:row.options.map((o:any)=>({key:o.key,text:o.content_md})),correct_answer:Array.isArray(row.correct_answer)?row.correct_answer.join(','):row.correct_answer,user_answer:row.metadata?.legacy_user_answer??null,image_required:row.metadata?.legacy_image_required??false,source_date:row.metadata?.source_date||row.created_at.slice(0,10),created_at:row.created_at,updated_at:row.updated_at,review_status:row.review_state?.paused?'mastered':'pending',revision:row.revision};
 const scores:any={};parts.forEach((p,i)=>{const s=row.sections.find((s:any)=>s.key===p||s.name===names[i]);scores[`${p}_total`]=s?.total||0;scores[`${p}_correct`]=s?.correct||0;});return {...row,...scores,beat_rate:row.metadata?.beat_rate};
}
function selections(answer:unknown,options:any[]):string[]{
 const value=String(answer??'').trim();if(!value)return [];
 const keys=options.map(o=>o.key);if(keys.includes(value))return [value];
 const values=value.split(/[,，、;；\s/]+/).filter(Boolean);
 return values.length===1&&value.length>1&&[...value].every(k=>keys.includes(k))?[...value]:values;
}
async function withReviewStates(ctx:any,key:string,rows:any[]){
 if(key!=='civil_wrong'||!rows.length)return rows;
 const {data,error}=await ctx.db.from('prep_review_states').select('question_id,paused').eq('user_id',ctx.userId).in('question_id',rows.map(r=>r.id));if(error)throw new Error(error.message);
 return rows.map(row=>({...row,review_state:data.find((state:any)=>state.question_id===row.id)}));
}
function toPrep(key:string,input:any,current?:any){
 if(key==='civil_exam'){const record:any={};for(const k of ['name','exam_date','is_primary','is_archived','notes'])if(k in input)record[k]=input[k];if(!current)record.template='civil';return record;}
 if(key==='civil_wrong'){
  const record:any={};const maps={content:'stem_md',wrong_reason:'analysis_md',knowledge_point:'explanation_md'};for(const [a,b] of Object.entries(maps))if(a in input)record[b]=input[a];
  if(!current&&!record.stem_md)record.stem_md=input.title||'';
  if('options' in input)record.options=input.options.map((o:any)=>({key:o.key,content_md:o.text||''}));
  const requestedType=input.question_type||current?.question_type||'text';
  const answer='correct_answer' in input?input.correct_answer:current?.correct_answer;
  const selected=Array.isArray(answer)?answer:selections(answer,record.options||current?.options||[]);
  if('question_type' in input||(!current))record.question_type=requestedType==='choice'?(selected.length>1?'multiple':'single'):requestedType;
  if('correct_answer' in input){record.correct_answer=requestedType==='text'?answer:selected;if(requestedType!=='text'&&requestedType!=='judgement')record.question_type=selected.length>1?'multiple':'single';}
  if('subject_group' in input||'subject_tag' in input){const groups=['xingce','shenlun','mianshi'];const oldTags=current?.tags||[];const oldSubject=oldTags.find((s:string)=>!groups.includes(s));record.tags=oldTags.filter((s:string)=>!('subject_group' in input&&groups.includes(s))&&!('subject_tag' in input&&s===oldSubject));if('subject_group' in input)record.tags.unshift(input.subject_group);else if(!current)record.tags.unshift('xingce');if(input.subject_tag)record.tags.push(input.subject_tag);record.tags=[...new Set(record.tags)];}
  const metadata:any={};for(const [field,target] of Object.entries({title:'legacy_title',user_answer:'legacy_user_answer',image_required:'legacy_image_required',source_date:'source_date'}))if(field in input)metadata[target]=input[field];
  if(!current){record.status=input.correct_answer?'active':'draft';record.metadata=metadata;}else if(Object.keys(metadata).length)record.legacy_metadata=metadata;
  return record;
 }
 const record:any={};for(const k of ['taken_date','source','is_mock','duration_minutes','total_score','notes'])if(k in input)record[k]=input[k];if('source' in input)record.name=input.source;
 record.sections=parts.map((key,i)=>{const old=current?.sections?.find((s:any)=>s.key===key);return {key,name:names[i],total:input[`${key}_total`]??old?.total??0,correct:input[`${key}_correct`]??old?.correct??0};});
 return record;
}
export async function legacyPrepRead(ctx:any,key:string,opts:any={},id?:string,search?:string){
 const limit=opts.limit??50,offset=opts.offset??0;if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0)throw new Error('Invalid pagination');
 let query=ctx.db.from(tables[key]).select('*').eq('user_id',ctx.userId);if(id)query=query.eq('id',id);if(search)query=query.ilike(key==='civil_wrong'?'stem_md':key==='civil_exam'?'name':'source',`%${search.replace(/[\\%_]/g,'\\$&')}%`);
 if(key==='civil_wrong'&&opts.filters?.subject_group)query=query.contains('tags',[opts.filters.subject_group]);
 if(key==='civil_exam'&&opts.filters?.is_archived!==undefined)query=query.eq('is_archived',opts.filters.is_archived);
 const {data,error}=id?await query.maybeSingle():await query.order('id').range(offset,offset+limit);if(error)throw new Error(error.message);if(id){if(!data)throw new Error('Record not found');return {data:fromPrep(key,(await withReviewStates(ctx,key,[data]))[0])};}
 return {data:(await withReviewStates(ctx,key,data.slice(0,limit))).map((r:any)=>fromPrep(key,r)),hasMore:data.length>limit,nextOffset:data.length>limit?offset+limit:null};
}
export async function legacyPrepMutate(ctx:any,key:string,operation:string,id:string|null,input:any){
 let current:any=null;
 if(id){const r=await ctx.db.from(tables[key]).select('*').eq('id',id).eq('user_id',ctx.userId).single();if(r.error)throw new Error(r.error.message);current=r.data;}
 if(operation==='delete'){const r=key==='civil_wrong'?await ctx.db.rpc('prep_edit_question',{p_question_id:id,p_expected_revision:current.revision,p_patch:{status:'archived'}}):key==='civil_exam'?await ctx.db.from(tables[key]).update({is_archived:true}).eq('id',id).eq('user_id',ctx.userId).select().single():await ctx.db.from(tables[key]).delete().eq('id',id).eq('user_id',ctx.userId).select().single();if(r.error)throw new Error(r.error.message);return {data:fromPrep(key,current)};}
 const record=toPrep(key,input,current);let result;
 if(operation==='create'){
  let newId=crypto.randomUUID();if(ctx.idempotencyKey){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${ctx.userId}:${ctx.clientId}:${key}:${ctx.idempotencyKey}`));const h=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');newId=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;const existing=await ctx.db.from(tables[key]).select('*').eq('id',newId).eq('user_id',ctx.userId).maybeSingle();if(existing.error)throw new Error(existing.error.message);if(existing.data)result=existing;}
  if(!result)result=await ctx.db.from(tables[key]).insert({...record,id:newId,user_id:ctx.userId}).select().single();
 }else if(key==='civil_wrong')result=await ctx.db.rpc('prep_edit_question',{p_question_id:id,p_expected_revision:current.revision,p_patch:record});
 else result=await ctx.db.from(tables[key]).update(record).eq('id',id).eq('user_id',ctx.userId).select().single();
 if(result.error)throw new Error(result.error.message);
 if(key==='civil_wrong'&&input.review_status){const pause=await ctx.db.from('prep_review_states').update({paused:input.review_status==='mastered'}).eq('question_id',result.data.id);if(pause.error)throw new Error(pause.error.message);}
 return {data:fromPrep(key,(await withReviewStates(ctx,key,[result.data]))[0])};
}
