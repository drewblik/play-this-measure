// src/ui/capture.js — photograph a crop (required) + optional full page + the
// key/time context, then run S1 (+S2 repair) and hand off to Confirm. (FDD Stage 2/3.)
import { prepImage } from '../util/image.js';
import { runS1 } from '../parse/client.js';
import { cache, putBlob } from '../db.js';
import { draft, resetDraft } from './flow.js';

export function mountCapture(app) {
  resetDraft();
  let cropFile = null;
  let pageFile = null;

  app.innerHTML = `
    <a class="backlink" href="#/">← Home</a>
    <div class="eyebrow" style="margin-top:10px">Explain a measure</div>
    <h2 class="view-h">Photograph the measure</h2>
    <p class="lede">A tight, straight-on crop of <b>1–2 measures</b>. Add a full-page shot too if you can, so I can read the key and time signature.</p>

    <div class="card">
      <label class="filebtn" id="cropBtn">
        <input type="file" accept="image/*" capture="environment" id="cropInput" hidden>
        <span id="cropLabel">📷 Crop photo — required</span>
      </label>
      <img class="preview" id="cropPreview" hidden alt="crop preview">

      <label class="filebtn ghost" id="pageBtn" style="margin-top:12px">
        <input type="file" accept="image/*" capture="environment" id="pageInput" hidden>
        <span id="pageLabel">📄 Full page — optional, for context</span>
      </label>
      <img class="preview" id="pagePreview" hidden alt="page preview">

      <div class="fields">
        <div class="field"><label>Key</label>
          <div class="key-row">
            <input id="keyRoot" value="C" maxlength="2" aria-label="key root">
            <select id="mode"><option value="major">major</option><option value="minor">minor</option></select>
          </div>
        </div>
        <div class="field"><label>Time</label><input id="timeSig" value="4/4" aria-label="time signature"></div>
        <div class="field"><label>Song</label><input id="title" placeholder="optional, e.g. Danny" aria-label="song title"></div>
      </div>

      <button class="btn" id="goBtn" disabled style="margin-top:18px">Read this measure</button>
      <p class="hint" id="capHint">Add a crop photo to continue.</p>
    </div>`;

  const $ = (id) => app.querySelector('#' + id);
  const goBtn = $('goBtn');
  const capHint = $('capHint');

  function bindFile(inputId, labelId, previewId, labelText, onPick) {
    const input = $(inputId);
    input.addEventListener('change', () => {
      const f = input.files[0];
      if (!f) return;
      onPick(f);
      const url = URL.createObjectURL(f);
      const prev = $(previewId);
      prev.src = url; prev.hidden = false;
      $(labelId).textContent = `✓ ${f.name.slice(0, 28)}`;
      $(labelId).closest('.filebtn').classList.add('has');
    });
  }
  bindFile('cropInput', 'cropLabel', 'cropPreview', 'crop', (f) => { cropFile = f; goBtn.disabled = false; capHint.textContent = 'Looks good — read it when ready.'; });
  bindFile('pageInput', 'pageLabel', 'pagePreview', 'page', (f) => { pageFile = f; });

  goBtn.addEventListener('click', async () => {
    app.querySelector('.card').innerHTML = `<div class="processing"><div class="spinner"></div><p>Reading the notation…</p><p class="hint">checking rhythm arithmetic</p></div>`;
    try {
      const crop = await prepImage(cropFile);
      const page = pageFile ? await prepImage(pageFile) : null;
      await putBlob(crop.hash, crop.blob);
      if (page) await putBlob(page.hash, page.blob);

      const keyRoot = ($('keyRoot')?.value || 'C').trim() || 'C';
      const mode = $('mode')?.value || 'major';
      const timeSig = ($('timeSig')?.value || '4/4').trim() || '4/4';
      const title = ($('title')?.value || '').trim();
      const contextLine = `key ${keyRoot} ${mode}, time ${timeSig}${title ? `, from song "${title}"` : ''}`;

      const s1 = await runS1(
        { cropBase64: crop.base64, pageBase64: page?.base64 || null, cropHash: crop.hash, pageHash: page?.hash || '', contextLine },
        { cache },
      );
      Object.assign(draft, { crop, page, context: { keyRoot, mode, timeSig, title }, s1 });
      location.hash = '#/confirm';
    } catch (e) {
      app.querySelector('.card').innerHTML = `
        <div class="banner error"><b>Couldn't read that.</b> ${e.apiError ? 'The parser is unavailable — check the deployed API key.' : (e.message || 'Something went wrong.')}</div>
        <div class="btn-row two">
          <a class="btn ghost" href="#/">Home</a>
          <button class="btn" onclick="location.reload()">Try again</button>
        </div>`;
      console.error(e);
    }
  });
}
