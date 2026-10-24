import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../services/question-links/worker.mjs';
const id='27000000-0000-4000-8000-000000000001';
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',PLAY_STORE_URL:'https://play.google.com/store/apps/details?id=com.pulse.worldtoday',APP_STORE_URL:'https://apps.apple.com/app/id123',APPLE_TEAM_ID:'ABCDEFGHIJ',ANDROID_SHA256_FINGERPRINTS:Array(32).fill('AB').join(':')};
test('links publish exact association files, not credentials or account data',async()=>{
 const ios=await (await worker.fetch(new Request('https://links.test/.well-known/apple-app-site-association'),env)).json();
 assert.equal(ios.applinks.details[0].appID,'ABCDEFGHIJ.com.pulse.worldtoday');
 const android=await (await worker.fetch(new Request('https://links.test/.well-known/assetlinks.json'),env)).json();
 assert.equal(android[0].target.package_name,'com.pulse.worldtoday');
 assert.equal((await worker.fetch(new Request('https://links.test/.well-known/assetlinks.json'),{})).status,503);
});
test('public landing escapes question content, picks the correct store and keeps removed questions unavailable',async()=>{
 const previous=globalThis.fetch;let result={text:'<script>private?</script>',destination:'brewing'};
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(options.headers.apikey,'sb_publishable_test');assert.equal('Authorization' in options.headers,false);return Response.json(result);};
  for(const [agent,store] of [['Android','play.google.com'],['iPhone','apps.apple.com']]){
   const r=await worker.fetch(new Request(`https://links.test/q/submission/${id}`,{headers:{'User-Agent':agent}}),env);
   const html=await r.text();assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');
   assert.ok(html.includes(store));assert.ok(html.includes('&lt;script&gt;private?&lt;/script&gt;'));assert.equal(html.includes('<script>private?</script>'),false);
   assert.ok(html.includes(`pulse://q/submission/${id}`));assert.ok(html.includes('tap your original question link again'));
  }
  result=null;const removed=await worker.fetch(new Request(`https://links.test/q/submission/${id}`),env);
  assert.equal(removed.status,404);assert.equal((await removed.text()).includes('Open in PULSE'),false);
  globalThis.fetch=async()=>{throw new Error('unavailable');};
  assert.equal((await worker.fetch(new Request(`https://links.test/q/question/${id}`),env)).status,503);
 }finally{globalThis.fetch=previous;}
});
