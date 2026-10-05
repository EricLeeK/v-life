import { createClient } from 'npm:@supabase/supabase-js@2';
import { archiveNewspapers } from '../_shared/newspaperService.ts';
/** Private scheduled entrypoint. It never accepts an owner or date from an HTTP caller. */
export async function handleRequest(req:Request):Promise<Response>{
 if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
 const expected=Deno.env.get('NEWSPAPER_WORKER_SECRET'),provided=req.headers.get('x-newspaper-worker-secret');
 if(!expected||!provided||provided.length!==expected.length)return Response.json({error:'UNAUTHORIZED'},{status:401});
 let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^provided.charCodeAt(i);if(mismatch)return Response.json({error:'UNAUTHORIZED'},{status:401});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{return Response.json({data:await archiveNewspapers(admin,{maxUsers:10,daysPerUser:3})});}catch{return Response.json({error:'ARCHIVE_FAILED'},{status:500});}
}
Deno.serve(handleRequest);
