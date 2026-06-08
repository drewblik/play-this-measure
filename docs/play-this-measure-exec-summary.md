# Play This Measure — Executive Summary

> **I can name every note — but not the chord they make, the count they sit on, or which ones I'm still holding.**

## The Idea

A camera-first PWA that acts as a piano teacher organized by the pieces you're learning. Photograph a page → the app builds a **song project** with an overview lesson: key, circle-of-fifths context, the chord progression with names and Roman numerals (automating the list Drew hand-writes in score margins), and quirks to watch. Photograph any measure that stumps you → it's read, confirmed, and taught back through a synchronized play-along: grand staff, orange-press / blue-hold rhythm blocks, beat counts, sustained audio, a tied-vs-re-struck toggle, and a plain-language explanation of the concept. Measures accumulate in the song; the page transcribes progressively in the background until the **whole song is playable** — sweeping playhead over the app's rendered score, tempo control, right-hand/left-hand modes — with a per-song metronome for ordinary practice. Depth and strategy: see the Vision.

## How It Works

A multi-stage Claude pipeline with honesty built in: a strong vision model reads the notation, code-side validation checks that every voice's rhythm sums to the time signature (re-prompting with the specific error on failure), the user always confirms the reading before being taught, and unreadable measures surface as visible red gaps repaired through the same crop flow. Stages: S0 song overview → S1 notation read → S2 validate/repair → S3 harmony & teaching, plus P1 background page transcription and M1 multi-page overview merge.

## Differentiation

- **Hold vs. strike as a visual language** — hollow-blue tied noteheads, press/hold blocks, "Press 2" indicators. No competitor renders this at all.
- **Teaches like a teacher** — Roman numerals, circle of fifths, concept naming, tied/re-struck audible contrast; PlayScore/Soundslice play and practice, they don't explain.
- **Song-as-project, confusion-triggered** — organized the way learning actually happens, at the bench, camera-first.
- **Honest about uncertainty** — validation loops and confirm-before-teach instead of confidently wrong rhythm.

## Stack & Cost

Vite + vanilla JS PWA on Vercel (GitHub auto-deploy set up as the first milestone, so development runs from a phone: prompt Claude Code → push → open the URL); the proven `tie-rhythm.html` engine (SVG notation + Web Audio) ported as the renderer; IndexedDB local persistence with JSON backup, plus a Neon Postgres provisioned dormant for v2 sync; one serverless proxy holding the Anthropic key. Models: Opus 4.8 ($5/$25 per MTok) for reading, Sonnet 4.6 ($3/$15) for teaching. Real usage lands at a few dollars a month: ~4–10¢ per measure lesson, ~$0.15–0.40 per page transcription; everything is cached so reopening is free.

## Strategic Play

Personal tool first; the moat is pedagogy, not technology. If it ever becomes a product, the compounding assets are the teaching design language, the concept library, and a correction corpus that improves parsing prompts.

## Status

Three design documents complete and audited. Ready to hand to Claude Code.

## Document Map

| Document | Audience | Purpose |
|---|---|---|
| `play-this-measure-vision.md` | Drew / future product thinking | Why this exists, prior art, differentiators, roadmap, decisions log |
| `play-this-measure-fdd.md` | Product review / QA | What it does: journeys, scope in/out, success criteria |
| `play-this-measure-tdd.md` | **Claude Code (authoritative)** | How to build it: stack, schemas, verbatim prompts, milestones, acceptance |
| `play-this-measure-exec-summary.md` | Anyone, first | This navigation hub |

For the build, hand Claude Code the **TDD (authoritative) + FDD (UX context) + `tie-rhythm.html` (the engine to port)**. The Vision is not needed for the build.
