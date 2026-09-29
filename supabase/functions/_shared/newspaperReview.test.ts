import {describe,it,expect,vi} from 'vitest';
import {generateNewspaperReview,validateNewspaperReview} from './newspaperReview';
import type {NewspaperContext,NewspaperReport} from './newspaperTypes';
vi.stubGlobal('AbortSignal',{timeout:()=>new AbortController().signal});
const report={date:'2026-09-28',revision:2,snapshot:{source_fingerprint:'source',sections:[]},supplements:[]} as unknown as NewspaperReport;
const review={overview:'记录中的进展',achievements:['完成记录中的工作'],difficulties:[],observations:[],suggestions:['可以考虑休息']};
function setup(settingsError=false){
 const states=new Map<string,any>();
 const admin:any={from(table:string){const filters:Record<string,unknown>={};let update:Record<string,unknown>|undefined;const q:any={select(){return q},eq(key:string,value:unknown){filters[key]=value;return q},limit(){return q},maybeSingle(){return Promise.resolve({data:{},error:settingsError?{message:'settings unavailable'}:null})},update(value:Record<string,unknown>){update=value;return q},then(resolve:any){if(table==='newspaper_review_requests'&&update){const key=String(filters.request_key),state=states.get(key);if(state&&state.status===filters.status)states.set(key,{...state,...update});}return Promise.resolve({data:null,error:null}).then(resolve)}};return q;},async rpc(name:string,args:any){const key=args.p_key;if(name==='newspaper_claim_review'){const old=states.get(key);if(old)return {data:{claimed:false,...old},error:null};states.set(key,{status:'pending'});return {data:{claimed:true,status:'pending'},error:null};}states.set(key,{status:'succeeded',review:args.p_review});return {data:{applied:true,review:args.p_review},error:null};}};
 const ctx:NewspaperContext={db:admin,admin,userId:'u',permissions:{read:true,write:true,delete:false},idempotencyKey:'same-key'};return {ctx,admin,states};
}
const deps=()=>({resolveCredentials:vi.fn(async()=>({ok:true as const,creds:{mode:'byok' as const,apiKey:'test',model:'test',baseUrl:'https://provider.example/v1',platform:'custom'}})),fetch:vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(review)}}]}),{status:200,headers:{'Content-Type':'application/json'}})),recordUsage:vi.fn()});
describe('explicit newspaper AI review',()=>{
 it('deduplicates paid retries through durable claim and replay',async()=>{const {ctx}=setup(),d=deps();const first=await generateNewspaperReview(ctx,report,d);const second=await generateNewspaperReview(ctx,report,d);expect(first.overview).toBe(review.overview);expect(first.source_revision).toBe(2);expect(second).toEqual(first);expect(d.fetch).toHaveBeenCalledTimes(1);});
 it('rejects shape errors instead of accepting fabricated object fields',()=>{expect(()=>validateNewspaperReview({...review,achievements:[{made_up:true}]})).toThrow();});
 it('requires explicit idempotency before provider access',async()=>{const {ctx}=setup();delete ctx.idempotencyKey;const d=deps();await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'INVALID_INPUT'});expect(d.fetch).not.toHaveBeenCalled();});
 it('distinguishes a definitely failed replay from an unknown paid result',async()=>{const {ctx,admin}=setup();admin.rpc=async()=>({data:{claimed:false,status:'failed'},error:null});const d=deps();await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_FAILED'});expect(d.fetch).not.toHaveBeenCalled();});

 it('marks missing credentials as definite failure without submitting and allows an intentional new request',async()=>{
  const {ctx,states}=setup(),d=deps();d.resolveCredentials.mockResolvedValueOnce({ok:false,code:'AI_NOT_CONFIGURED',message:'请配置 AI',status:400} as any);
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'AI_NOT_CONFIGURED'});expect(d.fetch).not.toHaveBeenCalled();expect(states.get('same-key').status).toBe('failed');
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_FAILED'});expect(d.fetch).not.toHaveBeenCalled();
  const generated=await generateNewspaperReview({...ctx,idempotencyKey:'after-configuration'},report,d);expect(generated.overview).toBe(review.overview);expect(d.fetch).toHaveBeenCalledTimes(1);
 });
 it('marks settings lookup failure before submission as definite failure',async()=>{
  const {ctx,states}=setup(true),d=deps();await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'DATABASE_ERROR'});expect(d.resolveCredentials).not.toHaveBeenCalled();expect(d.fetch).not.toHaveBeenCalled();expect(states.get('same-key').status).toBe('failed');
 });
 it('validates the provider URL before recording an uncertain submission',async()=>{
  const {ctx,states}=setup(),d=deps();d.resolveCredentials.mockResolvedValueOnce({ok:true,creds:{mode:'byok',apiKey:'test',model:'test',baseUrl:'not a URL',platform:'custom'}});
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_FAILED'});expect(d.fetch).not.toHaveBeenCalled();expect(states.get('same-key').status).toBe('failed');
 });
 it('retains unknown after a submitted request loses its response and never resubmits the key',async()=>{
  const {ctx,states}=setup(),d=deps();d.fetch.mockRejectedValueOnce(new TypeError('network response lost'));
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_RESULT_UNCERTAIN'});expect(states.get('same-key').status).toBe('unknown');
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_RESULT_UNCERTAIN'});expect(d.fetch).toHaveBeenCalledTimes(1);
 });

 it('retains unknown when response headers arrived but the paid body is interrupted',async()=>{
  const {ctx,states}=setup(),d=deps();d.fetch.mockResolvedValueOnce({ok:true,json:async()=>{throw new DOMException('body timed out','AbortError')}} as Response);
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_RESULT_UNCERTAIN'});expect(states.get('same-key').status).toBe('unknown');
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_RESULT_UNCERTAIN'});expect(d.fetch).toHaveBeenCalledTimes(1);
 });
 it('retains the generated result and key when database completion is uncertain',async()=>{
  const {ctx,admin,states}=setup(),d=deps(),rpc=admin.rpc;admin.rpc=async(name:string,args:any)=>name==='newspaper_complete_review'?{data:null,error:{message:'database timeout'}}:rpc(name,args);
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_RESULT_UNCERTAIN'});expect(states.get('same-key')).toMatchObject({status:'unknown',review:{overview:review.overview}});
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_RESULT_UNCERTAIN'});expect(d.fetch).toHaveBeenCalledTimes(1);
 });
 it('returns a terminal stale result for completed generation that could not attach, including replay',async()=>{
  const {ctx,admin,states}=setup(),d=deps(),rpc=admin.rpc;admin.rpc=async(name:string,args:any)=>{const result=await rpc(name,args);return name==='newspaper_complete_review'?{...result,data:{...result.data,applied:false}}:result;};
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:'REVIEW_STALE'});expect(states.get('same-key')).toMatchObject({status:'succeeded',review:{overview:review.overview}});
  const current={...report,revision:3,snapshot:{...report.snapshot,source_fingerprint:'new-source'}};
  await expect(generateNewspaperReview(ctx,current,d)).rejects.toMatchObject({code:'REVIEW_STALE'});expect(d.fetch).toHaveBeenCalledTimes(1);
 });
 it.each(['http','invalid-model-content'])('keeps explicit %s failures terminal',async(kind)=>{
  const {ctx,states}=setup(),d=deps();d.fetch.mockResolvedValueOnce(kind==='http'?new Response('',{status:400}):new Response(JSON.stringify({choices:[{message:{content:'invalid JSON model content'}}]}),{status:200}));
  await expect(generateNewspaperReview(ctx,report,d)).rejects.toMatchObject({code:kind==='http'?'UPSTREAM_ERROR':'INVALID_AI_RESPONSE'});expect(states.get('same-key').status).toBe('failed');
 });

});
