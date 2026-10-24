// Optional worker; missing provider credentials/outages leave questions pending for human review.
import { clients,json,payload } from '../_shared/security.ts';
Deno.serve(async request=>{
  const key=Deno.env.get('MODERATION_WORKER_SECRET');
  if (!key || request.headers.get('Authorization')!==`Bearer ${key}`) return json({error:'Unauthorized'},401);
  try {
    const body=await payload(request); const {admin}=clients();
    const {data:s,error}=await admin.from('question_submissions').select('id,question_text,revision,status').eq('id',body.id).single();
    if (error || s?.status!=='pending') return json({status:'UNCHANGED'});
    const apiKey=Deno.env.get('OPENAI_API_KEY'); if (!apiKey) return json({status:'PENDING'});
    const response=await fetch('https://api.openai.com/v1/moderations',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'omni-moderation-latest',input:s.question_text}),signal:AbortSignal.timeout(8000)});
    if (!response.ok) return json({status:'PENDING'});
    const result=(await response.json()).results?.[0];
    if (!result || result.flagged!==false || !result.category_scores ||
      Object.values(result.category_scores).some(v=>typeof v!=='number' || !Number.isFinite(v) || v>0.1)) return json({status:'PENDING'});
    const reviewed=await admin.rpc('review_brewing_submission',{p_id:s.id,p_revision:s.revision,p_publish:true,p_reason:'Automated safety triage passed; model omni-moderation-latest.'});
    return json({status:reviewed.error?'PENDING':'PUBLISHED'});
  } catch { return json({status:'PENDING'},503); }
});
