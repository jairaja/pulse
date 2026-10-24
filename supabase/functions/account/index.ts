import { clients,device,hash,identity,json,payload,verifyAction } from '../_shared/security.ts';

Deno.serve(async request=>{
  try {
    const body=await payload(request); const {admin,auth}=clients();
    if (body.operation==='begin') {
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if (email.length>254 || !/^\S+@\S+\.\S+$/.test(email)) return json({error:'Enter a valid email address.'},400);
      const d=await device(body); const ceremony=crypto.randomUUID();
      const begun=await admin.rpc('begin_account_auth',{p_id:ceremony,p_email_hash:await hash(email),p_credential:d.credential,p_device_hash:d.deviceHash});
      if (begun.error) return json({error:'Wait before requesting another code.'},429);
      const {error}=await auth.auth.signInWithOtp({email,options:{shouldCreateUser:true,data:{pulse_signup_ceremony:ceremony}}});
      if (error) return json({error:'We could not send a code. Wait a moment and try again.'},400);
      return json({ceremony});
    }
    if (body.operation==='verify') {
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if (typeof body.ceremony!=='string' || typeof body.token!=='string' || !/^\d{6}$/.test(body.token)) return json({error:'Enter the 6-digit code from your email.'},400);
      const d=await device(body);
      const allowed=await admin.rpc('authorize_account_otp',{p_ceremony:body.ceremony,p_email_hash:await hash(email),p_device_hash:d.deviceHash});
      if (allowed.error || allowed.data!==true) return json({error:'Request a new email code.'},403);
      const {data,error}=await auth.auth.verifyOtp({email,token:body.token,type:'email'});
      if (error || !data.session || !data.user) return json({error:'That code is invalid or expired. Request a new code.'},400);
      const session=JSON.parse(atob(data.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;
      const bound=await admin.rpc('bind_account_otp',{p_account:data.user.id,p_session:session,p_ceremony:body.ceremony,p_device_hash:d.deviceHash});
      if (bound.error) return json({error:'Request a new email code.'},403);
      return json({session:data.session});
    }
    const who=await identity(request);
    if (body.operation==='logout') {
      const {error}=await admin.rpc('end_account_session',{p_account:who.account,p_session:who.session});
      return error?json({error:'Could not log out. Please try again.'},503):json({ok:true});
    }
    if (body.operation!=='complete' || typeof body.ceremony!=='string' || typeof body.importHistory!=='boolean') return json({error:'Invalid request.'},400);
    const d=await device(body);
    if (!await verifyAction(body,who.session,'login',[body.ceremony,body.importHistory])) return json({error:'Human verification failed. Please retry.'},403);
    const {data,error}=await admin.rpc('complete_account_auth',{p_account:who.account,p_session:who.session,
      p_ceremony:body.ceremony,p_credential:d.credential,p_device_hash:d.deviceHash,p_import:body.importHistory});
    if (error) return json({error:'Sign in again with a new email code.'},403);
    return json(data);
  } catch { return json({error:'Sign-in verification is unavailable. Check your connection and try again.'},503); }
});
