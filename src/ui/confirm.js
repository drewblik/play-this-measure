// src/ui/confirm.js — show the reading before teaching (FDD Stage 4 / honesty
// principle). Minimal in M2: render + low-confidence flags + validation errors +
// Teach / Re-read. The tap-to-fix editor is M4.
import { createLab } from '../engine/index.js';
import { runS1, runS3 } from '../parse/client.js';
import { cache, putLesson } from '../db.js';
import { draft } from './flow.js';

const DECLINE = {
  'not sheet music': "That photo doesn't look like sheet music. Try a clear, straight-on shot of the staff.",
  tuplet: 'This measure has triplets/tuplets, which this version can’t read yet. Try a measure without them.',
  'too many measures': 'That looks like more than two measures. Crop tighter — one or two bars at a time.',
};

export function mountConfirm(app) {
  if (!draft.s1) { location.hash = '#/capture'; return; }
  let lab = null;

  function destroyLab() { if (lab) { try { lab.destroy(); } catch (e) {} lab = null; } }

  function renderResult() {
    destroyLab();
    const s1 = draft.s1;

    if (s1.error) {
      app.innerHTML = `
        <a class="backlink" href="#/capture">← Retake</a>
        <h2 class="view-h" style="margin-top:10px">Couldn't read that</h2>
        <div class="banner warn">${DECLINE[s1.error] || `I couldn't read this measure (${s1.error}).`}</div>
        <div class="btn-row two"><a class="btn ghost" href="#/">Home</a><a class="btn" href="#/capture">Try another</a></div>`;
      return;
    }

    const { notation, validation, cached } = s1;
    const lowConf = notation.voices.some((v) => v.notes.some((n) => n.pitch !== 'rest' && n.confidence < 0.7));
    app.innerHTML = `
      <a class="backlink" href="#/capture">← Retake</a>
      <div class="eyebrow" style="margin-top:10px">Confirm the reading</div>
      <h2 class="view-h">Here's what I read</h2>
      <div class="banner info">Tap <b>Teach me</b> if this looks right${cached ? ' (loaded from cache — no charge)' : ''}. ${lowConf ? 'Notes I’m unsure about have a <b>dotted gold</b> outline.' : ''}</div>
      ${validation.ok ? '' : `<div class="banner warn"><b>The rhythm doesn't add up yet</b> (the model couldn't fully fix it):<ul>${validation.errors.map((e) => `<li>${e}</li>`).join('')}</ul>You can still teach it, or re-read.</div>`}
      <div class="card" style="padding:16px"><div id="labHost"></div></div>
      <div class="btn-row two" style="margin-top:16px">
        <button class="btn ghost" id="rereadBtn">↻ Re-read</button>
        <button class="btn" id="teachBtn">Teach me →</button>
      </div>`;

    lab = createLab(app.querySelector('#labHost'), { notation, tempoBpm: 60, mode: 'tie', hands: 'both' });

    app.querySelector('#rereadBtn').addEventListener('click', reread);
    app.querySelector('#teachBtn').addEventListener('click', teach);
  }

  async function reread() {
    destroyLab();
    app.querySelector('.card').innerHTML = `<div class="processing"><div class="spinner"></div><p>Reading again…</p></div>`;
    try {
      draft.s1 = await runS1(
        { cropBase64: draft.crop.base64, pageBase64: draft.page?.base64 || null, cropHash: draft.crop.hash, pageHash: draft.page?.hash || '', contextLine: contextLine() },
        { cache, forceFresh: true },
      );
      renderResult();
    } catch (e) { fail(e); }
  }

  async function teach() {
    destroyLab();
    app.innerHTML = `<div class="processing"><div class="spinner"></div><p>Writing your lesson…</p></div>`;
    try {
      const { keyRoot, mode, timeSig } = draft.context;
      const s3 = await runS3({ notation: draft.s1.notation, keyRoot, mode, timeSig, progressionNames: '' }, { cache });
      const id = crypto.randomUUID();
      await putLesson({
        id, songId: null, measureIds: [], createdAt: Date.now(),
        cropBlobId: draft.crop.hash, pageBlobId: draft.page?.hash || null, thumbDataUrl: draft.crop.thumbDataUrl,
        notation: draft.s1.notation, teaching: s3.teaching, context: draft.context,
        cents: (draft.s1.cents || 0) + (s3.cents || 0),
      });
      location.hash = `#/lesson/${id}`;
    } catch (e) { fail(e); }
  }

  function contextLine() {
    const { keyRoot, mode, timeSig, title } = draft.context;
    return `key ${keyRoot} ${mode}, time ${timeSig}${title ? `, from song "${title}"` : ''}`;
  }
  function fail(e) {
    console.error(e);
    app.innerHTML = `<div class="banner error"><b>Something went wrong.</b> ${e.apiError ? 'The parser is unavailable — check the deployed API key.' : (e.message || '')}</div>
      <div class="btn-row two"><a class="btn ghost" href="#/">Home</a><a class="btn" href="#/capture">Start over</a></div>`;
  }

  renderResult();
  return destroyLab;
}
