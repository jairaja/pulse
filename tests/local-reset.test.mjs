import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
test('logout drains in-flight cache writes, deletes history/preferences and rejects stale owner writes without rotating device identity',async()=>{
 const data=new Map([['pulse.guest-history.q','answer'],['pulse.preferences.device.v1','settings'],['unrelated','keep']]);
 let release;const exports={};
 const storage={getAllKeys:async()=>[...data.keys()],removeItem:async key=>data.delete(key),setItem:async(key,value)=>{
  if(key==='pulse.delayed')await new Promise(resolve=>{release=resolve;});data.set(key,value);
 }};
 const js=ts.transpileModule(readFileSync(new URL('../lib/localReset.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ESNext}}).outputText;
 runInNewContext(js,{exports,require:()=>({__esModule:true,default:storage})});
 const generation=exports.localGeneration();const pending=exports.writeLocal('pulse.delayed','old answer',generation);
 const reset=exports.clearLocalPulse();assert.equal(exports.localGeneration(),generation+1);
 await exports.writeLocal('pulse.stale','old account',generation);release();await pending;await reset;
 assert.deepEqual([...data],[['unrelated','keep']]);
 await exports.writeLocal('pulse.guest-history.new','new guest answer');assert.equal(data.get('pulse.guest-history.new'),'new guest answer');
});
