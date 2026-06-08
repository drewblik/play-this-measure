---
name: notation-schema
description: Use whenever producing, consuming, editing, or validating NOTATION JSON for Play This Measure — i.e. any work on the parse pipeline (S1/P1 output), the renderer/audio engine input, the confirm editor, or fixtures. Enforces the §4 contract and the §5 beat-sum validation exactly.
---

# NOTATION JSON — the parse↔render contract

**Source of truth:** `docs/play-this-measure-tdd.md` §4 (schema) and §5 (validation). Do not invent fields or relax rules. If this skill and the TDD ever disagree, the TDD wins — update this file.

## Shape (§4)
```jsonc
{
  "timeSignature": "4/4",   // "n/d"
  "ticksPerBeat": 4,        // sixteenth grid; triplets UNSUPPORTED v1
  "measures": 1,            // 1 or 2 for crops; 1 for page-transcription units
  "voices": [
    { "hand": "right",      // "right" | "left"
      "notes": [
        // startTick from the start of the first rendered measure
        { "pitch": "E5", "startTick": 4, "durTicks": 8, "confidence": 0.95 },
        { "pitch": "rest", "startTick": 12, "durTicks": 4, "confidence": 0.9 }
      ] }
  ]
}
```

## Invariants — never violate
- **Tie = ONE note** whose `durTicks` crosses a beat boundary. The renderer splits at beats and draws the arc. There are **no explicit tie flags**. Never emit two note objects for a tie.
- **Chord = multiple notes sharing `startTick`** within one voice, equal `durTicks`.
- **Rest = `pitch:"rest"`** occupying its ticks; rendered as a rest glyph and counted.
- **Pitch** is scientific notation `A0`–`C8`; sharps `F#4`, flats `Bb3`. Regex: `^[A-G][#b]?[0-8]$`. Frequency = equal temperament, A4 = 440.
- Treble staff → `hand:"right"`, bass staff → `hand:"left"` (regardless of which hand really plays).

## Validation (§5) — code, not model
Every voice's events must **exactly fill** `ticksPerBeat × num × (4/den) × measures` ticks, with **no gaps and no overlaps**. Chords (same startTick) must share durations. Use the exact `validateNotation(n)` from TDD §5 — it returns `{ ok, errors, total }` with per-voice messages. On `!ok`: rebuild the S1 call with the §10.2 repair suffix, **max 2 repair attempts**, then mark red / surface to the user.

## When you touch notation
1. Validate with the §5 function before rendering, teaching, or storing.
2. Low-confidence flag: `confidence < 0.7` → dotted outline in Confirm (§13).
3. Don't "fix" notation silently — surface validation errors per the §14 error contract.
