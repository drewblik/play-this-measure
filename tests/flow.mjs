// Headless smoke for the M2 UI flow: Confirm -> Teach -> save -> Lesson -> Home.
// Uses fake-indexeddb (real db.js) + a mocked /api/claude (S3). No camera/API.
// Run: node tests/flow.mjs
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body><main id="app"></main></body>', { url: 'http://localhost/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// keep node's globalThis.crypto (has randomUUID + subtle); jsdom's lacks subtle.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failures++; };

// mock the proxy for the S3 teach call
globalThis.fetch = async () => ({
  status: 200, ok: true,
  json: async () => ({
    content: [{ type: 'text', text: JSON.stringify({
      chords: [{ atBeat: 1, name: 'C', roman: 'I', memberPitches: ['C4', 'E4', 'G4'] }],
      conceptId: 'chord-reading', conceptName: 'Chord reading',
      explanation: 'Play these together.', countingLine: '**1** 2 3 4',
    }) }],
    usage: { input_tokens: 1500, output_tokens: 400 },
  }),
});

const { draft } = await import('../src/ui/flow.js');
const { validateNotation } = await import('../src/parse/validate.js');
const { FIXTURES } = await import('../src/engine/fixtures.js');
const { mountConfirm } = await import('../src/ui/confirm.js');
const { mountLesson } = await import('../src/ui/lesson.js');
const { mountHome } = await import('../src/ui/home.js');

const app = document.getElementById('app');
const notation = FIXTURES[0].notation;

// seed the draft as if Capture had just run S1
Object.assign(draft, {
  crop: { base64: 'x', hash: 'flow-hash-1', thumbDataUrl: 'data:image/jpeg;base64,', blob: null },
  page: null,
  context: { keyRoot: 'C', mode: 'major', timeSig: '4/4', title: 'FlowTest' },
  s1: { notation, validation: validateNotation(notation), attempts: 1, cents: 0.6 },
});

// --- Confirm ---
const cleanup = mountConfirm(app);
ok(/Here's what I read/.test(app.textContent) && app.querySelectorAll('.nh').length > 0, 'Confirm renders the reading + a staff');
ok(!!app.querySelector('#teachBtn') && !!app.querySelector('#rereadBtn'), 'Confirm shows Teach + Re-read');

// --- Teach -> save -> route to lesson ---
app.querySelector('#teachBtn').click();
for (let i = 0; i < 50 && !location.hash.startsWith('#/lesson/'); i++) await sleep(20);
ok(location.hash.startsWith('#/lesson/'), `Teach saves a lesson and routes (${location.hash})`);
if (cleanup) try { cleanup(); } catch (e) {}
const id = decodeURIComponent(location.hash.replace('#/lesson/', ''));

// --- Lesson loads from db (no API) ---
const lessonCleanup = await mountLesson(app, { id });
ok(/Chord reading/.test(app.textContent), 'Lesson shows the concept');
ok(app.querySelectorAll('.nh').length > 0 && !!app.querySelector('#playBtn'), 'Lesson renders the play-along + Play');
ok(/0\.\d+¢|\d+¢/.test(app.textContent), 'Lesson shows a cost note');
if (lessonCleanup) try { lessonCleanup(); } catch (e) {}

// --- Home lists the saved lesson ---
await mountHome(app);
ok(app.querySelectorAll('.lesson-card').length === 1, 'Home lists the saved measure');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
