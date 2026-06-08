// src/engine/renderer.js
// Hand-rolled SVG notation + rhythm-block rendering. Ported from tie-rhythm.html
// and extended for the grand staff (bass clef), rests, and accidentals.
// PRESERVES the §7 gotchas: notehead tilt via <g rotate> (never CSS transform),
// tie split at beat boundaries with hollow tied-into heads, chord = shared stem,
// greedy lanes, dotted = 3-tick augmentation dot, beams within a beat.
import {
  SP, PAD, mapFrac, totalTicks, parsePitch, assignLanes, splitAtBeats,
  TREBLE_LINES, BASS_LINES, TREBLE_TOP_DIATONIC,
} from './layout.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// One continuous diatonic ladder for the whole grand staff: treble on top, bass
// below, C4 floating on a ledger between them (TDD §7). Top padding leaves room
// for ledger lines above the treble.
const TOP_Y = 28;
const GRAND_GAP = 24; // extra vertical space between treble and bass staves
let GRAND = false;    // set per render (renderStaff/clefPositions); gates the gap
// Continuous diatonic ladder; on a grand staff everything below middle C (the
// bass region) is pushed down by GRAND_GAP so the two staves don't cram together.
const yOf = (d) => TOP_Y + (TREBLE_TOP_DIATONIC - d) * (SP / 2) + (GRAND && d < 28 ? GRAND_GAP : 0);
const HALF = SP / 2;

const CLEF = { treble: '\u{1D11E}', bass: '\u{1D122}' }; // 𝄞 𝄢
const ACCIDENTAL = { 1: '♯', '-1': '♭', 0: '' }; // ♯ ♭
// Rest glyphs by sounding length in ticks (sixteenth grid). 𝄻 𝄼 𝄽 𝄾 𝄿
const REST_GLYPH = (durTicks) =>
  durTicks >= 16 ? '\u{1D13B}' : durTicks >= 8 ? '\u{1D13C}'
  : durTicks >= 4 ? '\u{1D13D}' : durTicks >= 2 ? '\u{1D13E}' : '\u{1D13F}';

function hasBass(notation) {
  return notation.voices.some((v) => v.hand === 'left' && v.notes.length);
}

// Total SVG height: taller when a bass staff is present, with margin below the
// bass stems before the rhythm grid.
export function staffHeight(notation) {
  return hasBass(notation) ? 176 : 86;
}

// Clef glyph placements. Drawn by createLab in a left column OUTSIDE the SVG so
// they never overlap the first notes. centerY is the SVG y the glyph centers on
// (createLab positions it with translateY(-50%)).
export function clefPositions(notation) {
  GRAND = hasBass(notation);
  const out = [{ clef: 'treble', glyph: CLEF.treble, centerY: yOf(34), size: 52 }];
  if (GRAND) out.push({ clef: 'bass', glyph: CLEF.bass, centerY: yOf(22), size: 38 });
  return out;
}

function clefLinesFor(hand) {
  return hand === 'left' ? BASS_LINES : TREBLE_LINES;
}

// Draw ledger lines for a note at diatonic d in its own clef (above or below).
function drawLedgers(svg, x, d, lines) {
  const lmax = Math.max(...lines);
  const lmin = Math.min(...lines);
  for (let e = lmax + 2; e <= d; e += 2) svg.appendChild(el('line', { x1: x - 9, y1: yOf(e), x2: x + 9, y2: yOf(e), class: 'ledger' }));
  for (let e = lmin - 2; e >= d; e -= 2) svg.appendChild(el('line', { x1: x - 9, y1: yOf(e), x2: x + 9, y2: yOf(e), class: 'ledger' }));
}

function placeNotehead(svg, x, y, struck) {
  const g = el('g', { transform: `rotate(-18 ${x} ${y})` }); // §7 #1 — NEVER a CSS transform
  const nh = el('ellipse', { cx: x, cy: y, rx: 6.2, ry: 4.5, class: 'nh' });
  if (!struck) nh.classList.add('tied'); // hollow blue = written, not re-pressed
  g.appendChild(nh);
  svg.appendChild(g);
  return nh;
}

function drawAccidental(svg, x, y, accidental) {
  if (!accidental) return;
  svg.appendChild(el('text', { x: x - 16, y: y + 4, class: 'accidental' })).textContent = ACCIDENTAL[accidental];
}

function drawFlag(svg, sx, sb, durTicks, stemDir) {
  const f = stemDir; // +1 stem-down, -1 stem-up (mirror the flag vertically)
  svg.appendChild(el('path', { d: `M ${sx} ${sb} q 9 ${3 * f} 8 ${14 * f} q -1 ${-8 * f} -8 ${-10 * f} z`, class: 'flag' }));
  if (durTicks === 1) svg.appendChild(el('path', { d: `M ${sx} ${sb - 7 * f} q 9 ${3 * f} 8 ${14 * f} q -1 ${-8 * f} -8 ${-10 * f} z`, class: 'flag' }));
}

// A single (non-chord) segment: notehead, accidental, ledgers, stem, flag/dot.
function drawNote(svg, seg, struck, beamY, xAt, lines, heads, hand, stemDir) {
  const p = parsePitch(seg.pitch);
  const d = p.diatonic;
  const x = xAt(seg.startTick);
  const y = yOf(d);
  drawLedgers(svg, x, d, lines);
  drawAccidental(svg, x, y, p.accidental);
  const nh = placeNotehead(svg, x, y, struck);
  heads.push({ tick: seg.startTick, struck, el: nh, hand });
  const sx = x + (stemDir > 0 ? -5 : 5); // down-stem on the left, up-stem on the right
  const sb = beamY != null ? beamY : y + stemDir * 30;
  svg.appendChild(el('line', { x1: sx, y1: y, x2: sx, y2: sb, class: 'stem' }));
  if (seg.durTicks === 3) svg.appendChild(el('circle', { cx: x + 11, cy: y - 2, r: 1.9, class: 'dot' })); // dotted
  if (beamY == null && seg.durTicks < 4) drawFlag(svg, sx, sb, seg.durTicks, stemDir);
}

// A beamed group of flagged segments within one beat.
function drawGroup(svg, group, xAt, lines, heads, hand, stemDir) {
  if (group.length === 1) { drawNote(svg, group[0].seg, group[0].struck, null, xAt, lines, heads, hand, stemDir); return; }
  let maxY = -1e9;
  let minY = 1e9;
  group.forEach((g) => { const yy = yOf(parsePitch(g.seg.pitch).diatonic); maxY = Math.max(maxY, yy); minY = Math.min(minY, yy); });
  const beamY = stemDir > 0 ? maxY + 30 : minY - 30; // beam below (down-stems) or above (up-stems)
  group.forEach((g) => drawNote(svg, g.seg, g.struck, beamY, xAt, lines, heads, hand, stemDir));
  const off = stemDir > 0 ? -5 : 5;
  const xA = xAt(group[0].seg.startTick) + off;
  const xB = xAt(group[group.length - 1].seg.startTick) + off;
  svg.appendChild(el('line', { x1: xA, y1: beamY, x2: xB, y2: beamY, class: 'beam' }));
  group.forEach((g, idx) => {
    if (g.seg.durTicks !== 1) return; // sixteenth stub (secondary beam)
    const x = xAt(g.seg.startTick) + off;
    const hasLeft = idx > 0;
    const nbr = hasLeft ? group[idx - 1] : group[idx + 1] || g;
    const nx = xAt(nbr.seg.startTick) + off;
    const stub = Math.min(14, Math.abs(nx - x) / 2) || 10;
    const dir = hasLeft ? -1 : 1;
    svg.appendChild(el('line', { x1: x, y1: beamY - 7 * stemDir, x2: x + dir * stub, y2: beamY - 7 * stemDir, class: 'beam' }));
  });
}

// A chord: noteheads sharing one stem top-to-bottom (+30). §7 #3.
function drawChord(svg, tick, members, xAt, lines, heads, hand, stemDir) {
  const x = xAt(tick);
  const ys = members.map((m) => yOf(parsePitch(m.seg.pitch).diatonic));
  const topY = Math.min(...ys);
  const botY = Math.max(...ys);
  const sx = x + (stemDir > 0 ? -5 : 5);
  const y1 = stemDir > 0 ? topY : topY - 30;
  const y2 = stemDir > 0 ? botY + 30 : botY;
  svg.appendChild(el('line', { x1: sx, y1, x2: sx, y2, class: 'stem' }));
  members.forEach((m) => {
    const p = parsePitch(m.seg.pitch);
    const y = yOf(p.diatonic);
    drawLedgers(svg, x, p.diatonic, lines);
    drawAccidental(svg, x, y, p.accidental);
    const nh = placeNotehead(svg, x, y, m.struck);
    heads.push({ tick: m.seg.startTick, struck: m.struck, el: nh, hand });
  });
}

// Render one voice into its clef band. Mirrors the prototype's renderNotation,
// scoped to one voice and one clef.
function renderVoice(svg, voice, notation, mode, xAt, heads) {
  const ticksPerBeat = notation.ticksPerBeat;
  const lines = clefLinesFor(voice.hand);
  const restY = yOf((Math.max(...lines) + Math.min(...lines)) / 2); // mid-staff
  // Grand staff: treble stems up, bass stems down (point away from the inter-
  // staff gap). A single staff keeps the prototype's down-stems.
  const stemDir = hasBass(notation) && voice.hand === 'right' ? -1 : 1;

  // Rests: glyph at mid-staff. Suppress a rest when another voice in the SAME
  // clef is sounding across it (e.g. Danny's struck-chord voice rests while the
  // held melody plays) — otherwise the rest glyph collides with that note.
  for (const note of voice.notes) {
    if (note.pitch !== 'rest') continue;
    const covered = notation.voices.some((other) =>
      other !== voice && other.hand === voice.hand &&
      other.notes.some((n) => n.pitch !== 'rest' &&
        n.startTick < note.startTick + note.durTicks && n.startTick + n.durTicks > note.startTick));
    if (covered) continue;
    const t = el('text', { x: xAt(note.startTick) - 5, y: restY + 4, class: 'rest' });
    t.textContent = REST_GLYPH(note.durTicks);
    svg.appendChild(t);
  }

  // Pitched notes -> drawing segments (split at beats; struck-ness is mode-aware).
  const segAll = [];
  for (const note of voice.notes) {
    if (note.pitch === 'rest') continue;
    for (const seg of splitAtBeats(note, ticksPerBeat)) {
      const struck = mode === 'tie' ? seg.startTick === note.startTick : true;
      segAll.push({ seg, struck });
    }
  }

  // Chords first (multiple segments sharing a startTick).
  const byTick = {};
  segAll.forEach((s) => { (byTick[s.seg.startTick] = byTick[s.seg.startTick] || []).push(s); });
  Object.keys(byTick).filter((t) => byTick[t].length > 1)
    .forEach((t) => drawChord(svg, +t, byTick[t], xAt, lines, heads, voice.hand, stemDir));

  // Singles: beam flagged notes (<1 beat) within the same beat.
  const singles = segAll.filter((s) => byTick[s.seg.startTick].length === 1)
    .sort((a, b) => a.seg.startTick - b.seg.startTick);
  let i = 0;
  while (i < singles.length) {
    const s = singles[i];
    if (s.seg.durTicks >= ticksPerBeat) { drawNote(svg, s.seg, s.struck, null, xAt, lines, heads, voice.hand, stemDir); i++; continue; }
    const beat = Math.floor(s.seg.startTick / ticksPerBeat);
    const group = [s];
    let j = i + 1;
    while (j < singles.length && singles[j].seg.durTicks < ticksPerBeat && Math.floor(singles[j].seg.startTick / ticksPerBeat) === beat) {
      group.push(singles[j]); j++;
    }
    drawGroup(svg, group, xAt, lines, heads, voice.hand, stemDir);
    i = j;
  }

  // Tie arcs (tie mode only): between consecutive segments of each original note.
  if (mode === 'tie') {
    for (const note of voice.notes) {
      if (note.pitch === 'rest') continue;
      const segs = splitAtBeats(note, ticksPerBeat);
      const y = yOf(parsePitch(note.pitch).diatonic) - 9;
      for (let k = 0; k < segs.length - 1; k++) {
        const x1 = xAt(segs[k].startTick);
        const x2 = xAt(segs[k + 1].startTick);
        const mx = (x1 + x2) / 2;
        svg.appendChild(el('path', { d: `M ${x1 + 5} ${y} Q ${mx} ${y - 9} ${x2 - 5} ${y}`, class: 'ntie' }));
      }
    }
  }
}

// Draw the full grand staff into `svg`. Returns { heads, width }.
export function renderStaff(svg, notation, { mode }) {
  GRAND = hasBass(notation);
  svg.innerHTML = '';
  const total = totalTicks(notation);
  const width = svg.getBoundingClientRect().width || 700;
  svg.setAttribute('height', staffHeight(notation));
  const xAt = (t) => mapFrac(t, total) * width;

  // Staff lines per present clef. Clef glyphs are drawn by createLab in a
  // separate left column (see clefPositions) so they never overlap the notes.
  const clefs = hasBass(notation) ? ['treble', 'bass'] : ['treble'];
  for (const clef of clefs) {
    const lines = clef === 'bass' ? BASS_LINES : TREBLE_LINES;
    for (const d of lines) svg.appendChild(el('line', { x1: 0, y1: yOf(d), x2: width, y2: yOf(d), class: 'staffline' }));
  }

  // Barlines between measures.
  const tpm = total / notation.measures;
  for (let m = 1; m < notation.measures; m++) {
    const x = xAt(m * tpm);
    const topD = TREBLE_TOP_DIATONIC;
    const botD = hasBass(notation) ? Math.min(...BASS_LINES) : Math.min(...TREBLE_LINES);
    svg.appendChild(el('line', { x1: x, y1: yOf(topD), x2: x, y2: yOf(botD), class: 'barline' }));
  }

  const heads = [];
  for (const voice of notation.voices) renderVoice(svg, voice, notation, mode, xAt, heads);
  return { heads, width };
}

// Build the rhythm-block grid. Sustain bars span each note; orange attack markers
// land on each press (mode-aware). Returns { attackEls, sustainEls, nLanes, pressCount }.
export function buildBlocks(grid, notation, { mode }) {
  [...grid.querySelectorAll('.block, .attack')].forEach((n) => n.remove());
  const total = totalTicks(notation);

  // All non-rest notes, tagged with hand, in one global lane space.
  const notes = [];
  notation.voices.forEach((v) => {
    for (const n of v.notes) if (n.pitch !== 'rest') notes.push({ ...n, hand: v.hand });
  });
  const { nLanes, laneByIndex } = assignLanes(notes);

  const top0 = 10;
  const usable = Math.max(96, nLanes * 30) - top0 * 2;
  const laneH = usable / nLanes;
  const bh = Math.min(26, laneH - 6);
  const laneTop = (lane) => top0 + lane * laneH + (laneH - bh) / 2;

  const attackEls = [];
  const sustainEls = [];
  let pressCount = 0;

  notes.forEach((note, ni) => {
    const top = laneTop(laneByIndex[ni]);
    const bar = document.createElement('div');
    bar.className = 'block';
    bar.dataset.hand = note.hand;
    bar.style.left = mapFrac(note.startTick, total) * 100 + '%';
    bar.style.width = (1 - PAD) * (note.durTicks / total) * 100 + '%';
    bar.style.top = top + 'px';
    bar.style.height = bh + 'px';
    const sus = document.createElement('div');
    sus.className = 'sustain';
    bar.appendChild(sus);
    grid.appendChild(bar);
    sustainEls.push(bar);

    const segs = mode === 'tie' ? [{ startTick: note.startTick }] : splitAtBeats(note, notation.ticksPerBeat);
    for (const seg of segs) {
      const a = document.createElement('div');
      a.className = 'attack';
      a.dataset.hand = note.hand;
      a.dataset.tick = seg.startTick;
      a.style.left = mapFrac(seg.startTick, total) * 100 + '%';
      a.style.top = top + 'px';
      a.style.height = bh + 'px';
      grid.appendChild(a);
      attackEls.push({ tick: seg.startTick, durTicks: note.durTicks, el: a, hand: note.hand });
      pressCount++;
    }
  });

  grid.style.height = Math.max(96, nLanes * 30) + 'px';
  grid.style.background =
    `repeating-linear-gradient(90deg, transparent 0 calc(100%/${total} - 1px), rgba(0,0,0,.05) calc(100%/${total} - 1px) calc(100%/${total}))`;
  return { attackEls, sustainEls, nLanes, pressCount };
}
