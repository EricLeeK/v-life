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

Deno.test('finance summary defaults to the Shanghai month across UTC year boundary', async () => {
 const {financeSummaryPeriod} = await import('./mcpAdapter.ts');
 assertEquals(financeSummaryPeriod({}, new Date('2026-12-31T16:00:00Z')), {date_from:'2027-01-01',date_to:'2027-01-31'});
 assertEquals(financeSummaryPeriod({year:9999,month:12}), {date_from:'9999-12-01',date_to:'9999-12-31'});
 assertEquals(financeSummaryPeriod({date_from:'2026-09-01'}), {date_from:'2026-09-01'});
 assertEquals(financeSummaryPeriod({date_to:'2026-09-24'}), {date_to:'2026-09-24'});
});

Deno.test('daily task tools expose create-by-title-or-id and completion without writable scores',()=>{
 const daily=MODULES.find(m=>m.key==='daily_task')!;
 const schema=fieldsSchema(daily,'create');
 assert('todo_id' in schema.properties && 'title' in schema.properties);
 assert(!schema.required.includes('title'));
 assert(!('base_points' in schema.properties));
 assertEquals(fieldsSchema(daily,'update').properties.is_completed.type,'boolean');
 const caps=buildCapabilities();
 assert(caps.modules.some(m=>m.key==='daily_task' && m.operations.create && m.operations.update));
});
