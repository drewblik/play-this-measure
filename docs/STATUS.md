# Play This Measure — Build Status / Session Handoff

_Last updated: 2026-06-08. This file is the cross-session handoff (it lives in the
repo so a session started from any device has full context). Authoritative spec
is `play-this-measure-tdd.md`; UX context is `play-this-measure-fdd.md`._

## Where we are
- **M-1 (dev infrastructure): ✅ complete.** Repo + Vercel auto-deploy + env vars + dormant Neon + installable PWA, verified on Drew's iPhone.
- **M0 (engine extraction): ✅ complete & signed off.** `tie-rhythm.html` ported into `src/engine/` (`layout.js`, `audio.js`, `renderer.js`, `index.js`) behind `createLab`, driven by the §4 schema; 6 fixtures at **/fixtures.html**; `npm test` (jsdom smoke) green. The last open item (iOS replay/switch playback) is **resolved** — Drew confirmed on 2026-06-08 that both a second play of the same fixture (A) and play-after-switch (B) work.
- **Production:** https://play-this-measure.vercel.app — engine fixtures at **/fixtures.html**.
- **Dev loop (no laptop needed):** edit → commit → push to `main` → Vercel auto-deploys → open the production URL on the phone. Each branch also gets a Vercel preview. Real data lives on the production URL only (preview URLs have separate on-device storage).

## OPEN
None. (Resolved last session: iOS "stuck after replay/switch" — the fix in `index.js` `start()` defers scheduling into `ctx.resume().then(begin)` with a `wantPlay` guard, and `ensureCtx` resumes from any non-running state. Drew's A/B test on the iPhone confirmed both replay and play-after-switch on 2026-06-08.)

## Next milestone: M1 — renderer proof / geometry  ← START HERE
First task: **clef-aware y-mapping.** `renderer.js` `yOf()` applies the grand-staff `GRAND_GAP` based on diatonic `d < 28` (below middle C), NOT on which clef/voice owns the note — so a right-hand note below middle C (B3/A3/middle-C area) drops ~24px into the bass region. No fixture triggers it, but real music will at M2/M6. Make the y-mapping clef/voice-aware. Then: precise note-on-line placement, clef vertical centering, inter-staff spacing, screenshot-compare against fixtures. Also: clef selection by present voices (a bass-only measure currently draws an empty treble staff). Lower priority: compound-meter count labels; grid/countrow PAD alignment; `setMode` restarting transport while playing.

## Key decisions & findings
- **Danny tie+chord** is modeled as **two right-hand voices** (§5 forbids within-voice overlap; "hold one note while striking others at a different tick" is polyphony, not a chord). Implication for **M2**: the §10.2 S1 prompt only describes chords + ties, not hold-while-strike — producing a §5-valid reading may need two RH voices. **Do not edit the verbatim §10 prompts without Drew.**
- Sustained notes render as **beat-segmented tied heads** (a half note → two tied quarter heads) per §7 #2 — intentional (beat pedagogy).

## How Drew wants this built (working rules)
- `play-this-measure-tdd.md` is authoritative for technical decisions; FDD is supporting UX. **Port `tie-rhythm.html`, do not rewrite.** Use the §10 prompts **verbatim** and the §3–4 schemas **unchanged**.
- Build in TDD §15 milestone order. **Plan each milestone and show it before implementing; stop for Drew's review at the end of every milestone. Ask before guessing.**
- **Every time testing is needed, give exact numbered step-by-step test steps with expected results** (Drew tests on a real iPhone via Safari at the production URL; tell him to pull-to-refresh to bypass the cached shell).
- Project skills in `.claude/skills/` (`notation-schema`, `renderer-gotchas`, `stage-prompts`) encode the non-negotiables — read them when touching that area.

## Infrastructure (no secrets here — they live only in Vercel)
- **GitHub:** github.com/drewblik/play-this-measure (public). Commits use the noreply email `53955877+drewblik@users.noreply.github.com`.
- **Vercel:** team/scope `drewbliks-projects`, project `play-this-measure`; GitHub-connected, auto-deploy on push to `main` + preview per branch; framework Vite.
- **Neon (dormant):** org `org-quiet-breeze-30209937`, project `play-this-measure` (`mute-king-78357817`), pg17. `DATABASE_URL` set in Vercel (Production + Development) but **v1 code never touches it**.
- **Env vars in Vercel:** `ANTHROPIC_API_KEY` (server-only, used by `/api/claude.js` from M2) and `DATABASE_URL` (dormant).
- **Local-only (not portable to a cloud session):** a portable `gh` under `%LOCALAPPDATA%\ptm-tools`, global `vercel`/`neonctl` CLIs, and the cross-session memory under `~/.claude`. A cloud/phone session doesn't need these for the core loop — pushing to GitHub triggers the Vercel deploy.

## Commands
`npm install` · `npm run dev` · `npm run build` · `npm test` (jsdom smoke) · `npm run gen:icons`. The `/api/claude.js` proxy only runs on Vercel (needs `ANTHROPIC_API_KEY`); use `vercel dev` to exercise it locally from M2.
