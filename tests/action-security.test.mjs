import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { countGraphemes } from 'unicode-segmenter/grapheme';
import { edgeModule } from './helpers/edge.mjs';
const sid='26000000-0000-4000-8000-000000000001';
const requestId='26000000-0000-4000-8000-000000000002';
const env=new Map(Object.entries({ SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'secret',
  DEVICE_FINGERPRINT_PEPPER:'private-pepper'.repeat(4),TURNSTILE_SECRET_KEY:'secret',TURNSTILE_EXPECTED_HOSTNAME:'verify.example.test' }));
const evidence={platform:'android',deviceIdentifier:'stable-device',deviceType:'tablet',isPhysicalDevice:true,isRooted:false};
const body={credential:'a'.repeat(64),deviceEvidence:evidence,requestId,captchaToken:'valid-provider-token'};
const binding=(session,purpose,target)=>createHash('sha256').update(JSON.stringify([body.credential,session,purpose,target,requestId])).digest('hex');
function fixture() {
 let handler,verified, providerDown=false; const calls=[],tokens=new Set();
 const client={auth:{getUser:async()=>({data:{user:{id:'verified-user',email_confirmed_at:'2026-10-24T00:00:00Z'}},error:null})},
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='accept_brewing_submission'?'question-id':{id:args.p_submission,status:'ACCEPTED'},error:null};}};
 const globals={Deno:{env:{get:k=>env.get(k)},serve:cb=>{handler=cb;}},fetch:async()=>{
  if(providerDown)throw new Error('Private upstream details');
  if(tokens.has(body.captchaToken)) return Response.json({success:false});tokens.add(body.captchaToken);
  return Response.json({success:true,action:'pulse-vote',hostname:'verify.example.test',cdata:verified,challenge_ts:new Date().toISOString()});
 }};
 const security=edgeModule('_shared/security.ts',{'npm:@supabase/supabase-js@2':{createClient:()=>client},'npm:unicode-segmenter@0.17.3/grapheme':{countGraphemes}},globals);
 return {security,calls,tokens,globals,setBinding:value=>{verified=value;},outage:()=>{providerDown=true;},
  load:file=>{edgeModule(file,{'../_shared/security.ts':security},globals);return value=>handler(new Request('https://test/function',{
   method:'POST',headers:{Authorization:`Bearer header.${Buffer.from(JSON.stringify({session_id:sid})).toString('base64url')}.signature`},body:JSON.stringify(value)}));}};
}
test('action proof binds purpose, verified session, target, consent and request ID; token is single use',async()=>{
 const f=fixture();const target=['ceremony',true];const proof={...body,captchaBinding:binding(sid,'login',target)};f.setBinding(proof.captchaBinding);
 for(const [session,purpose,value] of [[sid,'upvote',target],[sid,'login',['ceremony',false]],['other','login',target],[sid,'login',['other',true]]])
  assert.equal(await f.security.verifyAction(proof,session,purpose,value),false);
 assert.equal(await f.security.verifyAction(proof,sid,'login',target),true);
 assert.equal(await f.security.verifyAction(proof,sid,'login',target),false,'Solved token cannot be replayed after login');
 assert.equal(f.calls.length,0,'Verification does not write to DB');
});
test('community handler fails closed before writes; account and quota dates come only from verified identity/server',async()=>{
 const f=fixture(),call=f.load('community-action/index.ts');
 const proof={...body,operation:'upvote',id:'question',account:'forged-account',voted_on:'2099-01-01',captchaBinding:binding(sid,'upvote','question')};
 f.setBinding(proof.captchaBinding);
 assert.equal((await call({...proof,captchaBinding:'forged'})).status,403);assert.equal(f.calls.length,0);
 const response=await call(proof);assert.equal(response.status,200);
 assert.equal(f.calls[0].name,'accept_brewing_upvote');assert.equal(f.calls[0].args.p_account,'verified-user');
 assert.equal(f.calls[0].args.p_session,sid);assert.equal('voted_on' in f.calls[0].args,false);
 assert.equal((await call(proof)).status,403,'Same CAPTCHA cannot buy a second operation');
});
test('CAPTCHA outage, emoji length and ineligible device evidence cannot publish or upvote',async()=>{
 const f=fixture(),call=f.load('community-action/index.ts');
 const proof={...body,operation:'upvote',id:'question',captchaBinding:binding(sid,'upvote','question')};f.outage();
 assert.equal((await call(proof)).status,503);assert.equal(f.calls.length,0);
 const long='👩🏽‍💻'.repeat(181);
 assert.equal((await call({...proof,operation:'submit',text:long})).status,400);
 assert.equal((await call({...proof,deviceEvidence:{...evidence,isPhysicalDevice:false}})).status,503);
 assert.equal(f.calls.length,0);
});
test('post-OTP login needs a fresh bound CAPTCHA before replacing the previous session',async()=>{
 const f=fixture(),call=f.load('account/index.ts');
 const proof={...body,operation:'complete',ceremony:'origin-ceremony',importHistory:true,captchaBinding:binding(sid,'login',['origin-ceremony',true])};f.setBinding(proof.captchaBinding);
 assert.equal((await call({...proof,importHistory:false})).status,403);assert.equal(f.calls.length,0);
 assert.equal((await call(proof)).status,200);assert.equal(f.calls[0].name,'complete_account_auth');
 assert.equal(f.calls[0].args.p_import,true);assert.equal(f.calls[0].args.p_account,'verified-user');
});

test('client device flags are only a best-effort signal, not attestation',async()=>{
 const f=fixture();
 const a=await f.security.device(body);
 const b=await f.security.device({...body,deviceEvidence:{...evidence,deviceIdentifier:'forged-new-identifier'}});
 assert.notEqual(a.deviceHash,b.deviceHash,'A modified client can change an unverified identifier; platform attestation is still required');
});
test('OTP provider verification is bound to the ceremony before a session can be activated',async()=>{
 const calls=[];let handler;const token=`header.${Buffer.from(JSON.stringify({session_id:sid})).toString('base64url')}.signature`;
 let valid=false;
 const client={auth:{verifyOtp:async()=>valid?{data:{user:{id:'verified-user'},session:{access_token:token,refresh_token:'refresh'}},error:null}:{data:{},error:{message:'invalid'}}},
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='authorize_account_otp'?true:null,error:null};}};
 const globals={Deno:{env:{get:k=>env.get(k)},serve:cb=>{handler=cb;}}};
 const security=edgeModule('_shared/security.ts',{'npm:@supabase/supabase-js@2':{createClient:()=>client},'npm:unicode-segmenter@0.17.3/grapheme':{countGraphemes}},globals);
 edgeModule('account/index.ts',{'../_shared/security.ts':security},globals);
 const call=()=>handler(new Request('https://test/account',{method:'POST',body:JSON.stringify({...body,operation:'verify',email:'person@example.test',token:'123456',ceremony:'ceremony'})}));
 assert.equal((await call()).status,400);assert.deepEqual(calls.map(c=>c.name),['authorize_account_otp']);
 valid=true;calls.length=0;const response=await call();assert.equal(response.status,200);
 assert.deepEqual(calls.map(c=>c.name),['authorize_account_otp','bind_account_otp']);
 assert.equal(calls[1].args.p_session,sid);assert.equal(calls[1].args.p_account,'verified-user');
 assert.equal(calls.some(c=>c.name==='complete_account_auth'),false,'OTP alone never replaces the active device before CAPTCHA');
});
