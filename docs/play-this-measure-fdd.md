# Play This Measure — Functional Design Document

> **I can name every note — but not the chord they make, the count they sit on, or which ones I'm still holding.**

*Audience: product validation and review. This document describes what the product does, not how it's built. For implementation details, see the TDD. For strategic context, see the Vision.*

## Product Summary

Play This Measure is a camera-first PWA that acts as a piano teacher organized around the pieces you're learning. You photograph a page of sheet music to create a **song project**; the app generates an overview lesson (key, scale, circle-of-fifths position, chord progression with names and Roman numerals, time signature, tempo, quirks). Whenever a measure stumps you at the bench, you photograph that measure; the app reads it, lets you confirm the reading, and teaches it back through a synchronized play-along — grand staff, color-coded press/hold blocks, beat counts, and sustained audio under one sweeping playhead — plus a plain-language explanation of the concept involved. Explained measures accumulate inside the song.

Beyond measure lessons, each song builds toward **full-song playback**: the page is progressively transcribed measure-by-measure in the background, and once measures validate, you can press play on the whole piece — a playhead sweeps the app's rendered score, with tempo control and right-hand-only / left-hand-only modes — so you can follow along and practice like you would with a teacher demonstrating. A per-song metronome covers ordinary practice in between.

The product's honesty principle: reading phone photos of notation is imperfect, so the app always shows its reading for confirmation before teaching, flags notes and measures it's unsure about, and validates rhythm arithmetic automatically (beats must sum to the time signature).

## User Journey

### Stage 0 — First open / empty state
A clean home screen with one primary action: **"Start a song."** A short hint explains the flow: photograph the page, then snap measures as you get stuck. A sample song (pre-loaded demo) lets the user explore the play-along before pointing a camera at anything.

### Stage 1 — Create a song
The user taps "Start a song" and photographs the **full page** (or picks from the photo library; more pages can be added any time). The app produces the **Song Overview lesson**:
- Title/composer if visible; user can edit.
- Key and scale, with a static **circle of fifths** graphic highlighting the song's key and its neighbors.
- The chord progression as a labeled list — chord names and Roman numerals — in page order. *(Example: for "Danny," the list Drew hand-wrote in the margin — G, G7/F, Am, C, Em/G, Fmaj7, Am7/E, Cmaj7, G(9) — appears automatically, each with its numeral and a one-line role.)*
- Time signature(s) and printed tempo.
- **Quirks to know:** short bullets for anything unusual ahead — meter changes (e.g., a 5/4 bar), recurring syncopation, passing chords.
For multi-page songs, each added page parses independently and a cheap text-only **merge** rewrites one unified overview narrative (full progression start to finish, sections noted).

In the background, the page also begins **progressive transcription** for full-song playback (Stage 7): each measure is read and validated; measures fill in green as they pass, red where the reading failed.

### Stage 2 — Hit a wall, snap the measure
From inside the song, the user taps **"Explain a measure"** and photographs a tight crop of the 1–2 confusing measures. A framing guide encourages a close, straight-on shot. The full-page photo from Stage 1 is automatically used as context (key/time/tempo), so the user only crops the confusing bit.

### Stage 3 — Reading (transient)
A brief processing state (~10–15 seconds) with the crop displayed. Behind the scenes the multi-stage pipeline reads the notation, validates the rhythm arithmetic, repairs if needed, and prepares the harmony/teaching layer.

### Stage 4 — Confirm the reading
The parsed result renders immediately as grand staff + rhythm blocks — the same visual language as the play-along. Banner: *"Here's what I read. Tap any note to fix it."* Low-confidence notes show a dotted outline. Minimal edits supported: change a note's duration, toggle a tie, nudge pitch by step, delete a note, add a note at a tapped position. **"Looks right → Teach me."** If the reading is badly off, **"Re-read"** retries with the user's corrections as hints. Confirmation is always required before teaching (no auto-teach in v1).

### Stage 5 — The measure lesson (the heart)
Top to bottom:
- **Concept chip + explanation** — names what's hard ("Tie into chord") and explains in a paragraph: which notes are held vs. struck, where the beat falls, what the chord is and how it sits in the progression (name + Roman numeral).
- **Tied / Re-struck toggle** (when ties are present).
- **Tempo slider** (40–100 BPM) + Play/Stop; loops by default.
- **Grand staff** — treble and bass, noteheads, stems, beams, flags, dots, tie arcs, chords; tied-into noteheads hollow-blue.
- **Rhythm-block grid** aligned beneath — one lane per concurrent voice; orange = strike, blue = held.
- Beat numbers above; "1 e & a" subdivisions below.
- **Gold playhead** sweeping staff and blocks together.
- **Keys-you-press counter** and **PRESS / HOLD** indicator ("Press 2" on chords).
- A small **"view photo"** button opens the original crop in an overlay for mapping back to the page (no permanent split view).
The lesson auto-saves into the song with a thumbnail of the crop.

### Stage 6 — Practice and accumulate
The song page shows the overview lesson, the metronome (tempo remembered per song), the transcription progress bar (green/red measures), and the growing list of explained measures, most recent first. Tapping a saved measure reopens its lesson instantly — no re-parse, no cost.

### Stage 7 — Play the whole song
Once enough measures validate (and any red ones are fixed), the song page's **Play** button opens the full-song player: the app's own rendered grand staff, scrolling horizontally, with a playhead sweeping measure by measure. Controls: tempo (40–110% of the printed tempo), **Both / Right hand / Left hand** mode, play/pause, and tap-a-measure to start there. Red (failed) measures display as gaps with a prompt: *"Snap this measure to fix it"* — the normal crop-lesson flow doubles as the repair tool, and a repaired measure slots into the song. Following along on the phone while playing from the paper is the core use.

## Synthesis Pipeline (Conceptual)

| Stage | Name | Purpose |
|---|---|---|
| S0 | Song Overview | Once per page, on the full-page photo: key, scale, progression with names + Roman numerals, meter, tempo, quirks. |
| S1 | Notation Read | Reads a cropped measure (full page as context) into structured notes: pitches, start ticks, durations, hands/voices. |
| S2 | Validation & Repair | Code-side arithmetic check: each voice must fill the measure per the time signature. On failure, re-prompts S1 with the specific error (max 2 attempts). Flags low-confidence notes. |
| S3 | Harmony & Teaching | Labels chords with name + Roman numeral in the song's key, identifies the concept, writes the plain-language explanation. |
| P1 | Page Transcription | Background, per page: reads all measures for full-song playback, each validated by S2's checker; failed measures marked red for crop-repair. |
| M1 | Overview Merge | Text-only; when a page is added, rewrites the unified multi-page overview narrative. |

Full prompts, models, and schemas are specified verbatim in the TDD.

## Output Format

Everything is in-app; v1 exports nothing except a JSON backup. The artifacts:
- **Song project**: overview lesson + circle-of-fifths graphic + metronome + transcription status + measure-lesson list + full-song player.
- **Measure lesson**: the interactive play-along + explanation, reopenable offline once created.

## Persistence Model

Local-first: all songs, lessons, photos (compressed), and parsed data live in IndexedDB on the device. **Installing to the home screen is the recommended mode** — it protects on-device storage on iOS; the JSON export/import backup covers the rest. The app shell is cached for offline use; only new parses require network. At infrastructure setup, a Neon Postgres is provisioned but dormant — v1 code never touches it; it is the prepared landing zone for v2 cloud sync.

## Quality Controls

- **Beat-sum validation** (S2) catches the most dangerous failure — a misread rhythm — automatically, for both crop lessons and page transcription.
- **Confirm-before-teach**: the user always sees the reading first; uncertain notes are visibly flagged.
- **Tap-to-fix editing** keeps correction faster than re-photographing.
- **Re-read with hints** when the parse is badly wrong.
- **Red-measure repair loop**: full-song playback never bluffs; unreadable measures are visible gaps the user fixes via the crop flow.
- **Cached parses**: a confirmed lesson never changes or re-bills.

## Cost Picture

API costs are per *new* parse only (reopens are free). Realistic scenarios at current pricing, using the strongest model for read stages:

| Scenario | Activity | Est. monthly cost |
|---|---|---|
| Light | 1 song (1 page transcribed) + 5 measure lessons | well under $1 |
| Typical | 2 songs (4 pages) + 20 measure lessons | ~$2–4 |
| Heavy | 4 songs (10 pages) + 100 measure lessons | ~$8–13 |

A full-page transcription runs ~$0.15–0.40 (it is the most token-heavy single operation). The user's own Anthropic API key powers the app in v1 (no hosted billing). The song page shows a small "this cost ~X¢" note after each parse.

## v1 Scope — In and Out

**In:**
- Song projects: full-page capture (multi-page supported), overview lesson per page + merged narrative, static circle of fifths (key + neighbors highlighted), editable title.
- Measure lessons: crop capture, multi-stage parse with validation, always-confirm with tap-to-fix editor, full play-along (grand staff, blocks, counts, playhead, tied/re-struck, tempo 40–100, sustained audio, press/hold indicator, view-photo overlay), concept + harmony explanation with Roman numerals.
- Grand staff (both hands) reading and rendering; chords; ties; dotted rhythms; straight eighths/sixteenths; rests (shown and counted).
- **Full-song playback** (final v1 milestone): progressive background page transcription with green/red status, scrolling rendered score, sweeping playhead, tempo control, Both/RH/LH modes, tap-to-start, red-measure crop-repair loop.
- Per-song metronome with remembered tempo.
- Local persistence (IndexedDB) + JSON export/import backup.
- PWA installability and offline reopening of saved content.

**Out (explicitly, to prevent scope creep):**
- Triplets/tuplets (parser declines gracefully and says why; affected measures flag red in full-song mode).
- Key-signature edge cases beyond common major/minor keys; double accidentals.
- Repeats, voltas, D.C./D.S. navigation; grace notes; trills/ornaments (full-song playback plays the page linearly).
- More than 2 measures per crop (app asks user to split).
- Playhead over the original photo (rendered score only in v1).
- Interactive circle of fifths; fingering suggestions; practice analytics.
- Cloud sync, accounts, sharing, multi-device.
- Audio recording or microphone features.
- MusicXML/MIDI import or export.
- Any non-piano instrument; any non-treble/bass clef.

**v2+ candidates:** see Vision → Future Roadmap.

## Success Criteria

1. From app open to a playing measure lesson in ≤ 60 seconds (including parse) on a real phone photo.
2. On a test set of 20 real crops from Drew's books: ≥ 16 parse correctly with zero edits after validation; the rest are fixable in ≤ 4 taps.
3. The Danny tie+chord measure produces: correct grand-staff rendering, correct hold-vs-strike blocks, "tie into chord" concept named, G7/F labeled with the right numeral.
4. The song overview for a Danny page reproduces Drew's hand-written margin chord list (or better) without help.
5. A Danny page transcribes to ≥ 80% green measures on first pass; every red measure is repairable via the crop flow; full-song playback then plays the page end-to-end with working RH/LH modes and no audible timing drift.
6. A saved lesson reopens offline, instantly, with audio working.
7. Metronome timing is steady (no audible drift over 5 minutes).

## Resolved Functional Questions

- Confirm step: **always confirm** in v1; no auto-teach setting. DECIDED
- Multi-page overview: **middle path** — per-page parses + text-only merge into one narrative. DECIDED
- Photo in lesson: **view-photo overlay button**, no permanent split view. DECIDED
- Full-song playback: **v1 final milestone**, playhead over **our rendered score**. DECIDED

## Open Functional Questions

- Full-song player layout on a phone: horizontal scroll of one long system vs. wrapped systems with auto-page-turn. (Leaning horizontal scroll; decide during build with real content.)
- Should the metronome optionally run *over* full-song playback, or stay a separate tool? (v1: separate; revisit.)
