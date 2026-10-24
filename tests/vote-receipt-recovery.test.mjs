import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the real client parser/requests without loading native Expo modules in Node.
async function loadClient(dependencies) {
  const source = readFileSync(new URL('../lib/pulseApi.ts', import.meta.url), 'utf8');
  let javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }
  }).outputText;
  let imports = 0;
  javascript = javascript.replace(/^import (\{[^\n]+\}) from ['"][^'"]+['"];$/gm, (_line, names) => {
    imports++;
    return `const ${names} = globalThis.__pulseReceiptRecoveryDependencies;`;
  });
  assert.equal(imports, 6, 'Native test boundary must mock every runtime import');
  globalThis.__pulseReceiptRecoveryDependencies = dependencies;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

test('client restores original receipt after storage clear and never fabricates acceptance', async () => {
  const saved = [];
  const guestHistory = [];
  const calls = [];
  let result = { data: { status: 'NOT_VOTED' }, error: null };
  const device = { platform: 'android', deviceIdentifier: 'stable-android-id', deviceType: 'phone',
    isPhysicalDevice: true, isRooted: false };
  class IneligibleDeviceError extends Error {}
  try {
    const client = await loadClient({
      localGeneration: () => 0, rememberGuestAnswer: async receipt => guestHistory.push(receipt),
      getInstallationCredential: async () => 'new-credential-after-storage-clear',
      collectClientDeviceEvidence: async () => device, IneligibleDeviceError,
      storeVoteReceipt: async receipt => saved.push(receipt),
      supabaseConfigurationError: null,
      supabase: { auth: { getSession: async () => ({ data: {session: null} }) }, functions: { invoke: async (name, options) => {
        calls.push({ name, body: options.body });
        return result;
      } } }
    });
    assert.equal(await client.fetchVoteReceipt('question'), null);
    assert.equal(saved.length, 0);
    assert.deepEqual(calls[0], { name: 'vote', body: { operation: 'status',
      credential: 'new-credential-after-storage-clear', deviceEvidence: device, questionId: 'question' } });

    result = { data: { status: 'ALREADY_VOTED', receipt_id: 'original-receipt', accepted_choice: 'YES',
      accepted_at: '2026-10-20T12:00:00Z' }, error: null };
    const recovered = await client.fetchVoteReceipt('question');
    assert.deepEqual(recovered, { receiptId: 'original-receipt', choice: 'YES', questionId: 'question',
      acceptedAt: '2026-10-20T12:00:00Z', alreadyCounted: true });
    assert.deepEqual(saved[0], recovered);
    assert.ok(!('captchaToken' in calls[1].body), 'Receipt recovery is read-only and needs no CAPTCHA token');

    // If a duplicate attempt races with preflight, preserve the original YES even if the user tapped NO.
    const duplicate = await client.submitVote({ questionId: 'question', choice: 'NO', idempotencyKey: 'new-key',
      captchaBinding: 'binding', captchaToken: 'token' });
    assert.deepEqual(duplicate, recovered);
    assert.equal(saved.length, 2);

    result = { data: null, error: { message: 'unavailable' } };
    await assert.rejects(client.fetchVoteReceipt('question'), error => error.code === 'VOTE_STATUS_UNAVAILABLE');
    result = { data: { status: 'unexpected' }, error: null };
    await assert.rejects(client.fetchVoteReceipt('question'), error => error.code === 'INVALID_RESPONSE');
    result = { data: { status: 'ALREADY_VOTED', receipt_id: 'bad-receipt', accepted_choice: 'MAYBE' }, error: null };
    await assert.rejects(client.fetchVoteReceipt('question'), error => error.code === 'INVALID_RESPONSE');
    assert.equal(saved.length, 2, 'Failed or malformed status must not be saved as a confirmed vote');
    assert.equal(guestHistory.length, 2, 'A confirmed unowned guest receipt can restore history after response loss');
    result = { data: { status: 'ALREADY_VOTED', receipt_id: 'private-receipt', accepted_choice: null, accepted_at: '2026-10-20T12:00:00Z' }, error: null };
    assert.equal((await client.fetchVoteReceipt('question')).choice, null);
    assert.equal(guestHistory.length, 2, 'Redacted former-account receipts never become guest history');
  } finally {
    delete globalThis.__pulseReceiptRecoveryDependencies;
  }
});

test('receipt query never treats an offline empty cache or failed lookup as permission to vote', async () => {
  const source = readFileSync(new URL('../lib/pulseQueries.ts', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }
  }).outputText.replace(/^import (\{[^\n]+\}) from ['"][^'"]+['"];$/gm,
    (_line, names) => `const ${names} = globalThis.__pulseReceiptQueryDependencies;`);
  let online = false;
  let local = null;
  let reads = 0;
  class PulseApiError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }
  try {
    globalThis.__pulseReceiptQueryDependencies = {
      useQuery: options => options,
      onlineManager: { isOnline: () => online },
      getStoredVoteReceipt: async () => local,
      fetchVoteReceipt: async () => { reads++; return null; },
      PulseApiError
    };
    const { useVoteReceipt } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
    const query = useVoteReceipt('question');
    await assert.rejects(query.queryFn(), error => error.code === 'VOTE_STATUS_UNAVAILABLE');
    assert.equal(reads, 0);
    online = true;
    assert.equal(await query.queryFn(), null);
    assert.equal(reads, 1, 'Only a successful server read can establish no prior vote');
    online = false;
    local = { receiptId: 'existing-confirmed-receipt' };
    assert.equal(await query.queryFn(), local);
    assert.equal(reads, 1, 'Existing confirmed receipt remains available offline');
    assert.equal(useVoteReceipt(undefined).enabled, false);
  } finally {
    delete globalThis.__pulseReceiptQueryDependencies;
  }
});

test('a late vote success after logout cannot reintroduce the old account receipt into guest cache', async () => {
  const source=readFileSync(new URL('../lib/pulseQueries.ts',import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
    .replace(/^import (\{[^\n]+\}) from ['"][^'"]+['"];$/gm,(_line,names)=>`const ${names}=globalThis.__pulseLateMutationDependencies;`);
  let generation=0;const cached=[];
  globalThis.__pulseLateMutationDependencies={localGeneration:()=>generation,useMutation:options=>options,
    useQueryClient:()=>({setQueryData:(key,value)=>cached.push({key,value}),invalidateQueries:async()=>{}})};
  try {
    const {useSubmitVote}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
    const mutation=useSubmitVote('question');const context=mutation.onMutate();generation++;
    mutation.onSuccess({questionId:'question',choice:'YES'}, {}, context);
    assert.equal(cached.length,0,'Logout generation isolates the new guest session from an old successful response');
    const current=mutation.onMutate();mutation.onSuccess({questionId:'question',choice:'NO'}, {}, current);
    assert.equal(cached.length,1,'A current accepted response still updates the receipt');
  } finally {delete globalThis.__pulseLateMutationDependencies;}
});
