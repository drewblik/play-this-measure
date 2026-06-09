// src/ui/editor.js — M4 tap-to-fix. The model reads structurally valid notation
// but still misses exact pitches (and the odd duration), and no prompt fixes that
// reliably (see prompts.js history). So the confirm screen lets the human correct
// the reading directly: tap a note/rest -> a control bar to nudge pitch, shift
// octave, toggle rest, split (add a note), or delete (merge into a neighbor).
//
// EVERY op preserves the §5 beat-sum invariant (each voice fills exactly the
// measure, no gaps/overlaps) — pitch edits don't touch timing; split halves a
// duration into two; delete hands the freed ticks to a neighbor. So an edited
// reading always re-validates. The ops are pure (mutate notation in place, return
// the new selection) and DOM-free, so they're unit-tested headless in tests/editor.mjs.
import { parsePitch, stepDiatonic, shiftOctave } from '../engine/layout.js';

// ---- pure notation edits (beat-sum preserving) -------------------------------

const at = (notation, sel) => notation.voices[sel.vi].notes[sel.ni];

// A sensible pitch to drop in when a rest becomes a note: reuse a neighbour's
// pitch so it lands in range, else the clef's middle line.
function defaultPitch(voice, ni) {
  const sounding = (n) => n && n.pitch !== 'rest';
  for (let k = ni - 1; k >= 0; k--) if (sounding(voice.notes[k])) return voice.notes[k].pitch;
  for (let k = ni + 1; k < voice.notes.length; k++) if (sounding(voice.notes[k])) return voice.notes[k].pitch;
  return voice.hand === 'left' ? 'D3' : 'B4';
}

// Nudge the selected note up/down by `delta` staff steps (the core misread fix).
export function stepPitch(notation, sel, delta) {
  const note = at(notation, sel);
  if (note.pitch === 'rest') return sel;
  note.pitch = stepDiatonic(note.pitch, delta);
  note.confidence = 1; // user-confirmed: clears the §13 gold outline
  return sel;
}

// Shift the selected note by whole octaves (for the gross misreads).
export function octave(notation, sel, delta) {
  const note = at(notation, sel);
  if (note.pitch === 'rest') return sel;
  note.pitch = shiftOctave(note.pitch, delta);
  note.confidence = 1;
  return sel;
}

// Note <-> rest, same slot/duration (timing untouched).
export function toggleRest(notation, sel) {
  const voice = notation.voices[sel.vi];
  const note = voice.notes[sel.ni];
  note.pitch = note.pitch === 'rest' ? defaultPitch(voice, sel.ni) : 'rest';
  note.confidence = 1;
  return sel;
}

// Add a note: split the selected event into two halves (the second inherits the
// pitch so you can re-pitch it). Needs >=2 ticks to halve. Selection stays on the
// first half. (durTicks split as floor/remainder keeps an odd dotted length summing.)
export function split(notation, sel) {
  const voice = notation.voices[sel.vi];
  const note = voice.notes[sel.ni];
  if (note.durTicks < 2) return sel; // a sixteenth can't be halved on this grid
  const firstDur = Math.floor(note.durTicks / 2);
  const second = {
    pitch: note.pitch,
    startTick: note.startTick + firstDur,
    durTicks: note.durTicks - firstDur,
    confidence: 1,
  };
  note.durTicks = firstDur;
  note.confidence = 1;
  voice.notes.splice(sel.ni + 1, 0, second);
  return sel;
}

// Delete the selected event, handing its ticks to a neighbour so the voice still
// fills the measure: extend the previous note over it, or (if it's first) pull the
// next note back to the start. The lone event in a voice can't be removed — it
// becomes a full-measure rest instead.
export function del(notation, sel) {
  const voice = notation.voices[sel.vi];
  const notes = voice.notes;
  if (notes.length === 1) { notes[0].pitch = 'rest'; notes[0].confidence = 1; return sel; }
  if (sel.ni > 0) {
    const prev = notes[sel.ni - 1];
    prev.durTicks += notes[sel.ni].durTicks;
    notes.splice(sel.ni, 1);
    return { vi: sel.vi, ni: sel.ni - 1 };
  }
  const next = notes[1];
  next.startTick = notes[0].startTick;
  next.durTicks += notes[0].durTicks;
  notes.splice(0, 1);
  return { vi: sel.vi, ni: 0 };
}

// ---- labels ------------------------------------------------------------------

// Plain-language duration name for the control bar (sixteenth grid, ticksPerBeat=4).
export function durName(durTicks) {
  return { 1: 'sixteenth', 2: 'eighth', 3: 'dotted eighth', 4: 'quarter', 6: 'dotted quarter',
    8: 'half', 12: 'dotted half', 16: 'whole' }[durTicks] || `${durTicks} ticks`;
}

function noteLabel(note) {
  return note.pitch === 'rest' ? `rest · ${durName(note.durTicks)}` : `${note.pitch} · ${durName(note.durTicks)}`;
}

// ---- control bar UI ----------------------------------------------------------

// Mount the edit control bar into `host` for the selected note. `on` is a map of
// op name -> handler (the caller applies the op, re-validates, and re-renders).
// Returns nothing; the caller rebuilds the bar on every selection change.
export function renderControls(host, notation, sel, on) {
  if (!sel) {
    host.innerHTML = `<p class="edit-hint">Tap any note to fix its pitch — or its rest, to add one.</p>`;
    return;
  }
  const note = at(notation, sel);
  const isRest = note.pitch === 'rest';
  host.innerHTML = `
    <div class="edit-bar">
      <div class="edit-sel"><b>${noteLabel(note)}</b></div>
      <div class="edit-btns">
        <button class="ebtn" data-op="up"   ${isRest ? 'disabled' : ''} title="Up a step">▲</button>
        <button class="ebtn" data-op="down" ${isRest ? 'disabled' : ''} title="Down a step">▼</button>
        <button class="ebtn" data-op="octup"   ${isRest ? 'disabled' : ''} title="Up an octave">+8va</button>
        <button class="ebtn" data-op="octdown" ${isRest ? 'disabled' : ''} title="Down an octave">−8va</button>
        <button class="ebtn" data-op="rest">${isRest ? 'Make note' : 'Make rest'}</button>
        <button class="ebtn" data-op="split" ${note.durTicks < 2 ? 'disabled' : ''} title="Split into two">＋ Add</button>
        <button class="ebtn warn" data-op="del">Delete</button>
        <button class="ebtn ghost" data-op="done">Done</button>
      </div>
    </div>`;
  host.querySelectorAll('.ebtn').forEach((b) => b.addEventListener('click', () => on[b.dataset.op]()));
}
