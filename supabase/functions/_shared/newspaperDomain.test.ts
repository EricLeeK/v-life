import { describe, expect, it } from 'vitest';
import { aggregateNewspaperSnapshot, reportDateAt, reportDayBounds, exportNewspaperMarkdown } from './newspaperDomain';
import type { NewspaperReport } from './newspaperTypes';
const input = { date: '2026-09-28', timezone: 'Asia/Shanghai', dayStartHour: 4, capturedAt: '2026-09-28T18:00:00Z' };
describe('newspaper calendar and source normalization', () => {
  it('uses local shifted days and real DST boundaries', () => {
    expect(reportDateAt(new Date('2026-09-27T19:59:59Z'), 'Asia/Shanghai', 4)).toBe('2026-09-27');
    expect(reportDateAt(new Date('2026-09-27T20:00:00Z'), 'Asia/Shanghai', 4)).toBe('2026-09-28');
    const spring = reportDayBounds('2026-03-08', 'America/New_York', 0);
    expect(Date.parse(spring.end) - Date.parse(spring.start)).toBe(23 * 3600000);
    const fall = reportDayBounds('2026-11-01', 'America/New_York', 0);
    expect(Date.parse(fall.end) - Date.parse(fall.start)).toBe(25 * 3600000);
  });
  it('counts linked completions once on actual completion date, keeping unfinished plans separate', () => {
    const s = aggregateNewspaperSnapshot({ ...input, sources: {
      todos: [{id:'t1',title:'跨日完成',is_completed:true,completed_at:'2026-09-27T20:00:00Z',detail:'全文'}, {id:'t2',title:'计划',is_completed:false}],
      daily_tasks: [{id:'d1',todo_id:'t1',task_date:'2026-09-27',is_completed:true,completed_at:'2026-09-27T20:00:00Z'}, {id:'d2',todo_id:'t2',task_date:input.date,is_completed:false}],
    }});
    const entries = s.sections.flatMap(x=>x.items);
    expect(entries.filter(x=>x.status==='completed')).toHaveLength(1);
    expect(entries.find(x=>x.title==='跨日完成')?.body).toContain('全文');
    expect(entries.find(x=>x.title==='计划')?.status).toBe('planned');
  });
  it('preserves tagged dates, full text, parents and separate currencies', () => {
    const s = aggregateNewspaperSnapshot({...input, sources: {
      learning_courses:[{id:'c',name:'课程'}],learning_notes:[{id:'n',course_id:'c',title:'笔记',note_date:input.date,content:'完整内容\n'.repeat(400)}],
      finance_records:[{id:'f1',date:input.date,name:'咖啡',amount:20,currency:'CNY'},{id:'f2',date:input.date,name:'订阅',amount:9,currency:'USD'}],
      calorie_records:[{id:'meal',date:input.date,food_name:'午餐',calories:650}],
    }});
    expect(s.sections.find(x=>x.id==='learning')?.items[0].body).toContain('完整内容\n'.repeat(400));
    expect(s.metrics).toEqual(expect.arrayContaining([{label:'支出',value:20,unit:'CNY'},{label:'支出',value:9,unit:'USD'}]));
    expect(s.sections.find(x=>x.id==='health')?.items[0].date).toBe(input.date);
  });
  it('fingerprints source content, independent of capture time and row ordering', () => {
    const sources={thoughts:[{id:'b',created_at:'2026-09-28T01:00:00Z',content:'B'},{id:'a',created_at:'2026-09-28T01:00:00Z',content:'A'}]};
    const a=aggregateNewspaperSnapshot({...input,sources});
    const b=aggregateNewspaperSnapshot({...input,capturedAt:'2026-09-29T01:00:00Z',sources:{thoughts:[...sources.thoughts].reverse()}});
    expect(a.source_fingerprint).toBe(b.source_fingerprint);
    expect(aggregateNewspaperSnapshot({...input,sources:{thoughts:[{...sources.thoughts[0],content:'edit'}]}}).source_fingerprint).not.toBe(a.source_fingerprint);
  });
  it('exports hidden and long entries and captions without expiring image links', () => {
    const snapshot=aggregateNewspaperSnapshot({...input,sources:{thoughts:[{id:'a',created_at:'2026-09-28T01:00:00Z',content:'全文'}]}});
    const report={date:input.date,revision:1,status:'archived',snapshot,hidden_sections:['thoughts'],supplements:[],review:null,assets:[{active:true,caption:'当天的画面',url:'https://private.test/signed?token=secret'}]} as unknown as NewspaperReport;
    const md=exportNewspaperMarkdown(report);
    expect(md).toContain('全文'); expect(md).toContain('当天的画面'); expect(md).not.toContain('token=secret');
  });
  it('separates exercise from intake and preserves newly created unscheduled work',()=>{
    const snapshot=aggregateNewspaperSnapshot({...input,sources:{
      todos:[{id:'new',title:'新想做的事',is_completed:false,created_at:'2026-09-28T01:00:00Z'},{id:'planned',title:'已安排',created_at:'2026-09-28T01:00:00Z'}],
      daily_tasks:[{id:'plan',todo_id:'planned',task_date:input.date,is_completed:false}],
      projects:[{id:'p',name:'项目'}],project_tasks:[{id:'pt',project_id:'p',title:'新任务',status:'todo',created_at:'2026-09-28T01:00:00Z'}],
      calorie_records:[{id:'m',date:input.date,food_name:'午餐',calories:600,meal_type:'lunch'},{id:'e',date:input.date,food_name:'运动',calories:200,meal_type:'exercise'}]
    }});
    expect(snapshot.metrics).toEqual(expect.arrayContaining([{label:'饮食热量',value:600,unit:'千卡'},{label:'运动消耗',value:200,unit:'千卡'}]));
    const work=snapshot.sections.find(x=>x.id==='chronicle')!.items;
    expect(work.find(x=>x.source_id==='new')?.status).toBe('recorded');
    expect(work.find(x=>x.source_id==='pt')?.status).toBe('recorded');
    expect(work.filter(x=>x.title==='已安排')).toHaveLength(1);
  });
  it('exports snapshot and generated-content version provenance',()=>{
    const snapshot=aggregateNewspaperSnapshot({...input,sources:{}});
    const report={date:input.date,revision:3,status:'archived',snapshot,supplements:[],review:{overview:'复盘',achievements:[],difficulties:[],observations:[],suggestions:[],source_revision:2,generated_at:'2026-09-28T12:00:00Z'},assets:[{active:true,caption:'图片',source_revision:1,options:{model:'test-model'}}]} as unknown as NewspaperReport;
    const md=exportNewspaperMarkdown(report);
    expect(md).toContain(input.capturedAt);expect(md).toContain('来源版本：2');expect(md).toContain('2026-09-28T12:00:00Z');expect(md).toContain('来源版本：1');expect(md).toContain('test-model');
  });

  it('merges synced civil plans with schedule and todo copies using actual completion evidence',()=>{
    const snapshot=aggregateNewspaperSnapshot({...input,sources:{
      civil_plan_items:[{id:'civil',title:'学习原计划',detail:'考公原文',plan_date:'2026-09-27',is_completed:false,synced_todo_id:'todo',synced_schedule_id:'schedule'}],
      todos:[{id:'todo',title:'同步待办标题',detail:'待办原文',is_completed:true,completed_at:'2026-09-28T01:00:00Z'}],
      daily_tasks:[{id:'daily',todo_id:'todo',task_date:'2026-09-27',is_completed:true,completed_at:'2026-09-28T01:00:00Z'}],
      schedule_events:[{id:'schedule',title:'同步日程标题',notes:'日程原文',start_time:'2026-09-28T00:00:00Z',end_time:'2026-09-28T02:00:00Z',status:'已完成'}],
    }});
    const entries=snapshot.sections.flatMap(x=>x.items);expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({source:'civil_plan_items',status:'completed',time:'2026-09-28T01:00:00Z'});for(const value of ['考公原文','待办原文','日程原文'])expect(entries[0].body).toContain(value);expect(entries[0].data?.linked_sources).toEqual(expect.arrayContaining([expect.objectContaining({source:'todos',source_id:'todo'}),expect.objectContaining({source:'schedule_events',source_id:'schedule'})]));
  });
  it('does not infer a civil completion time from the linked schedule status',()=>{
    const snapshot=aggregateNewspaperSnapshot({...input,sources:{civil_plan_items:[{id:'c',title:'计划',detail:'原文',plan_date:input.date,is_completed:false,synced_schedule_id:'s'}],schedule_events:[{id:'s',title:'同步日程',start_time:'2026-09-28T00:00:00Z',end_time:'2026-09-28T01:00:00Z',status:'已完成'}]}});
    const entries=snapshot.sections.flatMap(x=>x.items);expect(entries).toHaveLength(1);expect(entries[0].status).toBe('planned');
  });

});
