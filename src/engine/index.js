// src/engine/index.js
// createLab — the engine's public API (TDD §7). Builds the lab DOM (grand staff
// + rhythm blocks + playhead + press/hold indicator) into a container, runs the
// 100ms-lookahead / 25ms scheduler, and exposes play/stop/setTempo/setMode/
// setHands/destroy. Orchestrates renderer.js (visuals) + audio.js (sound).
import { totalTicks, ticksPerMeasure, mapFrac } from './layout.js';
import { ensureCtx, dropCtx, click, tone, buildAttacks } from './audio.js';
import { renderStaff, buildBlocks, clefPositions } from './renderer.js';

const LOOKAHEAD = 0.1; // seconds scheduled ahead
const INTERVAL = 25; // ms scheduler tick

export function createLab(container, opts) {
  const notation = opts.notation;
  let bpm = opts.tempoBpm || 60;
  let mode = opts.mode || 'tie'; // 'tie' | 'restruck'
  let hands = opts.hands || 'both'; // 'both' | 'right' | 'left'
  const onTick = opts.onTick;

  // ---- DOM ----
  container.innerHTML = `
    <div class="lab">
      <div class="lab-stage">
        <div class="lab-clefs"></div>
        <div class="lab-content">
          <div class="lab-playfield">
            <svg class="lab-notation"></svg>
            <div class="lab-grid"></div>
            <div class="lab-playhead"></div>
          </div>
          <div class="lab-countrow"></div>
        </div>
      </div>
      <div class="lab-indicator">
        <div class="lab-press">Keys you press: <b class="lab-pressN">0</b></div>
        <div class="lab-hand"><span class="lab-dot">—</span><span class="lab-handtxt">Press play to follow along</span></div>
      </div>
    </div>`;
  const clefHost = container.querySelector('.lab-clefs');
  const svg = container.querySelector('.lab-notation');
  const grid = container.querySelector('.lab-grid');
  const playfield = container.querySelector('.lab-playfield');
  const playhead = container.querySelector('.lab-playhead');
  const countrow = container.querySelector('.lab-countrow');
  const pressN = container.querySelector('.lab-pressN');
  const dot = container.querySelector('.lab-dot');
  const handtxt = container.querySelector('.lab-handtxt');

  // ---- state derived on render ----
  let heads = []; // {tick, struck, el, hand}
  let attackEls = []; // grid markers {tick, durTicks, el, hand}
  let attacks = []; // audio attack list (hands-filtered) {tick, freq, durTicks, hand}
  let countCells = [];

  function buildCountrow() {
    const total = totalTicks(notation);
    const tpm = ticksPerMeasure(notation.timeSignature, notation.ticksPerBeat);
    const sub = ['', 'e', '&', 'a']; // sixteenth grid
    countrow.innerHTML = '';
    countCells = [];
    for (let t = 0; t < total; t++) {
      const within = t % tpm;
      const subIdx = within % notation.ticksPerBeat;
      const beat = Math.floor(within / notation.ticksPerBeat) + 1;
      const span = document.createElement('span');
      span.textContent = subIdx === 0 ? String(beat) : sub[subIdx] || '';
      if (subIdx === 0) span.classList.add('beat');
      span.style.left = mapFrac(t, total) * 100 + '%'; // sit under the note at this tick (PAD-aware)
      countrow.appendChild(span);
      countCells.push(span);
    }
  }

  function applyHandsDim() {
    const muted = (h) => hands !== 'both' && h !== hands;
    heads.forEach((x) => x.el.classList.toggle('muted', muted(x.hand)));
    [...grid.querySelectorAll('.block, .attack')].forEach((e) => e.classList.toggle('muted', muted(e.dataset.hand)));
  }

  function rebuildAudio() {
    attacks = buildAttacks(notation, mode, hands);
    pressN.textContent = attacks.length;
  }

  function render() {
    const r = renderStaff(svg, notation, { mode });
    heads = r.heads;
    const b = buildBlocks(grid, notation, { mode });
    attackEls = b.attackEls;
    buildCountrow();
    applyHandsDim();
    rebuildAudio();
    // clef glyphs in the left column (kept out of the SVG so they never overlap notes)
    clefHost.innerHTML = '';
    for (const c of clefPositions(notation)) {
      const s = document.createElement('span');
      s.className = 'lab-clef';
      s.textContent = c.glyph;
      s.style.top = c.centerY + 'px';
      s.style.fontSize = c.size + 'px';
      clefHost.appendChild(s);
    }
    // playfield height = staff svg + grid
    playfield.style.height = svg.getBoundingClientRect().height + grid.getBoundingClientRect().height + 6 + 'px';
  }

  // ---- transport ----
  let ctx = null;
  let isPlaying = false;
  let nextTick = 0;
  let nextTime = 0;
  let sched = [];
  let timer = null;
  let rafId = null;
  let stuckTimer = null; // iOS frozen-clock watchdog
  let lastTick = -1; // edge-detect so onTick fires once per tick, not per frame
  let wantPlay = false; // intent flag; guards the async resume->begin path
  const secPerTick = () => 60 / bpm / notation.ticksPerBeat;

  function scheduler() {
    const total = totalTicks(notation);
    const tpm = ticksPerMeasure(notation.timeSignature, notation.ticksPerBeat);
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const tick = nextTick % total;
      const sp = secPerTick();
      if (tick % notation.ticksPerBeat === 0) click(ctx, nextTime, tick % tpm === 0);
      for (const a of attacks) if (a.tick === tick) tone(ctx, nextTime, a.freq, a.durTicks * sp * 0.98);
      sched.push({ tick, time: nextTime, sp });
      nextTime += sp;
      nextTick++;
    }
    const now = ctx.currentTime;
    sched = sched.filter((s) => s.time > now - 1.0);
  }

  function animate() {
    if (!isPlaying) return;
    const now = ctx.currentTime;
    let cur = null;
    for (let i = sched.length - 1; i >= 0; i--) { if (sched[i].time <= now) { cur = sched[i]; break; } }
    if (cur) {
      const total = totalTicks(notation);
      const frac = (now - cur.time) / cur.sp;
      let pos = (cur.tick + Math.min(frac, 1)) / total;
      pos = ((pos % 1) + 1) % 1;
      playhead.style.left = mapFrac(pos * total, total) * 100 + '%';
      const liveTick = cur.tick;
      countCells.forEach((c, i) => c.classList.toggle('lit', i === liveTick));
      heads.forEach((h) => h.el.classList.remove('lit'));
      const active = (h) => hands === 'both' || h === hands;
      const hits = attacks.filter((a) => a.tick === liveTick);
      const justHit = frac < 0.45;
      if (hits.length && justHit) {
        dot.className = 'lab-dot press';
        dot.textContent = 'PRESS';
        handtxt.innerHTML = hits.length > 1 ? `<b>Press ${hits.length}</b> keys together` : '<b>Press</b> — strike now';
        attackEls.filter((a) => a.tick === liveTick && active(a.hand)).forEach((a) => {
          a.el.classList.remove('flash'); void a.el.offsetWidth; a.el.classList.add('flash');
        });
        heads.filter((h) => h.tick === liveTick && h.struck && active(h.hand)).forEach((h) => {
          h.el.classList.add('lit');
          h.el.classList.remove('flash'); void h.el.getBoundingClientRect(); h.el.classList.add('flash'); // re-trigger pulse
        });
      } else {
        const holding = attacks.some((a) => a.tick <= liveTick && a.tick + a.durTicks > liveTick);
        if (holding) { dot.className = 'lab-dot hold'; dot.textContent = 'hold'; handtxt.innerHTML = '<b>Hold</b> — keep the key down'; }
        else { dot.className = 'lab-dot'; dot.textContent = '—'; handtxt.innerHTML = 'rest'; }
      }
      if (onTick && liveTick !== lastTick) onTick(liveTick);
      lastTick = liveTick;
    }
    rafId = requestAnimationFrame(animate);
  }

  function start() {
    ctx = ensureCtx();
    wantPlay = true;
    const begin = () => {
      if (!wantPlay) return; // stop() was called before resume() resolved
      isPlaying = true;
      nextTick = 0;
      nextTime = ctx.currentTime + 0.12;
      sched = [];
      lastTick = -1;
      timer = setInterval(scheduler, INTERVAL);
      scheduler();
      playhead.classList.add('on');
      rafId = requestAnimationFrame(animate);
      // iOS watchdog: if the context clock never advances, this context is the
      // frozen one. Drop it so the next Play rebuilds a fresh context, and stop
      // so the user can re-tap (we can't resume a fresh ctx outside the gesture).
      const ctxStart = ctx.currentTime;
      clearTimeout(stuckTimer);
      stuckTimer = setTimeout(() => {
        if (isPlaying && ctx.currentTime - ctxStart < 0.05) { dropCtx(); stop(); }
      }, 450);
    };
    // iOS: the AudioContext can be suspended/interrupted between plays. resume()
    // is async; if we schedule against a still-frozen currentTime the playhead
    // never advances. Only begin once the clock is actually running.
    if (ctx.state === 'running') begin();
    else ctx.resume().then(begin, begin);
  }

  function stop() {
    wantPlay = false;
    isPlaying = false;
    clearInterval(timer);
    clearTimeout(stuckTimer);
    if (rafId) cancelAnimationFrame(rafId);
    playhead.classList.remove('on');
    countCells.forEach((c) => c.classList.remove('lit'));
    heads.forEach((h) => h.el.classList.remove('lit'));
    dot.className = 'lab-dot';
    dot.textContent = '—';
    handtxt.innerHTML = 'Press play to follow along';
  }

  function restartIfPlaying() { if (isPlaying) { stop(); start(); } }

  // ---- responsive re-render (width drives xAt) ----
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!isPlaying) render(); }, 120);
  }
  window.addEventListener('resize', onResize);

  // initial paint, then a rAF re-render once the container has real width
  render();
  const initRaf = requestAnimationFrame(render);

  return {
    play() { if (!isPlaying) start(); },
    stop() { stop(); },
    setTempo(b) { bpm = b; restartIfPlaying(); },
    setMode(m) { mode = m; render(); }, // render() rebuilds visuals + the attack list; the live scheduler picks up the new mode without restarting from the top
    setHands(h) { hands = h; rebuildAudio(); applyHandsDim(); restartIfPlaying(); },
    destroy() {
      stop();
      cancelAnimationFrame(initRaf);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      container.innerHTML = '';
    },
  };
}
