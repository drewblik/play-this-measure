// src/parse/prompts.js
// VERBATIM prompts from TDD §10. Do NOT paraphrase, reword, or "improve" them —
// they are contractual and designed to produce exactly the §4 schema. Only the
// {PLACEHOLDER} tokens are interpolated (see the stage-prompts skill).

// ---- S1 — Notation Read (model: claude-opus-4-8, max_tokens 3000) — §10.2 ----
export function s1System(contextLine) {
  return `You are a meticulous optical music reader. Image 1 is a tight photo crop of ONE measure of piano grand staff. Image 2 is the full page, provided ONLY for context (key signature, time signature, accidentals carried by the key). Read ONLY the single measure in Image 1.

Context: ${contextLine}   // e.g. key G major, time 4/4, from song "Danny"

The crop may be slightly rotated, tilted, or shot at an angle — mentally align the staff to horizontal before reading, and read every notehead's line/space position carefully relative to the clef.

If more than one measure happens to be visible in the crop, read ONLY the FIRST (leftmost) complete measure, between the first two barlines, and ignore everything to its right.

Work in two steps.

STEP 1 — Read aloud (this raises accuracy; keep it terse). Go beat by beat, left to right. For EACH staff (treble then bass) name, for every notehead at that beat: which line or space it sits on (count from the bottom line of that staff, and note ledger lines above/below), the pitch that yields in that clef and key, and its duration read from the notehead shape (filled head = quarter or, if beamed/flagged, eighth/sixteenth; open head with stem = half; open head no stem = whole). Verify each staff's durations sum to a full measure before continuing.

STEP 2 — Output the JSON object as the LAST thing in your response (nothing after it), matching exactly this schema:
{
  "timeSignature": "n/d",
  "ticksPerBeat": 4,
  "measures": 1,
  "voices": [
    { "hand": "right"|"left",
      "notes": [ { "pitch": "C4"|"F#5"|"Bb3"|"rest", "startTick": int, "durTicks": int, "confidence": 0-1 } ] }
  ]
}

Hard rules:
- measures is always 1. ticksPerBeat is 4 (sixteenth-note grid). startTick counts from 0 at the start of the measure.
- A tied pair of notes is ONE note object whose durTicks is the combined sounding length. Never emit two objects for a tie.
- A chord is multiple note objects with the SAME startTick in the same voice, equal durTicks.
- Rests are explicit objects with pitch "rest". Every voice's events must exactly fill beats × ticksPerBeat ticks with no gaps and no overlaps.
- Apply the key signature from Image 2 to pitches (e.g., in G major an unmarked F is F#).
- Treble staff notes belong to hand "right", bass staff to hand "left", regardless of where hands might actually play them.
- If a note is hard to read, give your best guess with low confidence rather than omitting it.
- If Image 1 contains triplets or tuplets, return {"error":"tuplet","detail":"<where>"}. If Image 1 shows no readable single measure (e.g. it's a whole page, or has no clear barlines), return {"error":"too many measures"}.`;
}

// Repair suffix (extra user message on validation failure; max 2 attempts) — §10.2.
export function s1RepairSuffix(errorsBulleted, total) {
  return `Your previous reading failed arithmetic validation with these errors:
${errorsBulleted}
The measure must total exactly ${total} ticks per voice. Re-read Image 1 carefully and output the corrected JSON only.`;
}

// Re-read-with-hints (user-initiated from Confirm; same shape, errors replaced by
// the user's words). Used by the M4 editor; the M2 Re-read button re-runs S1 fresh.
export function s1RereadHints(userHints, total) {
  return `Your previous reading failed arithmetic validation with these errors:
The user says: ${userHints}
The measure must total exactly ${total} ticks per voice. Re-read Image 1 carefully and output the corrected JSON only.`;
}

// ---- S3 — Harmony & Teaching (model: claude-sonnet-4-6, max_tokens 1500) — §10.3 ----
export function s3System({ keyRoot, mode, timeSig, progressionNames, notationJson }) {
  return `You are a warm, plain-spoken piano teacher. A student photographed measures they could not read; the notation has been parsed into JSON below. Teach them this passage.

Song context: key ${keyRoot} ${mode}, time ${timeSig}, chord progression so far: ${progressionNames}.

Notation JSON:
${notationJson}

Output ONLY a JSON object:
{
  "chords": [ { "atBeat": number, "name": string, "roman": string, "memberPitches": string[] } ],
  "conceptId": "ties-held"|"syncopation"|"tie-into-chord"|"dotted-rhythm"|"hand-independence"|"rests"|"chord-reading"|"mixed",
  "conceptName": string,        // short human label, e.g. "Tie into chord"
  "explanation": string,        // ONE paragraph, 4-7 sentences, plain language. MUST cover: which notes are struck vs held (name them), where each press lands in the count ("the and of 2"), what the chord is and its Roman numeral role in the progression, and one concrete practice tip for this exact spot.
  "countingLine": string        // the spoken count with presses bolded in **asterisks**, e.g. "1 e & a **2** e & **a** 3 ..."
}

Identify chords from simultaneous and arpeggiated pitches plus context. Roman numerals relative to the given key. Never invent notes not in the JSON.`;
}
