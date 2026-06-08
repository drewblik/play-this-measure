// Headless smoke test for the engine render path. Does NOT verify pixel geometry
// (that's the M1 on-device check) — it confirms createLab mounts every fixture
// without throwing and emits the expected noteheads / attack markers. Run:
//   node tests/smoke-render.mjs
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

const { createLab } = await import('../src/engine/index.js');
const { FIXTURES } = await import('../src/engine/fixtures.js');
const { validateNotationExpectations } = await import('./expectations.mjs');

let failures = 0;
const fail = (msg) => { failures++; console.log('FAIL', msg); };

for (const fx of FIXTURES) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let lab;
  try {
    lab = createLab(host, { notation: fx.notation, tempoBpm: 60, mode: 'tie', hands: 'both' });
  } catch (e) {
    fail(`${fx.id}: createLab threw — ${e.message}\n${e.stack}`);
    continue;
  }
  const heads = host.querySelectorAll('.nh').length;
  const tied = host.querySelectorAll('.nh.tied').length;
  const attacks = host.querySelectorAll('.attack').length;
  const blocks = host.querySelectorAll('.block').length;
  const ties = host.querySelectorAll('.ntie').length;
  const rests = host.querySelectorAll('.rest').length;
  const accidentals = host.querySelectorAll('.accidental').length;
  const press = host.querySelector('.lab-pressN')?.textContent;
  const exp = validateNotationExpectations(fx.id, { heads, tied, attacks, blocks, ties, rests, accidentals, press: +press });
  console.log(
    `${exp.ok ? 'PASS' : 'FAIL'} ${fx.id.padEnd(18)} heads=${heads} tied=${tied} attacks=${attacks} blocks=${blocks} ties=${ties} rests=${rests} acc=${accidentals} press=${press}`
  );
  if (!exp.ok) { failures++; exp.errors.forEach((e) => console.log('     -', e)); }

  // mode + hands toggles must not throw
  try { lab.setMode('restruck'); lab.setHands('right'); lab.setHands('left'); lab.setHands('both'); lab.setMode('tie'); lab.setTempo(80); }
  catch (e) { fail(`${fx.id}: toggle threw — ${e.message}`); }
  lab.destroy();
}

// ---- M1 geometry checks (clef-aware y-mapping + clef selection) ----
// Reference y's from renderer.js: treble bottom line E4 = 64; bass band top = 106.
const TREBLE_STAFF_BOTTOM = 64;
const BASS_BAND_TOP = 106;
const cy = (nh) => +nh.getAttribute('cy');

// treble-low: every right-hand head stays in the TREBLE band (the old single-
// ladder mapping shoved B3/A3 down to ~106 onto the bass staff), and at least one
// dips below the treble staff bottom line so the below-middle-C case is exercised.
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  const fx = FIXTURES.find((f) => f.id === 'treble-low');
  const lab = createLab(host, { notation: fx.notation, tempoBpm: 60, mode: 'tie', hands: 'both' });
  const rh = [...host.querySelectorAll('.nh[data-hand="right"]')].map(cy);
  const lh = [...host.querySelectorAll('.nh[data-hand="left"]')].map(cy);
  const ok = rh.length === 4 && lh.length === 4
    && rh.every((y) => y < BASS_BAND_TOP - 6)      // not pushed onto the bass staff
    && rh.some((y) => y > TREBLE_STAFF_BOTTOM)      // actually below the treble staff
    && lh.every((y) => y >= BASS_BAND_TOP);         // bass voice really is in the bass band
  console.log(`${ok ? 'PASS' : 'FAIL'} treble-low (geometry)   RH cy=[${rh.join(', ')}] LH cy=[${lh.join(', ')}]`);
  if (!ok) fail('treble-low: a right-hand note below middle C is not in the treble band');
  lab.destroy();
}

// clef selection: a bass-only measure draws ONLY the bass staff (5 lines, one
// clef glyph) near the top — not an empty treble staff above it.
{
  const host = document.createElement('div');
  document.body.appendChild(host);
  const notation = {
    timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
    voices: [{ hand: 'left', notes: [
      { pitch: 'C3', startTick: 0, durTicks: 4, confidence: 1 },
      { pitch: 'E3', startTick: 4, durTicks: 4, confidence: 1 },
      { pitch: 'G3', startTick: 8, durTicks: 4, confidence: 1 },
      { pitch: 'C3', startTick: 12, durTicks: 4, confidence: 1 },
    ] }],
  };
  const lab = createLab(host, { notation, tempoBpm: 60, mode: 'tie', hands: 'both' });
  const lines = host.querySelectorAll('.lab-notation .staffline').length;
  const clefGlyphs = host.querySelectorAll('.lab-clef').length;
  const topLine = Math.min(...[...host.querySelectorAll('.lab-notation .staffline')].map((l) => +l.getAttribute('y1')));
  const ok = lines === 5 && clefGlyphs === 1 && topLine < BASS_BAND_TOP;
  console.log(`${ok ? 'PASS' : 'FAIL'} bass-only (clef select) stafflines=${lines} clefs=${clefGlyphs} topLine=${topLine}`);
  if (!ok) fail('bass-only: expected a single bass staff near the top (no empty treble staff)');
  lab.destroy();
}

// PAD alignment: count labels and the gridlines layer share the notes' PAD-aware
// mapping, so "1 e & a ..." sits under each note instead of drifting.
{
  const { mapFrac, PAD, totalTicks } = await import('../src/engine/layout.js');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const fx = FIXTURES.find((f) => f.id === 'steady');
  const lab = createLab(host, { notation: fx.notation, tempoBpm: 60, mode: 'tie', hands: 'both' });
  const total = totalTicks(fx.notation);
  const spans = [...host.querySelectorAll('.lab-countrow span')];
  const firstLeft = spans[0]?.style.left;
  const beat2Left = spans[4]?.style.left;                 // tick 4 = beat 2
  const gridlines = host.querySelector('.lab-gridlines');
  const near = (a, b) => Math.abs(parseFloat(a) - b) < 0.01;
  const ok = spans.length === total
    && near(firstLeft, mapFrac(0, total) * 100)
    && near(beat2Left, mapFrac(4, total) * 100)
    && gridlines && near(gridlines.style.left, PAD * 100);
  console.log(`${ok ? 'PASS' : 'FAIL'} count/grid PAD-align  spans=${spans.length} first=${firstLeft} beat2=${beat2Left} gridLeft=${gridlines?.style.left}`);
  if (!ok) fail('count labels / gridlines are not PAD-aligned with the notes');
  lab.destroy();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
