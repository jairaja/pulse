import { clients,countGraphemes,device,identity,json,payload,verifyAction } from '../_shared/security.ts';

const safe=new Set(['SESSION_REPLACED','This submission request conflicts with an earlier request.','You already used your upvote today. Try again at 00:00 UTC.',
  'This device already used its upvote today. Try again at 00:00 UTC.','You cannot upvote your own question.',
  'This question is not available for upvotes.','You already submitted a question today. Try again at 00:00 UTC.',
  'This question is already in Brewing.','Only your pending question can be edited.','Refresh the question list to continue.']);
Deno.serve(async request=>{
  try {
    const body=await payload(request); const who=await identity(request); const d=await device(body);
    const {admin}=clients();
    const args={p_account:who.account,p_session:who.session,p_credential:d.credential,p_device_hash:d.deviceHash};
    if (body.operation==='allowance') {
      const {data,error}=await admin.rpc('get_brewing_device_allowance',args);
      return error?json({error:'Could not check your daily allowance.'},403):json(data);
    }
    if (!['upvote','submit'].includes(String(body.operation))) return json({error:'Invalid request.'},400);
    if (body.operation==='submit') {
      if (typeof body.text!=='string') return json({error:'Enter your question.'},400);
      body.text=body.text.trim().normalize('NFC');
      const count=countGraphemes(body.text as string);
      if (count<1 || count>180 || new TextEncoder().encode(body.text as string).length>4096) return json({error:'Keep your question to 180 characters.'},400);
    }
    const target=body.operation==='upvote'?body.id:[body.text,body.editId??null];
    if (!await verifyAction(body,who.session,String(body.operation),target)) return json({error:'Human verification failed. Please retry.'},403);
    const {data,error}=body.operation==='upvote'
      ? await admin.rpc('accept_brewing_upvote',{...args,p_submission:body.id})
      : await admin.rpc('accept_brewing_submission',{...args,p_text:body.text,p_request:body.requestId,p_edit:body.editId??null});
    if (error) return json({error:safe.has(error.message)?error.message:'Could not complete this action.'},400);
    if (body.operation==='submit') {
      const workerSecret=Deno.env.get('MODERATION_WORKER_SECRET');
      if (workerSecret) {
        // Worker outages never lose an accepted submission or make it public without review.
        await admin.functions.invoke('moderate-submissions',{body:{id:data},headers:{Authorization:`Bearer ${workerSecret}`}}).catch(()=>undefined);
      }
    }
    return json(body.operation==='submit'?{id:data,status:'PENDING'}:data);
  } catch { return json({error:'Verification is unavailable. Please try again.'},503); }
});
