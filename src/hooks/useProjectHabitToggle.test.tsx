import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useToggleHabitLog } from './useData';

const demo=vi.hoisted(()=>({isDemo:true, demoData:{habit_logs:[{id:'log',task_id:'habit',log_date:'2026-11-01'}]},addRecord:vi.fn(),deleteRecord:vi.fn()}));
vi.mock('@/contexts/DemoModeContext',()=>({useDemoMode:()=>demo}));
describe('project habit check-in',()=>{
  it('removes an existing demo check-in using the same store as the displayed logs',async()=>{
    const client=new QueryClient();
    const {result}=renderHook(()=>useToggleHabitLog(),{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
    await act(()=>result.current.mutateAsync({taskId:'habit',projectId:'project',logDate:'2026-11-01'}));
    expect(demo.deleteRecord).toHaveBeenCalledWith('habit_logs','log');
    expect(demo.addRecord).not.toHaveBeenCalled();
  });
});
