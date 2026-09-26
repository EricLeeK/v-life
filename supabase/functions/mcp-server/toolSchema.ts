import { AgentDataError } from '../_shared/agentDataService.ts';
import { agentMetaOf, type ModuleDef, type FieldDef } from '../_shared/moduleRegistry.ts';
import { fieldDescription } from '../_shared/agentGuide.ts';
export type Schema=Record<string,any>;
export const objectSchema=(properties:Record<string,Schema>,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
export const idempotencySchema={type:'string',minLength:1,maxLength:200,description:'每个新写操作使用一个新唯一键；重试同一操作时必须沿用原键和完全相同的参数。不要把示例占位符原样发送。'};
export const recordIdSchema=(module:string)=>({type:'string',format:'uuid',description:`${module}.id，从 ${module}_list/get/create 返回值获取；不能使用其他模块的 ID。`});
export function schemaForField(f:FieldDef):Schema {
 const type=f.integer?'integer':['date','datetime'].includes(f.type)?'string':f.type;
 const s:Schema={type:f.nullable?[type,'null']:type,description:fieldDescription(f)};
 if(f.exclusiveMinimum!==undefined)s.exclusiveMinimum=f.exclusiveMinimum;
 if(f.minimum!==undefined)s.minimum=f.minimum;
 if(f.maximum!==undefined)s.maximum=f.maximum;
 if(f.type==='date')s.format='date';
 if(f.type==='datetime')s.format='date-time';
 if(f.name.endsWith('_id'))s.format='uuid';
 if(f.type==='array')s.items=f.promptType==='string[]'?{type:'string'}:{};
 if(f.enum&&f.vocab!=='open')s.enum=[...f.enum,...Object.keys(f.aliases??{})];
 if(f.required&&f.type==='string')s.minLength=1;
 return s;
}
export function paginationSchema(mod?:ModuleDef) {
 return {
  limit:{type:'integer',minimum:1,maximum:200,default:50,description:'每页数量，默认50，最大200；返回 hasMore/nextOffset 后继续分页。'},
  offset:{type:'integer',minimum:0,default:0,description:'偏移量，首次0；下一页使用上次返回的 nextOffset。'},
  ...(mod?.executor?.dateField?{
   date_from:{type:'string',format:'date',description:`${mod.executor.dateField} 的起始日期（含当日）；省略表示不限制下界。`},
   date_to:{type:'string',format:'date',description:`${mod.executor.dateField} 的结束日期（含整天）；省略表示不限制上界。`},
  }:{}),
 };
}
export function listSchema(mod:ModuleDef) {
 const properties:Record<string,Schema>={...paginationSchema(mod)};
 for(const name of agentMetaOf(mod).readFields){
  const field=mod.fields.find(f=>f.name===name);
  if(field)properties[name]={...schemaForField(field),description:`精确相等筛选：${fieldDescription(field)}`};
  else properties[name]={type:name.endsWith('_id')?'string':['base_points','amount_cny','exchange_rate'].includes(name)?'number':'string',...(name.endsWith('_id')?{format:'uuid'}:{}),description:`按返回记录中的 ${name} 精确相等筛选。`};
 }
 return objectSchema(properties);
}
/** Validate precisely the JSON Schema subset emitted by this adapter. No coercion. */
export function validateToolInput(schema:Schema,input:unknown,path='arguments'):asserts input is Record<string,any> {
 const invalid=(why:string):never=>{throw new AgentDataError('INVALID_INPUT',`${path}: ${why}`);};
 if(Array.isArray(schema.type)) {
  if(input===null&&schema.type.includes('null'))return;
  return validateToolInput({...schema,type:schema.type.find((type:string)=>type!=='null')},input,path);
 }
 if(schema.type==='object'){
  if(input===null||typeof input!=='object'||Array.isArray(input))invalid('must be a JSON object');
  const obj=input as Record<string,unknown>;
  for(const key of schema.required??[])if(obj[key]===undefined)invalid(`missing required field ${key}`);
  for(const [key,value] of Object.entries(obj)){
   if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties??{},key))invalid(`unknown field ${key}`);
   if(schema.properties?.[key])validateToolInput(schema.properties[key],value,`${path}.${key}`);
  }
  if(schema.anyOf&&!schema.anyOf.some((variant:Schema)=>(variant.required??[]).every((key:string)=>obj[key]!==undefined)))invalid(`provide ${schema.anyOf.map((v:Schema)=>v.required.join(' + ')).join(' OR ')}`);
 }else if(schema.type==='array'){
  if(!Array.isArray(input))invalid('must be an array');
  for(const [index,value] of (input as unknown[]).entries())validateToolInput(schema.items??{},value,`${path}[${index}]`);
 }else if(schema.type==='number'||schema.type==='integer'){
  if(typeof input!=='number'||!Number.isFinite(input)||(schema.type==='integer'&&!Number.isInteger(input)))invalid(`must be a finite ${schema.type}`);
  if(schema.exclusiveMinimum!==undefined&&(input as number)<=schema.exclusiveMinimum)invalid(`must be greater than ${schema.exclusiveMinimum}. ${schema.description??''}`);
  if(schema.minimum!==undefined&&(input as number)<schema.minimum)invalid(`minimum is ${schema.minimum}`);
  if(schema.maximum!==undefined&&(input as number)>schema.maximum)invalid(`maximum is ${schema.maximum}`);
 }else if(schema.type==='boolean'&&typeof input!=='boolean')invalid('must be true or false');
 else if(schema.type==='string'){
  if(typeof input!=='string')invalid('must be a string');
  const s=input as string;
  if(schema.minLength!==undefined&&s.trim().length<schema.minLength)invalid('must not be empty');
  if(schema.maxLength!==undefined&&s.length>schema.maxLength)invalid(`maximum length is ${schema.maxLength}`);
  if(schema.format==='uuid'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))invalid('must be a UUID from a real record');
  if(schema.format==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s))invalid('must be a valid YYYY-MM-DD date');
  if(schema.format==='date-time'&&(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s))))invalid('must be ISO 8601 with timezone, e.g. 2026-09-24T09:00:00+08:00');
 }
 if(schema.enum&&!schema.enum.includes(input))invalid(`allowed values: ${schema.enum.join(', ')}`);
}
