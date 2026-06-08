# Play This Measure — Technical Design Document

*Audience: Claude Code. This document is authoritative for technical decisions. For product behavior and UX intent, see the FDD. Strategy lives in the Vision and is irrelevant to the build.*

*A working prototype of the core rendering + audio engine exists as `tie-rhythm.html` in this repo. Port it; do not rewrite it from scratch. Its hard-won notation fixes are listed in §7.*

## 1. Build Approach Recommendation

Build the renderer first, against hard-coded data. The riskiest external dependency (LLM photo parsing) should be integrated only after the renderer provably plays the notation schema correctly. Then build the measure-lesson loop end-to-end, then songs/persistence, then the confirm editor, then PWA packaging, and only last the full-song player (which reuses everything). Follow the milestone order in §15 exactly.

## 2. Stack

| Component | Choice |
|---|---|
| Frontend | Vite + vanilla JS (ES modules). No UI framework — the engine is framework-free DOM/SVG/Web Audio. |
| Styling | Plain CSS with custom properties; theme tokens in §6. Fonts: Fraunces + Newsreader via Google Fonts. |
| Audio | Web Audio API (no libraries). |
| Notation rendering | Hand-rolled SVG (ported from `tie-rhythm.html`). Do NOT add VexFlow/OSMD — the custom press/hold visual language requires our renderer. |
| Persistence | IndexedDB via the `idb` package (~1KB). |
| Database (dormant) | Neon Postgres, provisioned in M-1 with `DATABASE_URL` set in Vercel. **No v1 code path touches it** — reserved landing zone for v2 cloud sync. |
| LLM | Anthropic Messages API. Read stages: `claude-opus-4-8`. Teaching/merge stages: `claude-sonnet-4-6`. |
| API proxy | Vercel serverless function in the same repo (`/api/claude.js`). Holds the API key. |
| Hosting | Vercel (static PWA + the function). Free tier is sufficient. |
| PWA | `manifest.webmanifest` + hand-written service worker (cache-first app shell, network-only for `/api/*`). |

**package.json dependencies:** `idb` only. Dev: `vite`.

**Environment variables (Vercel):**
- `ANTHROPIC_API_KEY` — the only secret used by v1 code. Never shipped to the client.
- `DATABASE_URL` — Neon connection string, set during M-1 but **unused by v1 code** (v2 sync reserve).

**Run commands:** `npm run dev` (vite), `npm run build` (vite build), `vercel deploy`.

**Repo layout:**
```
/api/claude.js              # serverless proxy
/public/manifest.webmanifest
/public/icons/...
/src/main.js                # router + app shell
/src/db.js                  # IndexedDB layer (§3)
/src/engine/renderer.js     # staff + blocks + playhead (ported)
/src/engine/audio.js        # scheduler, tones, metronome (ported)
/src/engine/layout.js       # tick→x mapping, lane assignment
/src/parse/client.js        # calls /api/claude, stages S0–S3, P1, M1
/src/parse/validate.js      # beat-sum validator + repair-prompt builder
/src/parse/prompts.js       # verbatim prompts from §10
/src/ui/home.js  /song.js  /capture.js  /confirm.js  /lesson.js  /player.js
/src/ui/fifths.js           # static circle of fifths SVG
/src/sw.js                  # service worker
/tie-rhythm.html            # reference prototype (do not ship; port from it)
/docs/                      # FDD (UX reference)
```

## 3. Data Model (IndexedDB)

Database `ptm`, version 1. Concrete object stores — create exactly these:

```js
// db.js — inside upgrade(db):
const songs = db.createObjectStore('songs', { keyPath: 'id' });          // id: crypto.randomUUID()
songs.createIndex('byUpdated', 'updatedAt');

const pages = db.createObjectStore('pages', { keyPath: 'id' });
pages.createIndex('bySong', 'songId');
pages.createIndex('bySongIndex', ['songId', 'pageIndex'], { unique: true });

const measures = db.createObjectStore('measures', { keyPath: 'id' });
measures.createIndex('bySong', 'songId');
measures.createIndex('byPage', 'pageId');
measures.createIndex('bySongOrder', ['songId', 'orderInSong']);

const lessons = db.createObjectStore('lessons', { keyPath: 'id' });
lessons.createIndex('bySong', 'songId');
lessons.createIndex('byCreated', 'createdAt');

db.createObjectStore('blobs', { keyPath: 'id' });     // photos, keyed by content hash
db.createObjectStore('cache', { keyPath: 'hash' });   // parse cache: hash → response JSON
db.createObjectStore('settings', { keyPath: 'key' }); // {key, value}
```

**Record shapes (enforce in code comments, not a schema lib):**

```js
// songs:    { id, title, composer, createdAt, updatedAt, keyRoot, mode,            // 'G','major'
//             overviewMerged,         // markdown string from M1 (or single page S0)
//             practiceTempoBpm, printedTempoBpm, timeSignature }                    // '4/4'
// pages:    { id, songId, pageIndex, photoBlobId, thumbDataUrl,
//             overview,               // S0 JSON (§10.1 output)
//             transcription: { status: 'idle'|'running'|'done',
//                              greenCount, redCount } }
// measures: { id, songId, pageId, orderInSong, source: 'page'|'crop',
//             status: 'green'|'red'|'pending',
//             notation,               // NOTATION JSON (§4) — null when red
//             failReason }            // string when red
// lessons:  { id, songId, measureIds: [..], createdAt, cropBlobId, thumbDataUrl,
//             notation,               // confirmed NOTATION JSON
//             teaching }              // S3 JSON (§10.3 output)
// blobs:    { id, blob }              // id = SHA-256 hex of bytes
// cache:    { hash, stage, response, createdAt }   // hash = SHA-256(stage + image hashes + context)
```

JSON backup export = one file containing all stores except `blobs` raw images (include thumbnails only); import replaces stores after confirmation.

## 4. NOTATION JSON Contract

The interface between parsing and rendering. The renderer must consume exactly this; the prompts in §10 must produce exactly this.

```jsonc
{
  "timeSignature": "4/4",        // "n/d"
  "ticksPerBeat": 4,             // sixteenth grid. (Triplets unsupported v1 — see §13.)
  "measures": 1,                 // 1 or 2 for crops; 1 for page-transcription units
  "voices": [
    {
      "hand": "right",           // "right" | "left"
      "notes": [
        // startTick from the start of the first rendered measure.
        // A tie = ONE note whose durTicks crosses a beat boundary; the renderer
        // splits at beats and draws the arc. No explicit tie flags.
        // A chord = multiple notes sharing startTick within one voice.
        // A rest = pitch "rest" occupying its ticks (rendered as rest glyph, counted).
        { "pitch": "E5", "startTick": 4, "durTicks": 8, "confidence": 0.95 },
        { "pitch": "rest", "startTick": 12, "durTicks": 4, "confidence": 0.9 }
      ]
    },
    { "hand": "left", "notes": [ /* ... */ ] }
  ]
}
```

Pitch is scientific notation `A0`–`C8`, sharps as `F#4`, flats as `Bb3`. Renderer maps pitch → diatonic staff step (+ accidental glyph) and → frequency (equal temperament, A4 = 440).

## 5. Validation (S2) — code, not model

```js
// validate.js
export function validateNotation(n) {
  const errors = [];
  const [num, den] = n.timeSignature.split('/').map(Number);
  const ticksPerMeasure = n.ticksPerBeat * num * (4 / den);
  const total = ticksPerMeasure * n.measures;
  for (const v of n.voices) {
    const sorted = [...v.notes].sort((a, b) => a.startTick - b.startTick);
    // group simultaneous starts (chords); track coverage per voice timeline
    let cursor = 0;
    const starts = [...new Set(sorted.map(x => x.startTick))];
    for (const s of starts) {
      if (s < cursor) errors.push(`${v.hand}: overlapping events at tick ${s}`);
      if (s > cursor) errors.push(`${v.hand}: gap from tick ${cursor} to ${s} (missing rest?)`);
      const group = sorted.filter(x => x.startTick === s);
      const durs = new Set(group.map(x => x.durTicks));
      if (durs.size > 1 && group.some(x => x.pitch !== 'rest'))
        errors.push(`${v.hand}: chord at tick ${s} has mismatched durations`);
      cursor = s + Math.max(...group.map(x => x.durTicks));
    }
    if (cursor !== total)
      errors.push(`${v.hand}: voice fills ${cursor} ticks but measure needs ${total}`);
  }
  for (const v of n.voices) for (const x of v.notes) {
    if (x.pitch !== 'rest' && !/^[A-G][#b]?[0-8]$/.test(x.pitch))
      errors.push(`bad pitch "${x.pitch}"`);
    if (x.durTicks <= 0) errors.push(`non-positive duration at tick ${x.startTick}`);
  }
  return { ok: errors.length === 0, errors, total };
}
```

On `!ok`: rebuild the S1 call with the repair suffix (§10.2), max **2** repair attempts, then mark red / surface to user.

## 6. Theme Tokens (port exactly)

```css
:root { --paper:#f3ece0; --paper-2:#ece2d2; --ink:#1d1a16; --ink-soft:#5a5147;
        --rule:#cabfa9; --attack:#bb3e03; --attack-soft:#e9b08e;
        --hold:#3a6073; --hold-soft:#aac4cf; --gold:#9a7b22; }
```
Orange `--attack` = strike/press. Blue `--hold` = held/tied. Gold = playhead. Fraunces for display, Newsreader for body.

## 7. Renderer Port — Non-Negotiable Gotchas

Port from `tie-rhythm.html`. These bugs were already paid for; do not re-introduce them:

1. **Notehead tilt**: wrap the ellipse in `<g transform="rotate(-18 x y)">`. NEVER a CSS transform on the ellipse — it mis-pivots and flings heads off-staff.
2. **Tie rendering**: split any note at beat boundaries into segments; draw the arc between consecutive segments; the tied-*into* head renders hollow with `--hold` stroke ("written, don't re-press"). Audio does NOT split in tied mode (one sustained tone), DOES split in re-struck mode.
3. **Chord** = noteheads sharing one stem (stem spans top to bottom head + 30px).
4. **Lane assignment** for blocks: greedy overlap-based — a note joins the first lane with no time overlap; chords therefore stack lanes, monophonic stays in one.
5. **Audio scheduler**: lookahead pattern (100ms lookahead, 25ms interval timer), notes scheduled at exact AudioContext times. Sustain envelope: attack 12ms to peak, hold near peak, release in the final ~10% so long/tied notes audibly ring full length.
6. **Beams**: group flagged notes (dur < 1 beat) within the same beat; primary beam at lowest-head-Y + 30; sixteenth stubs as secondary beams. Dotted = dur 3 ticks → augmentation dot.
7. **Verify geometry before declaring done**: render known fixtures and screenshot-compare; noteheads must sit on lines/spaces.

**New in this build (extend the port):** bass clef staff below treble (bass yOf maps diatonic steps for F-clef; A3 = middle of staff region), ledger lines below as well as above, accidental glyphs (♯ ♭ ♮) left of the head, rest glyphs (whole/half/quarter/eighth/sixteenth) positioned mid-staff, and a `createLab(container, opts)` module API:

```js
const lab = createLab(el, { notation, tempoBpm, mode: 'tie'|'restruck',
                            hands: 'both'|'right'|'left', onTick });
lab.play(); lab.stop(); lab.setTempo(b); lab.setMode(m); lab.setHands(h); lab.destroy();
```

## 8. UI Structure

Single-page app, hash router. **Phone-first throughout:** single-column layouts, touch targets ≥ 44px, controls reachable one-handed, designed for use standing at a piano; desktop just gets a centered column. Views:

| Route | View | Responsibilities |
|---|---|---|
| `#/` | Home | Song cards (thumb, title, progress), "Start a song", demo song, settings (export/import JSON, proxy URL). |
| `#/song/:id` | Song | Overview lesson (merged markdown), circle of fifths, metronome (play/stop, BPM stepper, persists `practiceTempoBpm`), transcription progress bar (green/red), "Explain a measure" button, lesson list, "Play full song" button (enabled when ≥1 green measure). |
| `#/capture/:songId?mode=page\|crop` | Capture | `<input type="file" accept="image/*" capture="environment">`, downscale client-side (§9), framing hint for crops. |
| `#/confirm/:lessonDraftId` | Confirm | Renders parsed notation via `createLab` (paused); dotted outline on confidence < 0.7; tap note → bottom sheet: duration picker (16th/8th/dotted-8th/quarter/dotted-quarter/half/whole), tie toggle (merges with next same-pitch note / splits), pitch ▲▼ (diatonic step), delete; tap empty grid slot → add note; "Re-read" (sends corrections as hints); "Teach me" → runs S3 → lesson. |
| `#/lesson/:id` | Lesson | Concept chip + explanation, tied/re-struck toggle, tempo slider 40–100, `createLab` full UI, view-photo overlay, cost note. |
| `#/play/:songId` | Full-song player | §12. |

## 9. Image Handling

- Downscale client-side before upload: long edge ≤ **1568px**, JPEG quality 0.85 (matches Anthropic vision sweet spot, keeps tokens/cost down).
- Hash (SHA-256) the downscaled bytes; store blob by hash; check `cache` store before any API call — identical stage+inputs never re-bills.
- Thumbnails: 320px long edge data-URLs stored inline on records.

## 10. Synthesis Pipeline — Verbatim Prompts

All calls go through `/api/claude.js` (§11). All stages demand **strict JSON output**; strip markdown fences defensively before `JSON.parse`; on parse failure retry once with "Your previous output was not valid JSON. Output ONLY the JSON object." appended.

### 10.1 S0 — Song Overview (model: `claude-opus-4-8`, max_tokens 2000)
Input: full-page image. System prompt verbatim:

```
You are an expert piano teacher and a careful reader of printed sheet music. You are looking at a photo of one page of a piano score. Produce a structured overview lesson for an adult intermediate student.

Output ONLY a JSON object, no prose, no markdown fences, matching exactly:
{
  "title": string|null, "composer": string|null,
  "keyRoot": string,            // e.g. "G"
  "mode": "major"|"minor",
  "timeSignature": string,      // e.g. "4/4"; if it changes, the FIRST one
  "meterChanges": string[],     // e.g. ["one 5/4 bar near the end of system 3"]
  "printedTempoBpm": number|null,
  "tempoMarking": string|null,  // e.g. "Moderately slow"
  "chordProgression": [         // in page order, deduplicated consecutive repeats
    { "name": string,           // e.g. "G7/F"
      "roman": string,          // Roman numeral in the song's key, e.g. "V7/IV (third inversion)" — keep concise
      "role": string }          // one short plain-language sentence on its function
  ],
  "quirks": string[],           // 2-5 short bullets: meter changes, syncopation patterns, passing chords, anything an intermediate player should know before starting
  "confidence": number          // 0-1 your overall confidence reading this page
}

Rules: Use printed chord symbols when present; otherwise infer from the notation. Roman numerals are relative to keyRoot/mode. Plain language; no jargon without a gloss. If the photo is not sheet music, return {"error":"not sheet music"}.
```

### 10.2 S1 — Notation Read (model: `claude-opus-4-8`, max_tokens 3000)
Input: TWO images — first the tight crop, second the full page — plus a context line. System prompt verbatim:

```
You are a meticulous optical music reader. Image 1 is a tight photo crop of ONE or TWO measures of piano grand staff. Image 2 is the full page, provided ONLY for context (key signature, time signature, accidentals carried by the key). Read ONLY the measures in Image 1.

Context: {CONTEXT_LINE}   // e.g. key G major, time 4/4, from song "Danny"

Output ONLY a JSON object, no prose, no fences, matching exactly this schema:
{
  "timeSignature": "n/d",
  "ticksPerBeat": 4,
  "measures": 1|2,
  "voices": [
    { "hand": "right"|"left",
      "notes": [ { "pitch": "C4"|"F#5"|"Bb3"|"rest", "startTick": int, "durTicks": int, "confidence": 0-1 } ] }
  ]
}

Hard rules:
- ticksPerBeat is 4 (sixteenth-note grid). startTick counts from 0 at the start of the first measure in Image 1.
- A tied pair of notes is ONE note object whose durTicks is the combined sounding length. Never emit two objects for a tie.
- A chord is multiple note objects with the SAME startTick in the same voice, equal durTicks.
- Rests are explicit objects with pitch "rest". Every voice's events must exactly fill measures × beats × ticksPerBeat ticks with no gaps and no overlaps.
- Apply the key signature from Image 2 to pitches (e.g., in G major an unmarked F is F#).
- Treble staff notes belong to hand "right", bass staff to hand "left", regardless of where hands might actually play them.
- If a note is hard to read, give your best guess with low confidence rather than omitting it.
- If Image 1 contains triplets or tuplets, return {"error":"tuplet","detail":"<where>"}. If it contains more than 2 measures, return {"error":"too many measures"}.
```

**Repair suffix** (appended as an extra user message on validation failure, max 2 attempts):

```
Your previous reading failed arithmetic validation with these errors:
{ERRORS_BULLETED}
The measure must total exactly {TOTAL} ticks per voice. Re-read Image 1 carefully and output the corrected JSON only.
```

**Re-read-with-hints** (user-initiated from Confirm): same as repair, but errors replaced by `The user says: {USER_HINTS}` where hints are generated from their edits (e.g., "the second right-hand note is a quarter note, not an eighth").

### 10.3 S3 — Harmony & Teaching (model: `claude-sonnet-4-6`, max_tokens 1500)
Input: text only — the validated NOTATION JSON + song context. System prompt verbatim:

```
You are a warm, plain-spoken piano teacher. A student photographed measures they could not read; the notation has been parsed into JSON below. Teach them this passage.

Song context: key {KEY_ROOT} {MODE}, time {TIME_SIG}, chord progression so far: {PROGRESSION_NAMES}.

Notation JSON:
{NOTATION_JSON}

Output ONLY a JSON object:
{
  "chords": [ { "atBeat": number, "name": string, "roman": string, "memberPitches": string[] } ],
  "conceptId": "ties-held"|"syncopation"|"tie-into-chord"|"dotted-rhythm"|"hand-independence"|"rests"|"chord-reading"|"mixed",
  "conceptName": string,        // short human label, e.g. "Tie into chord"
  "explanation": string,        // ONE paragraph, 4-7 sentences, plain language. MUST cover: which notes are struck vs held (name them), where each press lands in the count ("the and of 2"), what the chord is and its Roman numeral role in the progression, and one concrete practice tip for this exact spot.
  "countingLine": string        // the spoken count with presses bolded in **asterisks**, e.g. "1 e & a **2** e & **a** 3 ..."
}

Identify chords from simultaneous and arpeggiated pitches plus context. Roman numerals relative to the given key. Never invent notes not in the JSON.
```

### 10.4 P1 — Page Transcription (model: `claude-opus-4-8`, max_tokens 8000)
Input: full-page image. Runs in the background after S0; results validated per measure by §5. System prompt verbatim:

```
You are a meticulous optical music reader transcribing a full page of piano grand staff for playback. Read every measure in order (left to right, system by system).

Context: {CONTEXT_LINE}

Output ONLY a JSON object:
{
  "timeSignature": "n/d",
  "ticksPerBeat": 4,
  "measureList": [
    { "index": int,             // 0-based across the whole page
      "system": int,            // 0-based system (line) on the page
      "timeSignature": "n/d",  // only if it CHANGES at this measure, else omit
      "voices": [ { "hand": "right"|"left", "notes": [ {"pitch": ..., "startTick": ..., "durTicks": ..., "confidence": ...} ] } ]
    }
  ]
}

Rules are identical to single-measure reading: ties are one note with combined duration; chords share startTick; rests explicit; each measure's voices exactly fill that measure's ticks; startTick resets to 0 in each measure; apply the key signature. For any measure containing tuplets or that you cannot read, emit it as { "index": n, "system": s, "unreadable": "<one-line reason>" } and continue.
```

Client-side: validate each measure independently; failures and `unreadable` entries → `status:'red'` with `failReason`; repairs happen ONLY via the user crop flow (a confirmed crop lesson whose page-position the user picks replaces the red measure — keep this association UI dead simple: tapping a red measure launches capture pre-linked to that slot).

### 10.5 M1 — Overview Merge (model: `claude-sonnet-4-6`, max_tokens 1500, text-only)

```
You are a piano teacher writing one unified overview of a multi-page piece from per-page notes. Combine the page overviews below into a single flowing lesson in markdown (no JSON): key and circle-of-fifths context first, then the progression as it travels through the piece (names + Roman numerals inline), then a short "quirks to watch" list. Do not repeat identical chords page by page; describe the journey. 180-300 words.

Page overviews (JSON, in order):
{PAGE_OVERVIEWS_JSON}
```

## 11. API Proxy & Call Pattern

`/api/claude.js` (Vercel serverless), verbatim core:

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { model, system, messages, max_tokens } = req.body;
  const ALLOWED = new Set(['claude-opus-4-8', 'claude-sonnet-4-6']);
  if (!ALLOWED.has(model)) return res.status(400).json({ error: 'model not allowed' });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json',
               'x-api-key': process.env.ANTHROPIC_API_KEY,
               'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system, messages, max_tokens })
  });
  const data = await r.json();
  res.status(r.status).json(data);
}
```

Client pattern (`parse/client.js`):

```js
async function callStage({ model, system, userBlocks, maxTokens }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(PROXY_URL, { method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({ model, system, max_tokens: maxTokens,
          messages: [{ role: 'user', content: userBlocks }] }) });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      const data = await r.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) { if (attempt === 2) throw e; await sleep(1500 * (attempt + 1)); }
  }
}
// image block: { type:'image', source:{ type:'base64', media_type:'image/jpeg', data } }
```

Token usage from `data.usage` → compute and store cost per call for the "this cost ~X¢" note (rates: opus $5/$25, sonnet $3/$15 per MTok — keep in one constants file).

## 12. Full-Song Player

- Data: ordered green measures for the song (`bySongOrder`). Concatenate into one long timeline; per-measure `timeSignature` changes respected (the 5/4 bar gets 20 ticks).
- Rendering: one horizontally-scrolling strip — the grand staff drawn measure-by-measure by the same renderer, measures separated by barlines, `transform: translateX` scroll driven by the playhead with easing; tap any measure to seek.
- Red measures render as a hatched gap with width of one measure + "Snap to fix" affordance (launches capture pre-linked, §10.4).
- Transport: play/pause; tempo slider expressed as % of `printedTempoBpm` (40–110%, default 60%); hands toggle Both/RH/LH → `lab.setHands` mutes the other voice's scheduling and dims its lane/staff.
- Audio: same scheduler; pre-schedule only a 2-measure window ahead to keep seek cheap.
- The metronome tool remains separate from the player in v1.

## 13. Heuristics & Thresholds

| Thing | Value |
|---|---|
| Image long edge | 1568px, JPEG q0.85 |
| Low-confidence flag | confidence < 0.7 → dotted outline in Confirm |
| Repair attempts (S2 loop) | 2, then fail to user |
| JSON-retry on malformed output | 1 |
| Network retries (429/5xx) | 3 with linear backoff 1.5s, 3s |
| Max measures per crop | 2 (S1 errors beyond) |
| Tempo range, lessons | 40–100 BPM; default 60 |
| Tempo range, full song | 40–110% of printed; default 60% |
| Page transcription trigger | automatically after S0 succeeds; resumable; one page at a time |
| Full-song Play enabled | ≥ 1 green measure (gaps shown for the rest) |
| Thumbnail size | 320px long edge |
| Cost note display | after every billed call, rounded to the cent |

## 14. Error Handling

- **Stage-level**: S0/S1/P1 `{"error": ...}` payloads → user-facing message keyed by error (`not sheet music`, `tuplet`, `too many measures`) with the FDD's graceful-decline copy.
- **Validation-level**: after 2 repairs, Confirm opens anyway with errors listed and the worst voice highlighted — the user can often fix in 2 taps what the model couldn't.
- **Network-level**: offline → queue nothing; show "parsing needs a connection; saved lessons still work."
- **Quota/auth**: 401/403 from proxy → settings hint to check the deployed key.
- **Output validation**: every stage's JSON checked for required keys before use; missing keys → treated as malformed (one retry).
- **Audio**: AudioContext must resume on first user gesture (iOS); guard every play() with `ensureCtx()`.

## 15. Build Order (Milestones)

0. **M-1 — Dev infrastructure (do first).** Create the GitHub repo; link a Vercel project with auto-deploy on push to `main` and preview deployments per branch; set `ANTHROPIC_API_KEY`; create the Neon project and set `DATABASE_URL` (dormant — write a one-line README note that v1 never uses it); scaffold a hello-world installable PWA and deploy; verify it installs and loads on Drew's iPhone from the production URL. Document in the README: **real data lives on the production URL only** — preview URLs have separate on-device storage, use them for feature testing, and the development loop is: drive Claude Code (incl. from the mobile app) → push → Vercel deploys → open on phone.
1. **M0 — Engine extraction.** Port `tie-rhythm.html` into `engine/` modules with the `createLab` API, driven by the §4 schema. Includes grand staff (bass clef), rests, accidentals, hands param. Fixture page renders 6 hard-coded notations including the Danny tie+chord case.
2. **M1 — Renderer proof.** Visual/audio check of all fixtures; geometry verified (heads on lines/spaces); tied vs re-struck audibly correct; sustain correct. *Do not proceed until this is right.*
3. **M2 — Measure-lesson loop.** Proxy deployed; capture (file input) → downscale/hash → S1 → S2 validate/repair → minimal Confirm (display + flags + Teach button) → S3 → Lesson view. **A real photographed measure teaches end-to-end at this point.**
4. **M3 — Songs & persistence.** IndexedDB layer; Home + Song views; S0 overview; circle-of-fifths SVG (static, key + neighbors highlighted); metronome; multi-page add + M1 merge; JSON export/import; parse cache.
5. **M4 — Confirm editor.** Tap-to-fix: duration, tie toggle, pitch nudge, delete, add; re-read with hints.
6. **M5 — PWA.** Manifest, icons, service worker (cache-first shell, network-only API), installable, saved lessons open offline.
7. **M6 — Full-song player.** P1 page transcription with progressive green/red; red-measure crop-repair linkage; scrolling score; transport with hands modes; per-measure meter changes. **Final v1 milestone.**
8. **M7 — Polish.** Empty states, demo song, cost notes, error copy, high-contrast toggle.

## 16. First-Time UX

Home empty state: one illustrated card — "Photograph a page of sheet music to start your first song" — plus a "Try the demo song" link loading a bundled fixture song (no network) so the lesson and player UX are explorable before any API setup. Settings page surfaces the proxy URL with a one-line deploy hint.

## 17. Cost Surfacing

| Operation | Calls | Typical tokens (in/out) | Est. cost |
|---|---|---|---|
| Measure lesson (S1+S2 repair avg 0.5+S3) | 2–3 | ~5k / ~2k | $0.04–0.10 |
| Song overview S0 | 1 | ~2k / ~1k | $0.03–0.05 |
| Page transcription P1 | 1 (+repairs via user) | ~2.5k / ~6k | $0.15–0.30 |
| Overview merge M1 | 1 | ~2k / ~0.5k | < $0.02 |

Show the actual computed figure from `usage` after each call; show a per-song running total on the Song view.

## 18. Edge Cases & Limitations

**Accepted v1 limitations:** no tuplets (red/declined with reason); no repeats/voltas/ornaments (page plays linearly; ornaments read as plain notes if the model does so); common keys only (heavy accidental passages may flag red); pedal markings ignored; dynamics ignored in audio; lyrics ignored.
**Hard fail (clear message, no output):** photo is not sheet music; crop wider than 2 measures; tuplet in a crop.
**Soft fail (degrade gracefully):** low-confidence notes (flagged, user confirms); red measures in full-song (gaps + repair affordance); unreadable title/composer (user edits); missing printed tempo (default 80, user-adjustable).

## 19. Acceptance Criteria

1. All M1 fixtures render with correct geometry and play with correct rhythm in both tied and re-struck modes; long notes audibly sustain.
2. The Danny tie+chord crop (provided in repo test assets) parses, validates, and produces: hollow-blue tied head with two solid struck heads on one stem, "tie-into-chord" conceptId, G7/F with a sensible Roman numeral.
3. A full Danny page reaches ≥ 80% green on first P1 pass; tapping a red measure launches a pre-linked crop capture; the repaired measure turns green and plays in sequence.
4. Full-song playback: correct order, 5/4 bar gets five beats, RH/LH modes mute correctly, no audible drift over the page.
5. Validation catches a deliberately corrupted notation (gap, overlap, wrong total) with specific per-voice errors.
6. Lessons reopen offline after install; reopening never triggers an API call (cache hit verified).
7. JSON export → wipe → import restores songs, lessons, and thumbnails.
8. No API key reachable from client code or network tab; proxy rejects non-allowlisted models.
