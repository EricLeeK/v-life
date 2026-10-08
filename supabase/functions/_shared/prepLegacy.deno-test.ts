import { legacyPrepMutate, legacyPrepRead } from './prepLegacy.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

function fixture() {
 const rows:any[]=[{id:'q',user_id:'u',stem_md:'Stem',question_type:'single',options:[{key:'A',content_md:'One'},{key:'B',content_md:'Two'}],correct_answer:['A'],tags:['xingce','logic','extra'],metadata:{legacy_title:'Old',source_date:'2026-10-01'},revision:1,status:'active',created_at:'2026-10-01T00:00:00Z'}];
 const states:any[]=[{question_id:'q',user_id:'u',paused:true}];
 const db={from(table:string){let source=table==='prep_review_states'?states:rows;let filters:((x:any)=>boolean)[]=[];let patch:any;let inserts:any;const q:any={select(){return q},eq(k:string,v:any){filters.push(x=>x[k]===v);return q},in(k:string,v:any[]){filters.push(x=>v.includes(x[k]));return q},order(){return q},range(){return q},contains(){return q},update(v:any){patch=v;return q},insert(v:any){inserts=v;return q},single(){return result(true)},maybeSingle(){return result(true)},then(a:any,b:any){return result(false).then(a,b)}};async function result(single:boolean){if(inserts){source.push({...inserts,revision:1,created_at:'2026-10-01T00:00:00Z',tags:inserts.tags||[]});return {data:source.at(-1),error:null}}const selected=source.filter(x=>filters.every(f=>f(x)));if(patch)selected.forEach(x=>Object.assign(x,patch));return {data:single?selected[0]:selected,error:null}}return q},async rpc(_name:string,args:any){const row=rows.find(r=>r.id===args.p_question_id);const {legacy_metadata,...patch}=args.p_patch;Object.assign(row,patch);if(legacy_metadata)row.metadata={...row.metadata,...legacy_metadata};row.revision++;return {data:row,error:null}}};
 return {ctx:{db,userId:'u'},rows,states};
}
Deno.test('legacy choice AB creates a usable multiple question',async()=>{
 const {ctx}=fixture();const result=await legacyPrepMutate(ctx,'civil_wrong','create',null,{title:'Multi',subject_group:'xingce',question_type:'choice',options:[{key:'A',text:'One'},{key:'B',text:'Two'}],correct_answer:'AB'});
 assertEquals(result.data.correct_answer,'A,B');
 const list=await ctx.db.from('prep_questions').select('*');assertEquals(list.data.at(-1).question_type,'multiple');
});
Deno.test('legacy fields and tags survive an update without silent loss',async()=>{
 const {ctx,rows}=fixture();const result=await legacyPrepMutate(ctx,'civil_wrong','update','q',{title:'Renamed',user_answer:'B',image_required:true,subject_tag:'data'});
 assertEquals(result.data.title,'Renamed');assertEquals(result.data.user_answer,'B');assertEquals(result.data.image_required,true);assertEquals(rows[0].tags,['xingce','extra','data']);
});
Deno.test('legacy read and pause response reflect authoritative review state',async()=>{
 const {ctx}=fixture();assertEquals((await legacyPrepRead(ctx,'civil_wrong',{},'q')).data.review_status,'mastered');
 assertEquals((await legacyPrepMutate(ctx,'civil_wrong','update','q',{review_status:'pending'})).data.review_status,'pending');
 assertEquals((await legacyPrepMutate(ctx,'civil_wrong','update','q',{review_status:'mastered'})).data.review_status,'mastered');
});
