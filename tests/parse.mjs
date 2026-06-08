// Headless unit tests for the M2 parse pipeline. Mocks the /api/claude proxy
// (global fetch) — no real API calls, no IndexedDB. Run: node tests/parse.mjs
import { validateNotation, bulletErrors } from '../src/parse/validate.js';
import { callStage, runS1, runS3 } from '../src/parse/client.js';
import { centsFromUsage } from '../src/parse/cost.js';
import { FIXTURES } from '../src/engine/fixtures.js';

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failures++; };

// --- mock proxy ---
function mockFetch(responses) {
  let i = 0;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    const res = responses[Math.min(i, responses.length - 1)]; i++;
    const status = res.status ?? 200;
    return { status, ok: status < 400, json: async () => res.body };
  };
  return calls;
}
const aiText = (obj, usage = { input_tokens: 100, output_tokens: 50 }) => ({
  body: { content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], usage },
});

const valid = { timeSignature: '4/4', ticksPerBeat: 4, measures: 1, voices: [{ hand: 'right', notes: [{ pitch: 'E5', startTick: 0, durTicks: 16, confidence: 1 }] }] };
const short = { timeSignature: '4/4', ticksPerBeat: 4, measures: 1, voices: [{ hand: 'right', notes: [{ pitch: 'E5', startTick: 0, durTicks: 8, confidence: 1 }] }] };

// 1. validate — known-good fixtures
ok(validateNotation(FIXTURES[0].notation).ok, 'validate: steady fixture passes');
ok(validateNotation(FIXTURES[4].notation).ok, 'validate: grand fixture passes');

// 2. validate — catches a short voice with a specific message
const vb = validateNotation(short);
ok(!vb.ok && vb.errors.some((e) => e.includes('fills 8 ticks')), `validate: catches short voice — "${vb.errors[0]}"`);
ok(bulletErrors(vb.errors).startsWith('- '), 'bulletErrors formats a markdown list');

// 3. callStage — strips ```json fences
mockFetch([aiText('```json\n{"a":1}\n```')]);
ok((await callStage({ model: 'claude-opus-4-8', system: 's', userBlocks: [{ type: 'text', text: 'x' }], maxTokens: 100 })).json.a === 1, 'callStage: strips code fences');

// 4. callStage — one malformed-JSON retry, with the nudge appended
{
  const calls = mockFetch([aiText('not json at all'), aiText({ b: 2 })]);
  const r = await callStage({ model: 'claude-opus-4-8', system: 's', userBlocks: [{ type: 'text', text: 'x' }], maxTokens: 100 });
  ok(r.json.b === 2 && calls.length === 2, `callStage: retries once on malformed JSON (calls=${calls.length})`);
  ok(calls[1].body.messages[0].content.some((b) => b.text?.includes('not valid JSON')), 'callStage: retry appends the JSON nudge');
}

// 4b. callStage — extracts the JSON when S1 reasons (read-aloud) before it
{
  mockFetch([aiText('STEP 1 — Read aloud:\nBeat 1 treble: 2nd line = G4, quarter.\nBeat 1 bass: middle line = D3, half.\n\nSTEP 2:\n{"d":4}')]);
  const r = await callStage({ model: 'claude-opus-4-8', system: 's', userBlocks: [{ type: 'text', text: 'x' }], maxTokens: 100 });
  ok(r.json.d === 4, 'callStage: extracts JSON after a reasoning preamble');
}

// 5. callStage — retries a 429 then succeeds
{
  const calls = mockFetch([{ status: 429, body: {} }, aiText({ c: 3 })]);
  const r = await callStage({ model: 'claude-opus-4-8', system: 's', userBlocks: [{ type: 'text', text: 'x' }], maxTokens: 100 });
  ok(r.json.c === 3 && calls.length === 2, `callStage: retries on 429 (calls=${calls.length})`);
}

// 6. callStage — surfaces an API error without burning retries
{
  const calls = mockFetch([{ status: 401, body: { error: { message: 'invalid key' } } }]);
  let threw = null;
  try { await callStage({ model: 'claude-opus-4-8', system: 's', userBlocks: [{ type: 'text', text: 'x' }], maxTokens: 100 }); }
  catch (e) { threw = e; }
  ok(threw?.apiError && calls.length === 1, 'callStage: throws API error immediately');
}

// 7. runS1 — S2 repair loop: invalid reading -> repaired -> valid
{
  const calls = mockFetch([aiText(short), aiText(valid)]);
  const s1 = await runS1({ cropBase64: 'x', pageBase64: null, cropHash: 'h1', pageHash: '', contextLine: 'key C major, time 4/4' });
  ok(s1.notation && s1.validation.ok && s1.attempts === 2, `runS1: repairs invalid->valid (attempts=${s1.attempts})`);
  ok(calls[1].body.messages[0].content.some((b) => b.text?.includes('failed arithmetic validation')), 'runS1: sends the §10.2 repair suffix');
  ok(calls[0].body.content === undefined && calls[0].body.messages[0].content[0].type === 'image', 'runS1: sends the crop as an image block');
}

// 8. runS1 — gives up after 2 repairs but still returns the last reading + errors
{
  mockFetch([aiText(short), aiText(short), aiText(short)]);
  const s1 = await runS1({ cropBase64: 'x', pageBase64: null, cropHash: 'h9', pageHash: '', contextLine: 'k' });
  ok(s1.notation && !s1.validation.ok && s1.attempts === 3, `runS1: stops after 2 repairs (attempts=${s1.attempts}, ok=${s1.validation.ok})`);
}

// 9. runS1 — surfaces a stage error payload ({"error":"tuplet"})
{
  mockFetch([aiText({ error: 'tuplet', detail: 'beat 3' })]);
  const s1 = await runS1({ cropBase64: 'x', pageBase64: null, cropHash: 'h2', pageHash: '', contextLine: 'k' });
  ok(s1.error === 'tuplet' && s1.detail === 'beat 3', `runS1: surfaces error payload (${s1.error})`);
}

// 10. runS1 — cache hit avoids a second billed call
{
  const m = new Map();
  const cache = { async get(k) { return m.get(k) || null; }, async put(k, stage, response) { m.set(k, { hash: k, stage, response }); } };
  mockFetch([aiText(valid)]);
  await runS1({ cropBase64: 'x', pageBase64: null, cropHash: 'hc', pageHash: '', contextLine: 'ctx' }, { cache });
  let fetched = 0; globalThis.fetch = async () => { fetched++; throw new Error('should not be called'); };
  const second = await runS1({ cropBase64: 'x', pageBase64: null, cropHash: 'hc', pageHash: '', contextLine: 'ctx' }, { cache });
  ok(second.cached === true && fetched === 0, 'runS1: identical inputs hit the cache (no re-bill)');
}

// 11. runS3 — returns teaching JSON + a cost
{
  mockFetch([aiText({ conceptId: 'tie-into-chord', conceptName: 'Tie into chord', explanation: '…', countingLine: '1 **2** 3 4', chords: [] }, { input_tokens: 2000, output_tokens: 500 })]);
  const s3 = await runS3({ notation: valid, keyRoot: 'C', mode: 'major', timeSig: '4/4', progressionNames: '' });
  ok(s3.teaching.conceptId === 'tie-into-chord' && s3.cents > 0, `runS3: returns teaching (${s3.cents.toFixed(2)}¢)`);
}

// 12. cost math
ok(Math.abs(centsFromUsage({ input_tokens: 1e6, output_tokens: 1e6 }, 'claude-opus-4-8') - 3000) < 1e-6, 'cost: opus 1M in + 1M out = 3000¢');
ok(Math.abs(centsFromUsage({ input_tokens: 1e6, output_tokens: 1e6 }, 'claude-sonnet-4-6') - 1800) < 1e-6, 'cost: sonnet 1M in + 1M out = 1800¢');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
