// tests/editor.mjs — M4 tap-to-fix edit ops. The contract: every op preserves the
// §5 beat-sum invariant (each voice still fills the measure, no gaps/overlaps), so
// an edited reading always re-validates. Pure ops, no DOM. Run: node tests/editor.mjs
import { validateNotation } from '../src/parse/validate.js';
import { stepPitch, octave, toggleRest, split, del, durName } from '../src/ui/editor.js';
import { stepDiatonic, shiftOctave } from '../src/engine/layout.js';

let failures = 0;
const ok = (cond, msg) => { if (cond) { console.log('PASS', msg); } else { failures++; console.log('FAIL', msg); } };
const fresh = () => ({
  timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
  voices: [
    { hand: 'right', notes: [
      { pitch: 'C4', startTick: 0, durTicks: 4, confidence: 0.5 },
      { pitch: 'E4', startTick: 4, durTicks: 4, confidence: 1 },
      { pitch: 'G4', startTick: 8, durTicks: 8, confidence: 1 },
    ] },
    { hand: 'left', notes: [{ pitch: 'C3', startTick: 0, durTicks: 16, confidence: 1 }] },
  ],
});
const valid = (n) => validateNotation(n).ok;

// ---- pure pitch math ----
ok(stepDiatonic('C4', 1) === 'D4', 'stepDiatonic up: C4 -> D4');
ok(stepDiatonic('C4', -1) === 'B3', 'stepDiatonic down crosses octave: C4 -> B3');
ok(stepDiatonic('F#5', 1) === 'G5', 'stepDiatonic drops accidental to natural: F#5 -> G5');
ok(shiftOctave('Bb3', 1) === 'Bb4', 'shiftOctave keeps accidental: Bb3 -> Bb4');
ok(shiftOctave('C8', 1) === 'C8', 'shiftOctave clamps at 8');
ok(durName(6) === 'dotted quarter', 'durName(6) = dotted quarter');

// ---- pitch nudge (timing untouched) ----
{
  const n = fresh();
  stepPitch(n, { vi: 0, ni: 0 }, 1);
  ok(n.voices[0].notes[0].pitch === 'D4', 'stepPitch nudges C4 -> D4');
  ok(n.voices[0].notes[0].confidence === 1, 'stepPitch confirms the note (confidence -> 1)');
  ok(valid(n), 'stepPitch keeps the measure valid');
}
{
  const n = fresh();
  octave(n, { vi: 0, ni: 2 }, -1);
  ok(n.voices[0].notes[2].pitch === 'G3', 'octave shifts G4 -> G3');
  ok(valid(n), 'octave keeps the measure valid');
}

// ---- rest toggle (both directions, timing untouched) ----
{
  const n = fresh();
  toggleRest(n, { vi: 0, ni: 1 });
  ok(n.voices[0].notes[1].pitch === 'rest', 'toggleRest: note -> rest');
  ok(valid(n), 'note -> rest keeps the measure valid');
  toggleRest(n, { vi: 0, ni: 1 });
  ok(n.voices[0].notes[1].pitch !== 'rest', 'toggleRest: rest -> note (gets a real pitch)');
  ok(valid(n), 'rest -> note keeps the measure valid');
}

// ---- split / add ----
{
  const n = fresh();
  split(n, { vi: 0, ni: 0 }); // quarter -> two eighths
  ok(n.voices[0].notes.length === 4, 'split adds an event to the voice');
  ok(n.voices[0].notes[0].durTicks === 2 && n.voices[0].notes[1].durTicks === 2, 'split halves the duration (4 -> 2+2)');
  ok(n.voices[0].notes[1].startTick === 2, 'split: second half starts mid-way');
  ok(valid(n), 'split keeps the measure valid');
}
{
  const n = fresh();
  n.voices[0].notes = [{ pitch: 'C4', startTick: 0, durTicks: 1, confidence: 1 },
    { pitch: 'C4', startTick: 1, durTicks: 15, confidence: 1 }];
  const before = n.voices[0].notes.length;
  split(n, { vi: 0, ni: 0 }); // a sixteenth can't be halved
  ok(n.voices[0].notes.length === before, 'split is a no-op on a sixteenth');
}

// ---- delete (hands ticks to a neighbour) ----
{
  const n = fresh();
  const s = del(n, { vi: 0, ni: 1 }); // delete middle -> previous absorbs it
  ok(n.voices[0].notes.length === 2, 'delete removes the event');
  ok(n.voices[0].notes[0].durTicks === 8, 'delete: previous note absorbs the freed ticks (4 -> 8)');
  ok(s.ni === 0, 'delete moves selection to the absorbing neighbour');
  ok(valid(n), 'delete (merge into prev) keeps the measure valid');
}
{
  const n = fresh();
  del(n, { vi: 0, ni: 0 }); // delete first -> next pulls back to the start
  ok(n.voices[0].notes[0].startTick === 0 && n.voices[0].notes[0].pitch === 'E4', 'delete first: next note pulls back to tick 0');
  ok(valid(n), 'delete (pull next back) keeps the measure valid');
}
{
  const n = fresh();
  del(n, { vi: 1, ni: 0 }); // lone event in the left voice -> becomes a full-measure rest
  ok(n.voices[1].notes.length === 1 && n.voices[1].notes[0].pitch === 'rest', 'delete lone event -> full-measure rest');
  ok(valid(n), 'delete lone event keeps the measure valid');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
