import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { projectProgress } from '@/components/projects/board-model';
import type { ProjectTask } from '@/components/projects/ProjectWorkCard';

export function useProjectBoardMove() {
  const qc=useQueryClient();
  const {isDemo,updateRecord}=useDemoMode();
  return useMutation({
    mutationFn:async ({projectId,id,status,order,next}:{projectId:string;id:string;status:string;order:string[];next:ProjectTask[]})=>{
      if(isDemo) {
        next.forEach(item=>updateRecord('project_tasks',item.id,{status:item.status,sort_order:item.sort_order}));
        updateRecord('projects',projectId,{progress:projectProgress(next)});
        return next;
      }
      const {data,error}=await supabase.rpc('move_project_board_item',{p_project_id:projectId,p_task_id:id,p_status:status,p_order:order});
      if(error)throw error;
      return data;
    },
    onSuccess:(data,{projectId})=>{qc.setQueryData(['project_tasks',projectId],data);},
    onSettled:async (_data,_error,{projectId})=>{
      await Promise.all([qc.invalidateQueries({queryKey:['project_tasks',projectId]}),qc.invalidateQueries({queryKey:['projects']})]);
    },
  });
}
