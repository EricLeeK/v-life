import type { ReactNode } from 'react';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useAddToToday, useCompleteDailyTask } from './useData';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/DemoModeContext', () => ({useDemoMode: () => ({isDemo:false})}));
vi.mock('@/integrations/supabase/client', () => ({supabase:{rpc,from:()=>({select:async()=>({data:[{id:'settings',day_start_hour:4}],error:null})})}}));
afterEach(()=>{cleanup();vi.useRealTimers();rpc.mockReset();});
function mount<T>(hook:()=>T) {
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 const result=renderHook(hook,{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
 return {...result,client};
}
it('adds through the atomic RPC using the configured local day boundary',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,8,24,2));
 rpc.mockResolvedValue({data:{data:{id:'daily'}},error:null});
 const {result,client}=mount(()=>useAddToToday());
 await waitFor(()=>expect(client.getQueryData(['settings'])).toBeDefined());
 await act(async()=>{await result.current.mutateAsync({todo_id:'todo',difficulty:'medium',base_points:20});});
 expect(rpc).toHaveBeenCalledWith('daily_task_mutate',{p_operation:'create',p_payload:{todo_id:'todo',difficulty:'medium',base_points:20,task_date:'2026-09-23'}});
 client.clear();
});
it('completes through the RPC and invalidates both lists',async()=>{
 rpc.mockResolvedValue({data:{data:{id:'daily',is_completed:true}},error:null});
 const {result,client}=mount(()=>useCompleteDailyTask());
 const invalidate=vi.spyOn(client,'invalidateQueries');
 await act(async()=>{await result.current.mutateAsync({id:'daily',is_completed:true});});
 expect(rpc).toHaveBeenCalledWith('daily_task_mutate',{p_operation:'update',p_record_id:'daily',p_payload:{is_completed:true}});
 expect(invalidate).toHaveBeenCalledWith({queryKey:['daily_tasks']});
 expect(invalidate).toHaveBeenCalledWith({queryKey:['todos']});
 client.clear();
});
it('rolls back the checkbox when the atomic completion fails',async()=>{
 rpc.mockResolvedValue({data:null,error:new Error('write failed')});
 const {result,client}=mount(()=>useCompleteDailyTask());
 client.setQueryData(['daily_tasks','today'],[{id:'daily',is_completed:false}]);
 await act(async()=>{await expect(result.current.mutateAsync({id:'daily',is_completed:true})).rejects.toThrow('write failed');});
 expect(client.getQueryData(['daily_tasks','today'])).toEqual([{id:'daily',is_completed:false}]);
 client.clear();
});
