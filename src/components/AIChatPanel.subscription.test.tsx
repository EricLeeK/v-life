import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIChatPanel } from './AIChatPanel';
const api=vi.hoisted(()=>({invoke:vi.fn(),from:vi.fn(),insert:vi.fn(),rpc:vi.fn(),isDemo:false,addRecord:vi.fn(),updateRecord:vi.fn(),deleteRecord:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:api.from,rpc:api.rpc,functions:{invoke:api.invoke},auth:{getUser:async()=>({data:{user:{id:'user'}}})}}}));
vi.mock('@/hooks/useData',()=>({useSettings:()=>({data:{ai_mode:'direct'}})}));
vi.mock('@/contexts/DemoModeContext',()=>({useDemoMode:()=>({isDemo:api.isDemo,demoData:{subscriptions:[],subscription_payments:[]},addRecord:api.addRecord,updateRecord:api.updateRecord,deleteRecord:api.deleteRecord})}));
vi.mock('@/contexts/LanguageContext',()=>({useLang:()=>({lang:'en',t:(_zh:string,en:string)=>en})}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}));
function send() {
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});client.setQueryData(['ai_sessions'],[]);
 render(<QueryClientProvider client={client}><AIChatPanel initialOpen /></QueryClientProvider>);
 const input=screen.getByRole('textbox',{name:'Message input'});fireEvent.change(input,{target:{value:'Record subscription'}});fireEvent.keyDown(input,{key:'Enter'});
}
describe('AI chat subscription integration',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();api.isDemo=false;api.addRecord.mockImplementation((_table,row)=>row);
  api.insert.mockResolvedValue({data:{id:'new'},error:null});api.rpc.mockResolvedValue({data:{id:'payment',amount:20},error:null});
  api.from.mockImplementation((table:string)=>{
   if(table==='ai_sessions')return {select:()=>({order:()=>({limit:async()=>({data:[],error:null})})}),insert:()=>({select:()=>({single:async()=>({data:{id:'session'},error:null})})}),update:()=>({eq:async()=>({error:null})})};
   if(table==='ai_messages')return {insert:async()=>({error:null})};
   if(table==='subscriptions')return {insert:(row:unknown)=>({select:()=>({single:()=>api.insert(row)})})};
   throw new Error(`Unexpected table ${table}`);
  });
 });
 afterEach(cleanup);
 it('uses validated subscription creation in real mode',async()=>{
  api.invoke.mockResolvedValue({data:{result:{summary:'Create subscription',operations:[{module:'subscription',action:'create',data:{name:'Cloud',amount:20,currency:'USD',next_date:'2026-10-31'}}]}},error:null});
  send();await waitFor(()=>expect(api.insert).toHaveBeenCalled());
  expect(api.insert).toHaveBeenCalledWith(expect.objectContaining({anchor_day:31,billing_unit:'month',user_id:'user'}));
 });
 it('routes confirmation to the atomic payment RPC',async()=>{
  api.invoke.mockResolvedValue({data:{result:{summary:'Confirm payment',operations:[{module:'subscription_payment',action:'create',data:{subscription_id:'11111111-1111-4111-8111-111111111111',due_date:'2026-09-25',paid_on:'2026-09-25',amount:20,next_date:'2026-10-25'}}]}},error:null});
  send();await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith('confirm_subscription_payment',expect.objectContaining({p_amount:20,p_record_expense:false})));
 });
 it('keeps demo writes and chat history out of the live database',async()=>{
  api.isDemo=true;
  api.invoke.mockResolvedValue({data:{result:{summary:'Demo subscription',operations:[{module:'subscription',action:'create',data:{name:'Cloud',amount:20,currency:'USD',next_date:'2026-10-31'}}]}},error:null});
  send();await waitFor(()=>expect(api.addRecord).toHaveBeenCalledWith('subscriptions',expect.objectContaining({name:'Cloud',amount:20})));
  expect(api.from).not.toHaveBeenCalled();expect(api.invoke.mock.calls[0][1].body.demo_subscription_snapshot).toEqual({subscriptions:[],subscription_payments:[]});
 });
});
