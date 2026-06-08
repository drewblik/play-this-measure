// src/ui/home.js — minimal M2 home: start a measure lesson + reopen saved ones.
// (The full song-card Home with overviews/circle-of-fifths is M3.)
import { allLessons } from '../db.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function lessonCard(l) {
  const sub = new Date(l.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<a class="lesson-card" href="#/lesson/${encodeURIComponent(l.id)}">
    ${l.thumbDataUrl ? `<img src="${l.thumbDataUrl}" alt="">` : '<div class="lesson-thumb-ph"></div>'}
    <div>
      <div class="lesson-card-title">${esc(l.teaching?.conceptName || 'Measure')}</div>
      <div class="lesson-card-sub">${esc(l.context?.title ? l.context.title + ' · ' : '')}${sub}</div>
    </div>
  </a>`;
}

export async function mountHome(app) {
  let lessons = [];
  try { lessons = await allLessons(); } catch (e) { /* fresh / no db yet */ }

  app.innerHTML = `
    <div class="eyebrow">Play This Measure</div>
    <h1>Play This <span class="em">Measure</span></h1>
    <p class="lede">Photograph a measure you can't read — I'll show you my reading, then teach it as a play-along.</p>

    <div class="btn-row" style="margin-top:22px">
      <a class="btn" href="#/capture">📷 Explain a measure</a>
    </div>

    <div class="card">
      <div class="eyebrow" style="margin-bottom:14px">Your measures</div>
      ${lessons.length
        ? `<div class="lesson-list">${lessons.map(lessonCard).join('')}</div>`
        : `<p class="hint">No measures yet. Tap <b>Explain a measure</b> and photograph a tight crop of 1–2 bars.</p>`}
    </div>

    <p class="hint" style="margin-top:18px">
      <a href="/fixtures.html" style="color:var(--attack);font-weight:600;text-decoration:none">▶ Engine fixtures (M0/M1)</a>
    </p>
    <p class="meta">M2 · measure-lesson loop</p>`;
}
