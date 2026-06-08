// src/ui/lesson.js — the measure lesson (FDD Stage 5): concept + explanation,
// tied/re-struck toggle, tempo, the full createLab play-along, view-photo, cost.
// Loads a saved lesson by id — reopening never calls the API (§19.6).
import { createLab } from '../engine/index.js';
import { getLesson, getBlob } from '../db.js';
import { formatCents } from '../parse/cost.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const boldCount = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function hasTies(n) {
  const tpb = n.ticksPerBeat;
  return n.voices.some((v) => v.notes.some((x) => x.pitch !== 'rest'
    && Math.floor(x.startTick / tpb) !== Math.floor((x.startTick + x.durTicks - 1) / tpb)));
}

export async function mountLesson(app, { id }) {
  const lesson = await getLesson(id).catch(() => null);
  if (!lesson) { location.hash = '#/'; return; }
  const { notation, teaching } = lesson;
  const ties = hasTies(notation);

  app.innerHTML = `
    <a class="backlink" href="#/">← Home</a>
    <div style="margin-top:10px"><span class="concept">🎹 ${esc(teaching?.conceptName || 'Measure')}</span></div>
    <p class="explain">${esc(teaching?.explanation || '')}</p>
    ${teaching?.countingLine ? `<p class="counting">${boldCount(teaching.countingLine)}</p>` : ''}

    <div class="controls">
      <button class="play" id="playBtn">▶ Play</button>
      ${ties ? `<div class="seg" id="modeSeg"><button data-m="tie" class="on">Tied</button><button data-m="restruck">Re-struck</button></div>` : ''}
      <label class="tempo">Tempo <b id="bpmOut">60</b><input id="tempo" type="range" min="40" max="100" step="2" value="60"></label>
    </div>

    <div class="card" style="padding:16px"><div id="labHost"></div></div>

    <div class="btn-row two" style="margin-top:14px">
      <button class="btn ghost" id="photoBtn">🖼 View photo</button>
      <a class="btn ghost" href="#/capture">＋ Another measure</a>
    </div>
    <p class="cost">${lesson.cents ? `this measure cost ${formatCents(lesson.cents)}` : ''}</p>`;

  const host = app.querySelector('#labHost');
  const lab = createLab(host, { notation, tempoBpm: 60, mode: 'tie', hands: 'both' });

  let playing = false;
  const playBtn = app.querySelector('#playBtn');
  playBtn.addEventListener('click', () => {
    if (playing) { lab.stop(); playing = false; playBtn.textContent = '▶ Play'; }
    else { lab.play(); playing = true; playBtn.textContent = '■ Stop'; }
  });

  const modeSeg = app.querySelector('#modeSeg');
  if (modeSeg) modeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    [...modeSeg.children].forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    lab.setMode(b.dataset.m);
  });

  const tempo = app.querySelector('#tempo');
  tempo.addEventListener('input', () => {
    app.querySelector('#bpmOut').textContent = tempo.value;
    lab.setTempo(+tempo.value);
  });

  // view-photo overlay (loads the original crop from the blob store)
  let overlayUrl = null;
  app.querySelector('#photoBtn').addEventListener('click', async () => {
    const blob = await getBlob(lesson.cropBlobId).catch(() => null);
    if (!blob) return;
    overlayUrl = URL.createObjectURL(blob);
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<button class="close" aria-label="close">×</button><img src="${overlayUrl}" alt="original crop">`;
    const close = () => { ov.remove(); if (overlayUrl) { URL.revokeObjectURL(overlayUrl); overlayUrl = null; } };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.classList.contains('close')) close(); });
    document.body.appendChild(ov);
  });

  return () => {
    try { lab.destroy(); } catch (e) {}
    document.querySelector('.overlay')?.remove();
    if (overlayUrl) URL.revokeObjectURL(overlayUrl);
  };
}
