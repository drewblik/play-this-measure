# Play This Measure — Vision

> **I can name every note — but not the chord they make, the count they sit on, or which ones I'm still holding.**

## Backstory & Philosophy

This idea was born at the piano with a phone in one hand. Drew was learning "Danny" (Daniel Rosenfeld / C418) from a printed book and hit the wall every returning pianist knows: the pitches were readable one at a time, but the *measure* wasn't. Ties joined notes across beats so the next press landed somewhere unmarked. A tied note flowed into a chord, and it was genuinely unclear which keys were new and which were already down. The margin of the score tells the story — Drew had hand-written the chord names (G, G7/F, Am7/E, Cmaj7...) down the side of the page, doing manually exactly what the app should do automatically.

The breakthrough came in a Claude conversation: an interactive HTML drill that drew a real treble staff above color-coded rhythm blocks — orange for "press," blue for "hold" — with a sweeping playhead, counts underneath, sustained audio, and a Tied-vs-Re-struck toggle that made the difference *audible*. The tie+chord confusion dissolved in one session. Three insights came out of that, and the third arrived during design refinement and reshaped the product:

1. **Four synchronized representations of one truth** — notation, blocks, counts, and sound, locked to the same timeline — teach a measure faster than any one of them alone.
2. The teaching moment is **hold vs. strike**. Existing tools play music *at* you; none of them tell your hands which keys are fresh presses and which are already down.
3. **The song is the project.** The stuck measure is the *interaction*, but the goal is learning the piece. The margin chord-list Drew writes by hand is really a song-level lesson — key, scale, progression, quirks — and the measure lessons accumulate inside it. The product isn't a measure-explainer; it's a **piano teacher, one piece at a time**.

The philosophy: this is not a transcription app and not a performance app. It is a **comprehension** app. You bring a piece you're learning; the app gives you the bird's-eye lesson on the song, then teaches each stuck measure as you hit it, and gives you a metronome to practice with. The output is understanding, carried back to the printed page.

## The Idea

When you start learning a piece, photograph the page. The app creates a **song project** and generates the overview lesson automatically — the things a teacher covers in the first five minutes: the key and scale, where it sits on the circle of fifths, the chord progression labeled with names *and* Roman numerals (G – G7/F – Am – C becomes I – I⁷/♭ⅤⅡ̂... in plain teaching language), the time signature and tempo, and the quirks worth knowing in advance (a 5/4 bar, a passing chord, a syncopated hook).

Then, as you practice: point the camera at any measure you can't read. The app reads it and teaches it back — notes named, the chord identified and placed in the progression, the rhythm counted out ("1 e & a"), and a slow, loopable play-along where the grand staff, colored press/hold blocks, counts, and sound move together under one playhead. Tied notes render hollow-blue ("already down — don't re-press") and a toggle lets you hear tied vs. re-struck. A plain-language paragraph names the concept that's actually tripping you up so the lesson generalizes. Each explained measure saves into the song, building a record of every spot you've conquered. A per-song metronome (remembering your current practice tempo) rounds out the bench loop.

Because reading a phone photo of notation is genuinely hard, the app shows its reading first and lets you nudge any note before playing. Honesty about uncertainty is a feature: a confidently wrong rhythm is worse than none.

## Why This Matters

- The "I know my note names but can't read music" stage is where most adult learners stall and quit; the gap is rhythm, harmony, and structure — exactly what this teaches.
- Playback apps answer "what does this sound like." Nothing answers "what do my hands do, and why," or "what is this piece doing harmonically."
- Teachers cost money and aren't there at 10pm. The piano bench is exactly where this lives: phone, camera, thirty seconds.
- The drill engine that makes this work already exists and is proven on the exact confusion (ties, tie+chord) that triggered the idea.

## Prior Art & Competitive Landscape

This space is researched, not guessed. What exists:

**OMR playback apps — PlayScore 2, ScanScore, Sheet Music Scanner.** Mature optical music recognition: photograph or PDF a score, hear MIDI playback with a moving cursor, adjust tempo, export MusicXML/MIDI. PlayScore 2 is the category leader (~$5/mo tier). These are *performance* tools: they play the piece accurately but explain nothing — no chord labels, no counts, no hold-vs-strike, no concept teaching. They work at the full-page level, not the stuck-measure level.

**Soundslice.** The strongest adjacent product. Web-based "living sheet music": scan PDFs/photos into interactive notation, loop bars, slow down, and — notably — optional pitch-name labels above notes and a rhythm-counts display showing beat numbers. It's an excellent practice *platform*, aimed at teachers building lessons and serious students managing repertoire. What it is not: a piano teacher. No chord identification or harmonic explanation, no Roman numerals or circle-of-fifths context, no held-vs-struck visual language, no tied/re-struck audible contrast, no concept coaching. The mental model is "manage and practice scores," not "teach me this piece."

**Audio chord-detection apps — Chord ai, Moises, Klangio.** Strong AI chord recognition *from audio recordings*, not from notation photos. Different input, different job.

**LLMs reading sheet music directly.** Public evidence (independent evaluations of multimodal models on notation images, 2024–2026) shows general-purpose LLMs still misread full-page scores badly — wrong chords, hallucinated measures. This is the honest risk at the core of this product, and it shapes the design: tight one-to-two-measure crops for the teaching unit, a structured output contract, an arithmetic validation loop (beats must sum to the time signature), and a confirm/edit step. Notably, one widely-read essay in this space wishes for almost exactly this product — an annotated score with chord-symbol and harmonic-function layers — and concludes nobody has built it.

**The honest summary:** photo→playback is commodity (PlayScore proved it); interactive practice is commodity (Soundslice proved it). What does not exist is the *teaching layer* — song-level harmonic lessons, chord labeling with Roman-numeral explanation, hold-vs-strike visual language, count-aligned slow playback, and concept naming — delivered at the moment of confusion and organized around the pieces you're learning.

## The Three Real Differentiators

1. **Hold vs. strike as a first-class visual language.** Orange = press, blue = held, hollow-blue notehead = written-but-don't-re-press, "Press 2" hand indicator. No competitor renders this distinction at all.
2. **It teaches like a teacher.** Song overview first (key, circle of fifths, progression in Roman numerals, quirks), then concept-named measure lessons with tied/re-struck contrast. The lesson transfers to the next piece; a playback app transfers nothing.
3. **Song-as-project, camera-first, confusion-triggered.** The workflow mirrors how learning actually happens: start a piece, hit walls, conquer them one by one — with the app keeping the record.

## Strategic Moat

Honestly: thin, and that's fine for what this is. OMR is commodity; LLM vision APIs are commodity; the drill engine is clever but copyable. What compounds is small but real: the teaching design language (the press/hold system, the tied/re-struck contrast), a growing concept library mapped to drills, and — if usage grows — a corpus of confirmed photo→notation corrections that improves parsing prompts. This is a personal tool first; if it becomes a product, the moat is pedagogy and taste, not technology.

## Long-Term Vision

A piano teacher in your pocket, organized the way learning is organized: by piece. The mature version handles fingering suggestions, harmonic narrative across a whole line ("this G7/F is passing between G and Am"), an interactive circle of fifths you can explore from any song, practice history that notices patterns ("dotted rhythms have stalled you three times — here's a five-minute drill set"), spaced review of conquered measures, and a library of every piece you've ever learned with every wall you broke through.

## Future Roadmap

**Reading depth:** key signatures and accidentals beyond v1 coverage; triplets and tuplets; rests as first-class "lift on time" events; multi-voice within a hand; repeats and navigation symbols.
**Teaching depth:** interactive circle of fifths (tap a key, see its chords and neighbors); fingering suggestions; harmonic narrative across systems; concept drill sets generated from history; spoken counts.
**Practice tools:** practice streaks tied to concepts; spaced review of saved measures; recording and self-comparison.
**Product surface:** cloud sync and multi-device (v2 persistence); native app (Expo) if the PWA outgrows itself; sampled piano audio; share a song project with a teacher.
**Parsing quality:** hybrid OMR+LLM pipeline; correction-corpus feedback loop into prompts.

## Open Strategic Questions

- Personal tool forever, or eventual product? (Affects polish, auth, billing investment.)
- If product: hobbyist adult learners, or piano teachers as the channel?
- Free with own-API-key, or hosted with subscription to cover parse costs?
- How far to push parse autonomy vs. always-confirm? (Trust grows as accuracy is proven.)

## Decisions Log (closed during design)

- Problem statement: locked (above). **DECIDED**
- Slug: `play-this-measure`. **DECIDED**
- Parse architecture: multi-stage with beat-sum validation loop. **DECIDED**
- Staff scope: grand staff from day 1. **DECIDED**
- Capture: always two photos — full page (song context) + tight crop (the measure). **DECIDED**
- Persistence: local IndexedDB in v1 (install-to-home-screen recommended; JSON backup included); Neon Postgres provisioned dormant at infra setup as the v2 sync landing zone. **DECIDED**
- Chord depth: names + Roman numerals in v1; static circle of fifths with key highlighted in v1; interactive circle v2. **DECIDED**
- Song-as-project structure with song overview lesson and per-song metronome: v1. **DECIDED**
- Platform: PWA. **DECIDED**
- Confirm step: always confirm before teaching in v1. **DECIDED**
- Lesson shows a "view photo" overlay button; no permanent split view. **DECIDED**
- Multi-page overview: per-page parses + cheap text-only merge into one narrative. **DECIDED**
- Full-song playback: in v1 as the final milestone; progressive per-measure page transcription with green/red status; failed measures repaired via the crop-lesson flow. **DECIDED**
- Full-song playhead sweeps the app's rendered score (photo-overlay playhead deferred to v2). **DECIDED**
- Full-song modes: Both / Right hand / Left hand, with tempo control. **DECIDED**
