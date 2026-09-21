/** Generate the database mutation allowlist from the shared module registry. */
import { MODULES, agentMetaOf } from '../supabase/functions/_shared/moduleRegistry.ts';
export function contractSql() {
 return MODULES.filter(m=>agentMetaOf(m).agentVisible).map(m=>{
  const meta=agentMetaOf(m);const relation=m.executor?.resolves;
  const dbFields=(fields:string[])=>fields.map(f=>f===relation?.from?relation.toColumn:f);
  const c={table:m.table,actions:m.actions,ownsUserId:!['project_tasks','learning_notes'].includes(m.table),readColumns:meta.readFields,createColumns:dbFields(meta.createFields),updateColumns:dbFields(meta.updateFields)};
  if(m.key==='habit_log') c.createColumns=['todo_id','log_date','value','broken'];
  return `insert into agent_private.module_contracts(module,contract) values ('${m.key}','${JSON.stringify(c).replaceAll("'","''")}') on conflict(module) do update set contract=excluded.contract;`;
 }).join('\n');
}
if(import.meta.main) console.log(contractSql());
