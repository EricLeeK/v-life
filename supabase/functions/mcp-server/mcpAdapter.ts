import { MODULES, agentMetaOf, type ModuleDef } from '../_shared/moduleRegistry.ts';
export const MCP_VERSION='2.1.0';
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
export function buildCapabilities(){return {version:MCP_VERSION,contract:'vlife-agent-data',pagination:{limit:200,offset:true},limitations:['daily_task actions remain in the website'],modules:MODULES.filter(m=>agentMetaOf(m).agentVisible).map(m=>{
 const meta=agentMetaOf(m);return{key:m.key,label:m.labelZh,operations:{list:true,get:true,create:!!m.actions.create,update:!!m.actions.update,delete:!!m.actions.delete},readFields:meta.readFields,createFields:meta.createFields,updateFields:meta.updateFields,exportable:meta.exportable,dateField:m.executor?.dateField};
})};}
