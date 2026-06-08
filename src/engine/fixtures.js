// src/engine/fixtures.js
// Six hard-coded NOTATION fixtures (§4 schema) for M0/M1. Includes the Danny
// tie+chord acceptance case. Each `notation` is exactly the §4 contract the
// renderer + audio consume (see the notation-schema skill). All voices are
// §5-valid (each fills its measure with no gaps/overlaps).
//
// NOTE on Danny (fixture 4): "hold the top note while striking two beneath it"
// is polyphony, not a chord. §5 forbids overlaps inside one voice, so it is
// modeled as TWO right-hand voices (the held melody + the struck chord). The
// prototype used a single overlapping voice; that is not §5-valid. See the M0
// review note — this has implications for the §10.2 S1 prompt at M2.

export const FIXTURES = [
  {
    id: 'steady',
    name: 'Steady beats',
    blurb: 'One press per beat, nothing tied — Tied and Re-struck are identical.',
    notation: {
      timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
      voices: [
        { hand: 'right', notes: [
          { pitch: 'E5', startTick: 0, durTicks: 4, confidence: 1 },
          { pitch: 'G5', startTick: 4, durTicks: 4, confidence: 1 },
          { pitch: 'E5', startTick: 8, durTicks: 4, confidence: 1 },
          { pitch: 'D5', startTick: 12, durTicks: 4, confidence: 1 },
        ] },
      ],
    },
  },
  {
    id: 'one-tie',
    name: 'One tie',
    blurb: 'Beat 2 is tied across beat 3 — the tied-into head is hollow blue.',
    notation: {
      timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
      voices: [
        { hand: 'right', notes: [
          { pitch: 'G5', startTick: 0, durTicks: 4, confidence: 1 },
          { pitch: 'E5', startTick: 4, durTicks: 6, confidence: 1 },
          { pitch: 'D5', startTick: 10, durTicks: 2, confidence: 1 },
          { pitch: 'C5', startTick: 12, durTicks: 4, confidence: 1 },
        ] },
      ],
    },
  },
  {
    id: 'syncopated',
    name: 'Syncopated',
    blurb: 'Two ties pull presses onto the "a" after the beat.',
    notation: {
      timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
      voices: [
        { hand: 'right', notes: [
          { pitch: 'G5', startTick: 0, durTicks: 2, confidence: 1 },
          { pitch: 'A5', startTick: 2, durTicks: 3, confidence: 1 },
          { pitch: 'G5', startTick: 5, durTicks: 1, confidence: 1 },
          { pitch: 'E5', startTick: 6, durTicks: 2, confidence: 1 },
          { pitch: 'G5', startTick: 8, durTicks: 2, confidence: 1 },
          { pitch: 'A5', startTick: 10, durTicks: 3, confidence: 1 },
          { pitch: 'G5', startTick: 13, durTicks: 3, confidence: 1 },
        ] },
      ],
    },
  },
  {
    id: 'danny',
    name: 'Tie + chord (Danny)',
    blurb: 'Hold the tied top note (hollow blue) while striking two fresh notes beneath it on beat 3.',
    notation: {
      timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
      voices: [
        // Held melody: G5, then E5 struck on beat 2 and tied across beat 3.
        { hand: 'right', notes: [
          { pitch: 'G5', startTick: 0, durTicks: 4, confidence: 1 },
          { pitch: 'E5', startTick: 4, durTicks: 8, confidence: 0.95 },
          { pitch: 'D5', startTick: 12, durTicks: 4, confidence: 1 },
        ] },
        // Struck chord on beat 3, resting before and after.
        { hand: 'right', notes: [
          { pitch: 'rest', startTick: 0, durTicks: 8, confidence: 1 },
          { pitch: 'C5', startTick: 8, durTicks: 4, confidence: 0.9 },
          { pitch: 'A4', startTick: 8, durTicks: 4, confidence: 0.9 },
          { pitch: 'rest', startTick: 12, durTicks: 4, confidence: 1 },
        ] },
      ],
    },
  },
  {
    id: 'grand',
    name: 'Both hands',
    blurb: 'Right hand on the treble staff, left hand on the bass staff — try the hands toggle.',
    notation: {
      timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
      voices: [
        { hand: 'right', notes: [
          { pitch: 'E5', startTick: 0, durTicks: 4, confidence: 1 },
          { pitch: 'D5', startTick: 4, durTicks: 4, confidence: 1 },
          { pitch: 'C5', startTick: 8, durTicks: 4, confidence: 1 },
          { pitch: 'D5', startTick: 12, durTicks: 4, confidence: 1 },
        ] },
        { hand: 'left', notes: [
          { pitch: 'C3', startTick: 0, durTicks: 8, confidence: 1 },
          { pitch: 'G3', startTick: 8, durTicks: 8, confidence: 1 },
        ] },
      ],
    },
  },
  {
    id: 'rests-accidentals',
    name: 'Rests · accidentals · dotted',
    blurb: 'Sharp, flat, a dotted eighth + sixteenth, an eighth rest and a quarter rest.',
    notation: {
      timeSignature: '4/4', ticksPerBeat: 4, measures: 1,
      voices: [
        { hand: 'right', notes: [
          { pitch: 'F#5', startTick: 0, durTicks: 4, confidence: 1 },
          { pitch: 'rest', startTick: 4, durTicks: 2, confidence: 1 },
          { pitch: 'Bb4', startTick: 6, durTicks: 2, confidence: 1 },
          { pitch: 'A4', startTick: 8, durTicks: 3, confidence: 1 },
          { pitch: 'G4', startTick: 11, durTicks: 1, confidence: 1 },
          { pitch: 'rest', startTick: 12, durTicks: 4, confidence: 1 },
        ] },
      ],
    },
  },
];
