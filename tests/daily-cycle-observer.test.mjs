import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('global observer uses server midnight on any route and repairs delayed question transitions', () => {
  let language = 'ar';
  let today = { data: { id: 'old', serverTime: '2026-10-20T23:59:50Z', votingClosesAt: '2026-10-21T00:00:00Z' }, dataUpdatedAt: 95000 };
  const previous = { current: undefined };
  const effects = []; const timers = []; const invalidations = []; const languages = [];
  const dependencies = {
    react: { useEffect: fn => effects.push(fn), useRef: () => previous },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: args => invalidations.push(args) }) },
    '../lib/i18n': { useI18n: () => ({ language }) },
    '../lib/pulseQueries': { pulseKeys: { all: ['pulse'] }, useTodayQuestion: lang => { languages.push(lang); return today; } }
  };
  class Clock extends Date { static now() { return 100000; } }
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/DailyCycleObserver.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext }
  }).outputText, { exports, Date: Clock, require: name => dependencies[name],
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout: () => {} });
  const render = () => { effects.length = 0; exports.DailyCycleObserver(); effects.forEach(fn => fn()); };
  render();
  assert.equal(timers.at(-1).delay, 5000); // server time + elapsed response age, independent of device epoch
  assert.equal(invalidations.length, 0);
  timers.at(-1).fn(); assert.equal(invalidations[0].queryKey[0], 'pulse');
  today = { data: { id: 'new', serverTime: '2026-10-21T00:00:02Z', votingClosesAt: '2026-10-22T00:00:00Z' }, dataUpdatedAt: 100000 };
  render(); assert.equal(invalidations.length, 2); // rollover refreshes results/community as well as Today
  language = 'ur'; render(); assert.equal(invalidations.length, 2); // locale change alone is not a new daily question
  assert.equal(languages.at(-1), 'ur');
  today = { data: null, dataUpdatedAt: 100000 }; render(); assert.equal(invalidations.length, 3);
  today = { data: { id: 'late', serverTime: '2026-10-21T00:00:02Z', votingClosesAt: '2026-10-22T00:00:00Z' }, dataUpdatedAt: 100000 };
  render(); assert.equal(invalidations.length, 4); // catches recovery after an empty window/outage
});
