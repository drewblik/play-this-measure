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

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
