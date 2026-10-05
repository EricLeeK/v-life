import { describe, expect, it, vi } from 'vitest';
import { createAgentDataService } from './agentDataService';

const sourceId = '11111111-1111-4111-8111-111111111111';
function fixture(permissions = {read:true, write:true, delete:true}, key: string | undefined = 'transfer-1') {
  const db = {rpc:vi.fn(async () => ({data:{data:{items:[], complete:true}, replayed:false}, error:null}))};
  const service = createAgentDataService({db:db as any,userId:'user',clientId:'client',requestId:'request',idempotencyKey:key,permissions}) as any;
  return {db, service};
}

describe('agent task workflows', () => {
  it('reads titled task context through a single server snapshot with relative dates', async () => {
    const {db,service} = fixture();
    expect(typeof service.taskOverview).toBe('function');
    await service.taskOverview({date:'tomorrow',lookback_days:3});
    expect(db.rpc).toHaveBeenCalledWith('daily_task_overview',{p_date:'tomorrow',p_lookback_days:3});
  });
  it('sends the entire selection to one transaction without resolving dates before replay', async () => {
    const {db,service} = fixture();
    expect(typeof service.transferDailyTasks).toBe('function');
    await service.transferDailyTasks({daily_task_ids:[sourceId],target_date:'tomorrow',mode:'move'});
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('daily_task_transfer',{
      p_daily_task_ids:[sourceId],p_target_date:'tomorrow',p_mode:'move',p_idempotency_key:'transfer-1',p_request_id:'request',
    });
  });
  it('requires an explicit mode, source IDs, and retry key before calling the database', async () => {
    const {db,service} = fixture();
    expect(typeof service.transferDailyTasks).toBe('function');
    for (const input of [
      {daily_task_ids:[sourceId]}, {daily_task_ids:[],mode:'move'},
      {daily_task_ids:[sourceId,sourceId],mode:'move'},
      {daily_task_ids:['todo title'],mode:'move'},
      {daily_task_ids:[sourceId],mode:'move',target_date:'2026-02-30'},
      {daily_task_ids:[sourceId],mode:'move',typo:true},
      {daily_task_ids:Array.from({length:201},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`),mode:'move'},
    ]) await expect(service.transferDailyTasks(input)).rejects.toMatchObject({code:'INVALID_INPUT'});
    const withoutKey = fixture();
    const noKey = createAgentDataService({db:withoutKey.db as any,userId:'u',clientId:'c',permissions:{read:true,write:true,delete:true}}) as any;
    await expect(noKey.transferDailyTasks({daily_task_ids:[sourceId],mode:'move'})).rejects.toMatchObject({code:'INVALID_INPUT'});
    expect(db.rpc).not.toHaveBeenCalled();
    expect(withoutKey.db.rpc).not.toHaveBeenCalled();
  });
  it('requires delete permission for move but only read and write for copy', async () => {
    const {db,service} = fixture({read:true,write:true,delete:false});
    expect(typeof service.transferDailyTasks).toBe('function');
    await expect(service.transferDailyTasks({daily_task_ids:[sourceId],mode:'move'})).rejects.toMatchObject({code:'PERMISSION_DENIED'});
    expect(db.rpc).not.toHaveBeenCalled();
    await service.transferDailyTasks({daily_task_ids:[sourceId],mode:'copy'});
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it('never turns RPC failure or malformed results into an empty task list', async () => {
    const {db,service} = fixture();
    expect(typeof service.taskOverview).toBe('function');
    db.rpc.mockResolvedValue({data:{error:{code:'RESULT_TOO_LARGE',message:'Narrow the date window'}} as any,error:null});
    await expect(service.taskOverview({})).rejects.toMatchObject({code:'RESULT_TOO_LARGE'});
    db.rpc.mockResolvedValue({data:null as any,error:null});
    await expect(service.taskOverview({})).rejects.toMatchObject({code:'DATABASE_ERROR'});
    db.rpc.mockResolvedValue({data:null as any,error:{message:'offline'} as any});
    await expect(service.taskOverview({})).rejects.toMatchObject({code:'DATABASE_ERROR'});
  });
  it('rejects invalid context options and missing read permission', async () => {
    const {db,service} = fixture();
    expect(typeof service.taskOverview).toBe('function');
    for (const input of [{date:'next week'},{lookback_days:31},{lookback_days:-1},{lookback_days:1.5},{offset:50}]) {
      await expect(service.taskOverview(input)).rejects.toMatchObject({code:'INVALID_INPUT'});
    }
    await expect(fixture({read:false,write:true,delete:true}).service.taskOverview({})).rejects.toMatchObject({code:'PERMISSION_DENIED'});
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
