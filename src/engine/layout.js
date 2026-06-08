// src/engine/layout.js
// Pure geometry + pitch math — no DOM, no audio. Ported and extended from
// tie-rhythm.html (see the renderer-gotchas skill / TDD §7). Consumed by
// renderer.js (positions) and audio.js (frequencies). Driven by the §4
// NOTATION schema (see the notation-schema skill).

// ---------- time signature / ticks ----------
export function parseTimeSig(timeSignature) {
  const [num, den] = timeSignature.split('/').map(Number);
  return { num, den };
}

// Ticks in one measure. ticksPerBeat is the sixteenth grid (4).
// 4/4 -> 4*4*(4/4) = 16; 5/4 -> 20; 6/8 -> 4*6*(4/8) = 12.
export function ticksPerMeasure(timeSignature, ticksPerBeat) {
  const { num, den } = parseTimeSig(timeSignature);
  return ticksPerBeat * num * (4 / den);
}

// Whole-notation tick span. §4 startTick counts from the start of the first
// rendered measure and runs continuously across `measures`.
export function totalTicks(notation) {
  return ticksPerMeasure(notation.timeSignature, notation.ticksPerBeat) * notation.measures;
}

// ---------- pitch ----------
const LETTER_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_DIATONIC = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Parse scientific pitch "C4" | "F#5" | "Bb3".
// `diatonic` is a monotonic white-key index (C0=0, +1 per letter, +7 per octave)
// used for vertical staff position; the accidental is drawn as a separate glyph.
export function parsePitch(pitch) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(pitch);
  if (!m) throw new Error(`bad pitch "${pitch}"`);
  const letter = m[1];
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  const midi = (octave + 1) * 12 + LETTER_SEMITONE[letter] + accidental;
  const diatonic = octave * 7 + LETTER_DIATONIC[letter];
  return { letter, accidental, octave, midi, diatonic };
}

// Equal temperament, A4 = 440 (TDD §4).
export function pitchToFreq(pitch) {
  return 440 * Math.pow(2, (parsePitch(pitch).midi - 69) / 12);
}

// ---------- horizontal mapping (tick -> x fraction) ----------
// Ported from the prototype's mapFrac, generalized from a fixed 16-tick bar to
// the whole notation's tick span.
export const PAD = 0.045;
export function mapFrac(tick, total) {
  return PAD + (1 - PAD) * (tick / total);
}

// ---------- vertical staff geometry ----------
// Ported from the prototype: line-to-line gap SP; one diatonic step = SP/2.
// Generalized to a grand staff — each clef pins a top staff line (a diatonic
// index) to a y and shares SP. Band offsets (the actual top-line y values, the
// gap between staves) are owned by renderer.js. (TDD §7: bass clef below treble.)
export const SP = 9; // line-to-line gap, px

// Staff lines as diatonic indices, top -> bottom.
// Treble bottom line E4 (30) ... top line F5 (38).
// Bass   bottom line G2 (18) ... top line A3 (26).
export const TREBLE_LINES = [38, 36, 34, 32, 30]; // F5 D5 B4 G4 E4
export const BASS_LINES = [26, 24, 22, 20, 18];   // A3 F3 D3 B2 G2
export const TREBLE_TOP_DIATONIC = 38; // F5
export const BASS_TOP_DIATONIC = 26;   // A3

// y for a diatonic index given a clef's top-line diatonic and that line's y.
// Higher pitch (larger diatonic) -> smaller y.
export function staffY(diatonic, topLineDiatonic, topLineY) {
  return topLineY + (topLineDiatonic - diatonic) * (SP / 2);
}

// ---------- lane assignment (rhythm blocks) ----------
// Greedy overlap-based: a note joins the first lane with no time overlap, so
// chords stack into separate lanes and monophonic stays in one (TDD §7 #4).
export function assignLanes(notes) {
  const lanes = [];
  const laneByIndex = {};
  notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.startTick - b.n.startTick)
    .forEach(({ n, i }) => {
      let li = 0;
      for (; li < lanes.length; li++) {
        const free = lanes[li].every(
          (m) => n.startTick >= m.startTick + m.durTicks || n.startTick + n.durTicks <= m.startTick
        );
        if (free) { lanes[li].push(n); break; }
      }
      if (li === lanes.length) lanes.push([n]);
      laneByIndex[i] = li;
    });
  return { nLanes: lanes.length || 1, laneByIndex };
}

// ---------- tie / re-struck segmentation ----------
// Split a note at beat boundaries into segments. The renderer ALWAYS splits (to
// draw tie arcs and the hollow tied-into head); audio splits only in re-struck
// mode (TDD §7 #2). Each segment keeps `origStart` so the renderer can tell a
// tied-into segment (origStart !== startTick) from a freshly struck one.
export function splitAtBeats(note, ticksPerBeat) {
  const out = [];
  let cur = note.startTick;
  const end = note.startTick + note.durTicks;
  while (cur < end) {
    const nextBeat = (Math.floor(cur / ticksPerBeat) + 1) * ticksPerBeat;
    const segEnd = Math.min(nextBeat, end);
    out.push({ pitch: note.pitch, startTick: cur, durTicks: segEnd - cur, origStart: note.startTick });
    cur = segEnd;
  }
  return out;
}
