import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCapabilities, fieldsSchema } from './mcpAdapter.ts';
import { MODULES } from '../_shared/moduleRegistry.ts';
Deno.test('schema preserves number boolean and required fields',()=>{
 const finance=MODULES.find(m=>m.key==='finance')!;
 const s=fieldsSchema(finance,'create');
 assertEquals(s.properties.amount.type,'number');assert(s.required.includes('date'));
 assertEquals(s.additionalProperties,false);assert(!('user_id' in s.properties));
});
Deno.test('capabilities follow registered operations',()=>{
 const caps=buildCapabilities();const m=caps.modules.find(m=>m.key==='learning_note')!;
 assertEquals(m.operations.delete,false);assert(!JSON.stringify(caps).includes('ai_api_key'));
});
