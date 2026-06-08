---
name: renderer-gotchas
description: Use when working on the rendering or audio engine for Play This Measure — porting from tie-rhythm.html, or editing src/engine/ (renderer.js, audio.js, layout.js, createLab). These bugs were already paid for in the prototype; re-introducing them is the main risk of the port.
---

# Renderer/audio port — non-negotiable gotchas

**Source of truth:** `docs/play-this-measure-tdd.md` §7 and the working prototype `tie-rhythm.html`. **Port the prototype; do not rewrite it.** When extending, diff against the prototype rather than authoring fresh.

## The seven (§7)
1. **Notehead tilt:** wrap the ellipse in `<g transform="rotate(-18 x y)">`. **NEVER** a CSS transform on the ellipse — it mis-pivots and flings heads off-staff.
2. **Tie rendering:** split any note at beat boundaries into segments; draw the arc between consecutive segments; the tied-*into* head renders **hollow** with `--hold` stroke ("written, don't re-press"). Audio does **NOT** split in tied mode (one sustained tone); **DOES** split in re-struck mode.
3. **Chord** = noteheads sharing one stem (stem spans top to bottom head + 30px).
4. **Lane assignment** (blocks): greedy overlap-based — a note joins the first lane with no time overlap; chords stack lanes, monophonic stays in one.
5. **Audio scheduler:** lookahead pattern — 100ms lookahead, 25ms interval timer; notes scheduled at exact AudioContext times. Sustain envelope: attack 12ms to peak, hold near peak, release in the final ~10% so long/tied notes audibly ring full length.
6. **Beams:** group flagged notes (dur < 1 beat) within the same beat; primary beam at lowest-head-Y + 30; sixteenth stubs as secondary beams. Dotted = dur 3 ticks → augmentation dot.
7. **Verify geometry before declaring done:** render known fixtures and screenshot-compare; noteheads must sit on lines/spaces.

## New in this build (extend the port, §7)
- Bass clef staff below treble (F-clef yOf; A3 = middle of bass region); ledger lines **below** as well as above.
- Accidental glyphs (♯ ♭ ♮) left of the head; rest glyphs (whole/half/quarter/eighth/sixteenth) mid-staff.
- `createLab(el, { notation, tempoBpm, mode:'tie'|'restruck', hands:'both'|'right'|'left', onTick })` → `play() stop() setTempo(b) setMode(m) setHands(h) destroy()`.

## Always
- Guard every `play()` with `ensureCtx()` — AudioContext must resume on first user gesture (iOS), §14.
- Drive everything from the §4 schema (see [[notation-schema]] / the notation-schema skill), not the prototype's internal `{s,l,f}` shape.
