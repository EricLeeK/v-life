import {describe,it,expect,vi} from 'vitest';
vi.mock('./newspaperReview.ts',()=>({generateNewspaperReview:vi.fn()}));
import {generateNewspaperReview} from './newspaperReview';
vi.mock('./newspaperImageService.ts',()=>({decorateNewspaperImages:async()=>({assets:[],jobs:[]})}));
import {archiveNewspapers,createNewspaperService,loadNewspaperSources} from './newspaperService';
const date='2026-09-28';
function database(tables:Record<string,any[]>={},failTable='') {
  const calls:any[]=[];
  return {calls,rpc:async(name:string,args:any)=>{calls.push({table:`rpc:${name}`,args});return {data:true,error:null};},from(table:string){let offset=0,end=999;const filters:Array<[string,string,unknown]>=[];let single=false;let mutation='';let payload:any;
    const q:any={select(){return q;},eq(k:string,v:unknown){filters.push(['eq',k,v]);return q;},in(k:string,v:unknown){filters.push(['in',k,v]);return q;},gte(){return q;},lt(){return q;},lte(){return q;},or(){return q;},ilike(){return q;},order(){return q;},limit(n:number){end=n-1;return q;},range(a:number,b:number){offset=a;end=b;return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},insert(){mutation='insert';return q;},update(value:any){mutation='update';payload=value;return q;},upsert(){mutation='upsert';return q;},delete(){mutation='delete';return q;},then(resolve:any){calls.push({table,filters,offset,end,mutation,payload});if(table===failTable)return Promise.resolve({data:null,error:{message:'private upstream failure'}}).then(resolve);let rows=(tables[table]??[]).filter(r=>filters.every(([op,k,v])=>op==='in'?(v as any[]).includes(r[k]):r[k]===v));rows=rows.slice(offset,end+1);return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);}};return q;}};
}
const ctx=(db:any,permissions={read:true,write:true,delete:true})=>({db,userId:'u',permissions,now:()=>new Date('2026-09-28T10:00:00Z')});
describe('newspaper service authorization and persistence boundaries',()=>{
  it('refuses unauthorized actions before any database access',async()=>{const db=database();await expect(createNewspaperService(ctx(db,{read:true,write:false,delete:false})).execute('refresh',{date})).rejects.toMatchObject({code:'PERMISSION_DENIED'});expect(db.calls).toHaveLength(0);});
  it('get returns an ephemeral snapshot without inserting anything',async()=>{const db=database({settings:[{user_id:'u',timezone:'Asia/Shanghai',day_start_hour:4}]});const report:any=await createNewspaperService(ctx(db)).execute('get',{date});expect(report.status).toBe('draft');expect(report.revision).toBe(0);expect(db.calls.every(x=>!x.mutation)).toBe(true);});
  it('paginates all rows and scopes child records to owned parent ids',async()=>{const db=database({thoughts:Array.from({length:1205},(_,i)=>({id:String(i),user_id:'u',content:'full',created_at:'2026-09-28T01:00:00Z'})),projects:[{id:'p',user_id:'u'}],project_tasks:[{id:'task',project_id:'p'},{id:'foreign',project_id:'other'}],habit_logs:[{id:'h',task_id:'task',log_date:date},{id:'bad',task_id:'foreign',log_date:date}]});const result=await loadNewspaperSources(ctx(db),date,{enabled:false,enabled_from:null,timezone:'Asia/Shanghai',day_start_hour:4});expect(result.sources.thoughts).toHaveLength(1205);expect(result.sources.habit_logs.map(x=>x.id)).toEqual(['h']);expect(db.calls.some(x=>x.table==='thoughts'&&x.offset===1000)).toBe(true);});
  it('exposes source coverage failure and does not leak upstream diagnostics',async()=>{const db=database({},'thoughts');const result=await loadNewspaperSources(ctx(db),date,{enabled:false,enabled_from:null,timezone:'UTC',day_start_hour:0});expect(result.coverage.find(x=>x.source==='thoughts')).toEqual({source:'thoughts',state:'unavailable',message:'此来源暂时无法读取'});});
  it('requires an expected timestamp before editing supplements',async()=>{const db=database();await expect(createNewspaperService(ctx(db)).execute('supplement_save',{date,id:'s',body:'edit'})).rejects.toMatchObject({code:'CONFLICT'});expect(db.calls.every(x=>!x.mutation)).toBe(true);});
  it('rechecks current authorization before using an authorized server context',async()=>{const db=database();db.rpc=async()=>({data:false,error:null});await expect(createNewspaperService({...ctx(db),admin:db}).execute('get',{date})).rejects.toMatchObject({code:'PERMISSION_DENIED'});expect(db.calls).toHaveLength(0);});

  it('keeps archived text readable when the source has been deleted',async()=>{
    const entry={id:'thoughts:deleted',source:'thoughts',source_id:'deleted',source_url:'/thoughts?record=deleted',title:'旧想法',body:'保留全文',status:'recorded'};
    const snapshot={date:'2026-09-27',timezone:'Asia/Shanghai',day_start_hour:4,captured_at:'2026-09-27T16:00:00Z',sections:[{id:'thoughts',title:'想法',items:[entry]}],metrics:[],coverage:[],source_fingerprint:'old'};
    const db=database({newspaper_reports:[{id:'r',user_id:'u',report_date:'2026-09-27',timezone:'Asia/Shanghai',day_start_hour:4,current_revision:1,status:'archived',snapshot}]});
    const service=createNewspaperService(ctx(db));const report:any=await service.execute('get',{date:'2026-09-27'});
    expect(report.snapshot).toEqual(snapshot);expect(report.source_changed).toBe(true);
    expect(await service.execute('source_get',{date:'2026-09-27',source:'thoughts',source_id:'deleted'})).toEqual({available:false,snapshot:entry});expect(db.calls.every(x=>!x.mutation)).toBe(true);
  });
  it('archives empty enabled days, advances through existing history and bounds backlog work',async()=>{
    const db=database({newspaper_preferences:[{user_id:'u',enabled:true,enabled_from:'2026-09-25',timezone:'Asia/Shanghai',day_start_hour:4,last_archived_date:null}],newspaper_reports:[{user_id:'u',report_date:'2026-09-26',status:'archived',snapshot:{source_fingerprint:'keep'}}]});
    const result=await archiveNewspapers(db,{now:new Date('2026-09-28T10:00:00Z'),maxUsers:1,daysPerUser:2});
    expect(result).toEqual({users:1,archived:1,failures:0});const saves=db.calls.filter(x=>x.table==='rpc:newspaper_save_snapshot');expect(saves).toHaveLength(1);expect(saves[0].args.p_date).toBe('2026-09-25');expect(saves[0].args.p_only_if_missing).toBe(true);expect(saves[0].args.p_snapshot.metrics.find((m:any)=>m.label==='记录').value).toBe(0);
    expect(db.calls.filter(x=>x.payload?.last_archived_date).map(x=>x.payload.last_archived_date)).toEqual(['2026-09-25','2026-09-26']);
  });

  it('does not call an unavailable source check a content change',async()=>{
    const snapshot={date:'2026-09-27',timezone:'UTC',day_start_hour:0,captured_at:'2026-09-27T20:00:00Z',sections:[],metrics:[],coverage:[],source_fingerprint:'old'};
    const db=database({newspaper_reports:[{id:'r',user_id:'u',report_date:'2026-09-27',timezone:'UTC',day_start_hour:0,current_revision:1,status:'archived',snapshot}]},'thoughts');
    const report:any=await createNewspaperService(ctx(db)).execute('get',{date:'2026-09-27'});expect(report.source_changed).toBe(false);expect(report.source_check_unavailable).toBe(true);expect(report.snapshot).toEqual(snapshot);
  });

  it.each(['archived','reconstructed'])('refresh preserves existing %s provenance',async(status)=>{
    const snapshot={date:'2026-09-27',timezone:'UTC',day_start_hour:0,captured_at:'2026-09-27T20:00:00Z',sections:[],metrics:[],coverage:[],source_fingerprint:'old'};
    const db=database({newspaper_reports:[{id:'r',user_id:'u',report_date:'2026-09-27',timezone:'UTC',day_start_hour:0,current_revision:1,status,snapshot}]});await createNewspaperService({...ctx(db),admin:db}).execute('refresh',{date:'2026-09-27'});expect(db.calls.find(x=>x.table==='rpc:newspaper_save_snapshot').args.p_status).toBe(status);
  });
  it('uses a tenant-scoped complete search before applying pagination',async()=>{
    const db=database();const original=db.rpc;db.rpc=async(name,args)=>name==='newspaper_search_reports'?(db.calls.push({table:`rpc:${name}`,args}),{data:[1,2].map(id=>({id:String(id),report_date:`2026-09-${29-id}`,status:'archived',current_revision:1,snapshot:{sections:[]}})),error:null}) as any:original(name,args);
    const result:any=await createNewspaperService(ctx(db)).execute('list',{q:'补记里的词',date_from:'2026-09-01',limit:1,offset:0});expect(result.items).toHaveLength(1);expect(result.hasMore).toBe(true);expect(result.nextOffset).toBe(1);expect(db.calls.find(x=>x.table==='rpc:newspaper_search_reports')?.args).toEqual({p_query:'补记里的词',p_date_from:'2026-09-01',p_date_to:null,p_limit:1,p_offset:0});
  });
  it('first supplement creates a snapshot through the same service used by agents',async()=>{
    const tables:Record<string,any[]>={};const db=database(tables);const original=db.rpc;db.rpc=async(name,args)=>{const result=await original(name,args);if(name==='newspaper_save_snapshot'){tables.newspaper_reports=[{id:'new-report',user_id:'u',report_date:date,timezone:args.p_snapshot.timezone,day_start_hour:args.p_snapshot.day_start_hour,current_revision:1,status:args.p_status,snapshot:args.p_snapshot}];tables.newspaper_supplements=[{id:'s',user_id:'u',report_date:date,body:'首次补记'}];}return result;};
    const result=await createNewspaperService({...ctx(db),admin:db}).execute('supplement_save',{date,body:'首次补记'});expect(result.body).toBe('首次补记');expect(db.calls.filter(x=>x.table==='rpc:newspaper_save_snapshot')).toHaveLength(1);
  });

  it.each([
    {enabled:true,enabledFrom:'2026-09-26',expected:'archived'},
    {enabled:true,enabledFrom:'2026-09-28',expected:'reconstructed'},
    {enabled:false,enabledFrom:'2026-09-26',expected:'reconstructed'},
  ])('classifies a first historical write by its enabled archive window: $enabled/$enabledFrom',async({enabled,enabledFrom,expected})=>{
    const prefs:Record<string,any>={user_id:'u',enabled,enabled_from:enabledFrom,timezone:'Asia/Shanghai',day_start_hour:4};
    const tables:Record<string,any[]>={newspaper_preferences:[prefs]};const db=database(tables),original=db.rpc;
    db.rpc=async(name,args)=>{const result=await original(name,args);if(name==='newspaper_save_snapshot'){tables.newspaper_reports=[{id:'first-past',user_id:'u',report_date:args.p_date,timezone:args.p_snapshot.timezone,day_start_hour:args.p_snapshot.day_start_hour,current_revision:1,status:args.p_status,snapshot:args.p_snapshot}];tables.newspaper_supplements=[{id:'supplement',user_id:'u',report_date:args.p_date,body:'日终补记'}];}return result;};
    await createNewspaperService({...ctx(db),admin:db}).execute('supplement_save',{date:'2026-09-27',body:'日终补记'});
    expect(tables.newspaper_reports[0].status).toBe(expected);
    if(enabled&&expected==='archived'){
      prefs.last_archived_date='2026-09-26';
      const result=await archiveNewspapers(db,{now:new Date('2026-09-28T10:00:00Z'),maxUsers:1,daysPerUser:1});
      expect(result.archived).toBe(0);expect(db.calls.filter(x=>x.table==='rpc:newspaper_save_snapshot')).toHaveLength(1);
    }
  });

  it('does not return an empty current review as a completed paid replay',async()=>{
    const snapshot={date:'2026-09-27',timezone:'UTC',day_start_hour:0,captured_at:'2026-09-27T20:00:00Z',sections:[],metrics:[],coverage:[],source_fingerprint:'current'};
    const db=database({newspaper_reports:[{id:'r',user_id:'u',report_date:'2026-09-27',timezone:'UTC',day_start_hour:0,current_revision:2,status:'archived',snapshot,review:null}]});
    vi.mocked(generateNewspaperReview).mockResolvedValueOnce({source_revision:1,source_fingerprint:'old'} as any);
    await expect(createNewspaperService({...ctx(db),admin:db,idempotencyKey:'replay'}).execute('review_generate',{date:'2026-09-27'})).rejects.toMatchObject({code:'REVIEW_STALE'});
  });

});
