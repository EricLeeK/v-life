import { MODULES, agentMetaOf, type ModuleDef } from '../_shared/moduleRegistry.ts';
import { AGENT_CONTRACT_VERSION, buildAgentCapabilities } from '../_shared/agentCapabilities.ts';
export const MCP_VERSION=AGENT_CONTRACT_VERSION;
export function fieldsSchema(mod:ModuleDef,operation:'create'|'update') {
 const meta=agentMetaOf(mod),allowed=operation==='create'?meta.createFields:meta.updateFields;
 const properties:Record<string,any>={};const required:string[]=[];
 for(const f of mod.fields.filter(f=>allowed.includes(f.name))){
  properties[f.name]={type:['date','datetime'].includes(f.type)?'string':f.type,description:f.description??f.name};
  if(f.type==='array')properties[f.name].items={};
  if(f.enum&&f.vocab!=='open')properties[f.name].enum=f.enum;
  if(operation==='create'&&f.required)required.push(f.name);
 }
 if(operation==='update'){properties.id={type:'string',format:'uuid'};required.push('id');}
 properties.idempotency_key={type:'string',minLength:1,maxLength:200,description:'Use the same key only to retry the same write operation.'};
 return {type:'object' as const,properties,required,additionalProperties:false};
}
export const buildCapabilities=buildAgentCapabilities;
