# Play This Measure — Build Status / Session Handoff

_Last updated: 2026-06-08. This file is the cross-session handoff (it lives in the
repo so a session started from any device has full context). Authoritative spec
is `play-this-measure-tdd.md`; UX context is `play-this-measure-fdd.md`._

## Where we are
- **M-1 (dev infrastructure): ✅ complete.** Repo + Vercel auto-deploy + env vars + dormant Neon + installable PWA, verified on Drew's iPhone.
- **M0 (engine extraction): ✅ complete & signed off.** `tie-rhythm.html` ported into `src/engine/` (`layout.js`, `audio.js`, `renderer.js`, `index.js`) behind `createLab`, driven by the §4 schema; 7 fixtures at **/fixtures.html**; `npm test` (jsdom smoke) green. iOS playback hardened (see resolved items below).
- **M1 (renderer proof / geometry): ✅ complete & signed off (2026-06-08).** Clef-aware y-mapping (`yOf(d, clef)` per-clef ladders), clef selection by present voices (no empty staves), the `treble-low` proof fixture, count-row + gridline PAD alignment, and `setMode` mid-play continuity. All confirmed by Drew on the iPhone.
- **Production:** https://play-this-measure.vercel.app — engine fixtures at **/fixtures.html**.
- **Dev loop (no laptop needed):** edit → commit → push to `main` → Vercel auto-deploys → open the production URL on the phone. Each branch also gets a Vercel preview. Real data lives on the production URL only (preview URLs have separate on-device storage).

## OPEN
None. (Confirmed by Drew on the iPhone, 2026-06-08: **iOS audio context hardening round 2** — `audio.js` `ensureCtx()` keeps the cached context only while actively running and otherwise rebuilds a fresh one inside the play gesture; `dropCtx()` invalidates it; `index.js` arms a 450ms frozen-clock watchdog that drops the context + stops so the next tap rebuilds. Sound is now reliable through fixture switching and leave/return. The round-1 `resume().then(begin)` + `wantPlay` guard remains underneath.)

## Next milestone: M2 — audio → notation (first Claude API feature)  ← START HERE
The §10.2 stage prompts turn a recorded/described performance into a §4 NOTATION object the engine already renders. This is the first feature that calls Claude, via the server-only `/api/claude.js` proxy (needs `ANTHROPIC_API_KEY`, set in Vercel; use `vercel dev` to exercise locally). **Plan M2 and show it before implementing; use the §10 prompts verbatim and the §3–4 schemas unchanged (read the `stage-prompts` + `notation-schema` skills first).** Watch the Danny implication: the §10.2 S1 prompt describes chords + ties but not hold-while-strike, which a §5-valid reading may need as two RH voices.

## M1 — renderer proof / geometry (✅ complete, detail)
**Drew confirmed "Low right hand", count alignment, and mid-play mode switch on the iPhone, 2026-06-08:**
- **Clef-aware y-mapping.** `renderer.js` no longer uses one pitch-gated ladder; each clef is its own ladder pinned to its top staff line via `yOf(d, clef)` (bands set per render by `setBands`). A right-hand note below middle C now sits on ledgers below the **treble** staff instead of being shoved ~24px into the bass region. Verified byte-identical geometry on the 6 signed-off fixtures (regression guard) — only the previously-broken case moves.
- **Clef selection by present voices.** `presentClefs()` draws a staff only for a hand that has sounding notes; a bass-only measure no longer paints an empty treble staff, and `staffHeight` is compact unless it's a true grand staff.
- **New proof fixture `treble-low`** (grand staff, RH descends D4→A3) at /fixtures.html; smoke test adds geometry assertions (RH heads stay in the treble band; bass-only draws a single bass staff). Noteheads now carry `data-hand` for testing/dimming.

**Polish pass (2026-06-08):**
- **Count-row + gridline PAD alignment.** Count labels (`buildCountrow`) are now absolutely positioned at `mapFrac(tick)` and the faint tick gridlines moved to a `.lab-gridlines` child inset by `PAD` — so "1 e & a …" and the gridlines sit directly under the PAD-shifted notes/attacks instead of drifting across the measure. Smoke test asserts the alignment.
- **`setMode` no longer restarts the transport.** Changing Tied↔Re-struck mid-play used to jump to the top; now `render()` rebuilds visuals + the attack list and the live scheduler picks up the new mode in place (verified headlessly: playback continues, press count updates).

**Remaining M1 (not blocking, deferred):** clef vertical-centering / inter-staff spacing are font-dependent and already signed off — tweak only if Drew spots something on-device. Compound-meter (6/8) count labels are still quarter-based (musically wrong for compound) but there's no 6/8 fixture yet and the §-spec counting convention is needed — defer until a compound-meter fixture/feature exists. (`setHands`/`setTempo` still restart mid-play; only `setMode` was flagged.)

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
